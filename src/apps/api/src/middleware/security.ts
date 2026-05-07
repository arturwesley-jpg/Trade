import type { FastifyRequest, FastifyReply } from "fastify";
import { createHash } from "node:crypto";

export interface SecurityConfig {
  enableIpWhitelist?: boolean;
  adminIpWhitelist?: string[];
  enableBruteForceProtection?: boolean;
  maxLoginAttempts?: number;
  lockoutDurationMs?: number;
  enableSuspiciousActivityDetection?: boolean;
  enableApiKeyValidation?: boolean;
  validApiKeys?: string[];
}

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

interface SuspiciousActivity {
  rapidRequests: number;
  lastRequestTime: number;
  suspiciousPatterns: number;
}

export class SecurityMiddleware {
  private config: Required<SecurityConfig>;
  private loginAttempts: Map<string, LoginAttempt> = new Map();
  private suspiciousActivity: Map<string, SuspiciousActivity> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      enableIpWhitelist: config.enableIpWhitelist ?? false,
      adminIpWhitelist: config.adminIpWhitelist ?? [],
      enableBruteForceProtection: config.enableBruteForceProtection ?? true,
      maxLoginAttempts: config.maxLoginAttempts ?? 5,
      lockoutDurationMs: config.lockoutDurationMs ?? 15 * 60 * 1000, // 15 minutes
      enableSuspiciousActivityDetection: config.enableSuspiciousActivityDetection ?? true,
      enableApiKeyValidation: config.enableApiKeyValidation ?? false,
      validApiKeys: config.validApiKeys ?? []
    };

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Validate request for suspicious patterns
   */
  validateRequest() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!this.config.enableSuspiciousActivityDetection) {
        return;
      }

      const identifier = this.getIdentifier(request);
      const now = Date.now();

      // Check for SQL injection patterns
      const sqlInjectionPatterns = [
        /(\bOR\b|\bAND\b).*=.*\b/i,
        /UNION.*SELECT/i,
        /DROP.*TABLE/i,
        /INSERT.*INTO/i,
        /DELETE.*FROM/i,
        /--/,
        /;.*--/,
        /\/\*.*\*\//
      ];

      // Check for XSS patterns
      const xssPatterns = [
        /<script[^>]*>.*<\/script>/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i
      ];

      const requestString = JSON.stringify({
        body: request.body,
        query: request.query,
        params: request.params
      });

      let suspiciousCount = 0;

      for (const pattern of [...sqlInjectionPatterns, ...xssPatterns]) {
        if (pattern.test(requestString)) {
          suspiciousCount++;
        }
      }

      if (suspiciousCount > 0) {
        const activity = this.suspiciousActivity.get(identifier) ?? {
          rapidRequests: 0,
          lastRequestTime: now,
          suspiciousPatterns: 0
        };

        activity.suspiciousPatterns += suspiciousCount;
        activity.lastRequestTime = now;
        this.suspiciousActivity.set(identifier, activity);

        // Block if too many suspicious patterns detected
        if (activity.suspiciousPatterns >= 3) {
          return reply.status(403).send({
            error: {
              code: "SUSPICIOUS_ACTIVITY",
              message: "Suspicious activity detected",
              correlationId: request.id
            }
          });
        }
      }

      // Check for rapid requests (potential DoS)
      const activity = this.suspiciousActivity.get(identifier);
      if (activity) {
        const timeSinceLastRequest = now - activity.lastRequestTime;

        if (timeSinceLastRequest < 100) { // Less than 100ms between requests
          activity.rapidRequests++;

          if (activity.rapidRequests > 20) {
            return reply.status(429).send({
              error: {
                code: "TOO_MANY_REQUESTS",
                message: "Too many rapid requests detected",
                correlationId: request.id
              }
            });
          }
        } else if (timeSinceLastRequest > 1000) {
          // Reset rapid request counter if more than 1 second passed
          activity.rapidRequests = 0;
        }

        activity.lastRequestTime = now;
        this.suspiciousActivity.set(identifier, activity);
      } else {
        this.suspiciousActivity.set(identifier, {
          rapidRequests: 0,
          lastRequestTime: now,
          suspiciousPatterns: 0
        });
      }
    };
  }

  /**
   * Brute force protection for login endpoints
   */
  bruteForceProtection() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!this.config.enableBruteForceProtection) {
        return;
      }

      const identifier = this.getIdentifier(request);
      const now = Date.now();
      const attempt = this.loginAttempts.get(identifier);

      // Check if account is locked
      if (attempt?.lockedUntil && now < attempt.lockedUntil) {
        const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
        return reply.status(429).send({
          error: {
            code: "ACCOUNT_LOCKED",
            message: `Too many failed login attempts. Try again in ${remainingSeconds} seconds`,
            correlationId: request.id
          }
        });
      }

      // Reset if lockout period expired
      if (attempt?.lockedUntil && now >= attempt.lockedUntil) {
        this.loginAttempts.delete(identifier);
      }
    };
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(request: FastifyRequest): void {
    if (!this.config.enableBruteForceProtection) {
      return;
    }

    const identifier = this.getIdentifier(request);
    const now = Date.now();
    const attempt = this.loginAttempts.get(identifier);

    if (!attempt) {
      this.loginAttempts.set(identifier, {
        count: 1,
        firstAttempt: now
      });
      return;
    }

    // Reset if first attempt was more than 15 minutes ago
    if (now - attempt.firstAttempt > this.config.lockoutDurationMs) {
      this.loginAttempts.set(identifier, {
        count: 1,
        firstAttempt: now
      });
      return;
    }

    attempt.count++;

    // Lock account if max attempts reached
    if (attempt.count >= this.config.maxLoginAttempts) {
      attempt.lockedUntil = now + this.config.lockoutDurationMs;
    }

    this.loginAttempts.set(identifier, attempt);
  }

  /**
   * Clear login attempts on successful login
   */
  clearLoginAttempts(request: FastifyRequest): void {
    const identifier = this.getIdentifier(request);
    this.loginAttempts.delete(identifier);
  }

  /**
   * IP whitelist middleware for admin routes
   */
  ipWhitelist() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!this.config.enableIpWhitelist) {
        return;
      }

      const clientIp = request.ip;

      if (!this.config.adminIpWhitelist.includes(clientIp)) {
        return reply.status(403).send({
          error: {
            code: "IP_NOT_WHITELISTED",
            message: "Access denied: IP not whitelisted",
            correlationId: request.id
          }
        });
      }
    };
  }

  /**
   * API key validation middleware
   */
  apiKeyValidation() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!this.config.enableApiKeyValidation) {
        return;
      }

      const apiKey = request.headers["x-api-key"] as string;

      if (!apiKey) {
        return reply.status(401).send({
          error: {
            code: "API_KEY_MISSING",
            message: "API key is required",
            correlationId: request.id
          }
        });
      }

      const apiKeyHash = this.hashApiKey(apiKey);

      if (!this.config.validApiKeys.includes(apiKeyHash)) {
        return reply.status(401).send({
          error: {
            code: "INVALID_API_KEY",
            message: "Invalid API key",
            correlationId: request.id
          }
        });
      }
    };
  }

  /**
   * Get unique identifier for rate limiting (IP + User Agent)
   */
  private getIdentifier(request: FastifyRequest): string {
    const ip = request.ip;
    const userAgent = request.headers["user-agent"] ?? "unknown";
    return createHash("sha256").update(`${ip}:${userAgent}`).digest("hex");
  }

  /**
   * Hash API key for secure comparison
   */
  private hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Cleanup login attempts
    for (const [identifier, attempt] of this.loginAttempts.entries()) {
      if (attempt.lockedUntil && now >= attempt.lockedUntil) {
        this.loginAttempts.delete(identifier);
      } else if (now - attempt.firstAttempt > this.config.lockoutDurationMs * 2) {
        this.loginAttempts.delete(identifier);
      }
    }

    // Cleanup suspicious activity
    for (const [identifier, activity] of this.suspiciousActivity.entries()) {
      if (now - activity.lastRequestTime > 60 * 60 * 1000) { // 1 hour
        this.suspiciousActivity.delete(identifier);
      }
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
