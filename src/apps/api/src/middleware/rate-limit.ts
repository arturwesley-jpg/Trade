import type { FastifyRequest, FastifyReply } from "fastify";
import { createClient, type RedisClientType } from "redis";
import { logger } from "@trade/shared";

/**
 * Rate limit tier configuration
 */
export interface RateLimitTier {
  name: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  redis?: {
    url?: string;
    keyPrefix?: string;
  };
  tiers: Record<string, RateLimitTier>;
  defaultTier: string;
  endpointLimits?: Record<string, Partial<RateLimitTier>>;
  whitelist?: string[];
  adminBypass?: boolean;
  healthCheckExempt?: string[];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Rate limit window
 */
interface RateLimitWindow {
  minute: { count: number; reset: number };
  hour: { count: number; reset: number };
  day: { count: number; reset: number };
}

/**
 * Rate limit metrics
 */
export interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  topLimitedUsers: Array<{ identifier: string; count: number }>;
  topLimitedIPs: Array<{ ip: string; count: number }>;
  endpointStats: Record<string, { requests: number; blocked: number }>;
}

/**
 * Default rate limit tiers
 */
export const DEFAULT_TIERS: Record<string, RateLimitTier> = {
  free: {
    name: "free",
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 10
  },
  pro: {
    name: "pro",
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    requestsPerDay: 100000,
    burstLimit: 50
  },
  enterprise: {
    name: "enterprise",
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: 1000000,
    burstLimit: 200
  }
};

/**
 * Default endpoint-specific limits
 */
export const DEFAULT_ENDPOINT_LIMITS: Record<string, Partial<RateLimitTier>> = {
  "/api/market-data": {
    requestsPerMinute: 120,
    requestsPerHour: 5000
  },
  "/api/auth/login": {
    requestsPerMinute: 5,
    requestsPerHour: 20,
    burstLimit: 3
  },
  "/api/auth/register": {
    requestsPerMinute: 3,
    requestsPerHour: 10,
    burstLimit: 2
  },
  "/api/backtest": {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    burstLimit: 5
  }
};

/**
 * Redis-backed rate limiter with sliding window algorithm
 */
export class RateLimiter {
  private redis: RedisClientType | null = null;
  private readonly config: RateLimitConfig;
  private readonly keyPrefix: string;
  private connected = false;
  private metrics: RateLimitMetrics = {
    totalRequests: 0,
    blockedRequests: 0,
    topLimitedUsers: [],
    topLimitedIPs: [],
    endpointStats: {}
  };
  private limitedUsers = new Map<string, number>();
  private limitedIPs = new Map<string, number>();

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      tiers: config.tiers || DEFAULT_TIERS,
      endpointLimits: config.endpointLimits || DEFAULT_ENDPOINT_LIMITS,
      whitelist: config.whitelist || [],
      healthCheckExempt: config.healthCheckExempt || ["/health", "/metrics"]
    };
    this.keyPrefix = config.redis?.keyPrefix || "ratelimit:";
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const redisUrl = this.config.redis?.url || process.env.REDIS_URL || "redis://localhost:6379";
      this.redis = createClient({ url: redisUrl });

      this.redis.on("error", (err: Error) => {
        logger.error({ err }, "Rate limiter Redis error");
      });

      this.redis.on("connect", () => {
        logger.info("Rate limiter Redis connected");
      });

      this.redis.on("disconnect", () => {
        logger.warn("Rate limiter Redis disconnected");
        this.connected = false;
      });

      await this.redis.connect();
      this.connected = true;
      logger.info("Rate limiter initialized with Redis backend");
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to connect rate limiter to Redis");
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis && this.connected) {
      await this.redis.quit();
      this.connected = false;
      logger.info("Rate limiter Redis disconnected");
    }
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(
    identifier: string,
    tier: string,
    endpoint?: string,
    ip?: string
  ): Promise<RateLimitResult> {
    if (!this.redis || !this.connected) {
      logger.warn("Rate limiter check called but Redis not connected, allowing request");
      return {
        allowed: true,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60000
      };
    }

    // Get tier configuration
    const tierConfig = this.config.tiers[tier] || this.config.tiers[this.config.defaultTier];

    // Apply endpoint-specific limits if configured
    let limits = { ...tierConfig };
    if (endpoint && this.config.endpointLimits) {
      const endpointLimit = Object.keys(this.config.endpointLimits).find(pattern =>
        endpoint.startsWith(pattern)
      );
      if (endpointLimit) {
        limits = { ...limits, ...this.config.endpointLimits[endpointLimit] };
      }
    }

    // Check all time windows
    const now = Date.now();
    const windows = await this.getWindows(identifier);

    // Check minute window
    const minuteReset = Math.floor(now / 60000) * 60000 + 60000;
    if (windows.minute.reset < now) {
      windows.minute = { count: 0, reset: minuteReset };
    }

    // Check hour window
    const hourReset = Math.floor(now / 3600000) * 3600000 + 3600000;
    if (windows.hour.reset < now) {
      windows.hour = { count: 0, reset: hourReset };
    }

    // Check day window
    const dayReset = Math.floor(now / 86400000) * 86400000 + 86400000;
    if (windows.day.reset < now) {
      windows.day = { count: 0, reset: dayReset };
    }

    // Check burst limit (requests in last second)
    const burstKey = `${this.keyPrefix}burst:${identifier}`;
    const burstCount = await this.redis.get(burstKey);
    const currentBurst = burstCount ? parseInt(burstCount, 10) : 0;

    // Determine if request is allowed
    const allowed =
      windows.minute.count < limits.requestsPerMinute &&
      windows.hour.count < limits.requestsPerHour &&
      windows.day.count < limits.requestsPerDay &&
      currentBurst < limits.burstLimit;

    if (allowed) {
      // Increment counters
      await this.incrementWindows(identifier, windows);
      await this.incrementBurst(identifier);
    } else {
      // Track blocked request
      this.trackBlocked(identifier, ip, endpoint);
    }

    // Update metrics
    this.metrics.totalRequests++;
    if (!allowed) {
      this.metrics.blockedRequests++;
    }
    if (endpoint) {
      if (!this.metrics.endpointStats[endpoint]) {
        this.metrics.endpointStats[endpoint] = { requests: 0, blocked: 0 };
      }
      this.metrics.endpointStats[endpoint].requests++;
      if (!allowed) {
        this.metrics.endpointStats[endpoint].blocked++;
      }
    }

    // Calculate most restrictive limit
    const minuteRemaining = limits.requestsPerMinute - windows.minute.count;
    const hourRemaining = limits.requestsPerHour - windows.hour.count;
    const dayRemaining = limits.requestsPerDay - windows.day.count;
    const burstRemaining = limits.burstLimit - currentBurst;

    const remaining = Math.min(minuteRemaining, hourRemaining, dayRemaining, burstRemaining);
    const reset = Math.min(windows.minute.reset, windows.hour.reset, windows.day.reset);

    return {
      allowed,
      limit: limits.requestsPerMinute,
      remaining: Math.max(0, remaining),
      reset,
      retryAfter: allowed ? undefined : Math.ceil((reset - now) / 1000)
    };
  }

  /**
   * Get current rate limit windows for identifier
   */
  private async getWindows(identifier: string): Promise<RateLimitWindow> {
    const minuteKey = `${this.keyPrefix}minute:${identifier}`;
    const hourKey = `${this.keyPrefix}hour:${identifier}`;
    const dayKey = `${this.keyPrefix}day:${identifier}`;

    const [minuteData, hourData, dayData] = await Promise.all([
      this.redis!.get(minuteKey),
      this.redis!.get(hourKey),
      this.redis!.get(dayKey)
    ]);

    const now = Date.now();

    return {
      minute: minuteData ? JSON.parse(minuteData) : { count: 0, reset: now + 60000 },
      hour: hourData ? JSON.parse(hourData) : { count: 0, reset: now + 3600000 },
      day: dayData ? JSON.parse(dayData) : { count: 0, reset: now + 86400000 }
    };
  }

  /**
   * Increment rate limit windows
   */
  private async incrementWindows(identifier: string, windows: RateLimitWindow): Promise<void> {
    const minuteKey = `${this.keyPrefix}minute:${identifier}`;
    const hourKey = `${this.keyPrefix}hour:${identifier}`;
    const dayKey = `${this.keyPrefix}day:${identifier}`;

    windows.minute.count++;
    windows.hour.count++;
    windows.day.count++;

    const pipeline = this.redis!.multi();
    pipeline.setEx(minuteKey, 60, JSON.stringify(windows.minute));
    pipeline.setEx(hourKey, 3600, JSON.stringify(windows.hour));
    pipeline.setEx(dayKey, 86400, JSON.stringify(windows.day));
    await pipeline.exec();
  }

  /**
   * Increment burst counter
   */
  private async incrementBurst(identifier: string): Promise<void> {
    const burstKey = `${this.keyPrefix}burst:${identifier}`;
    const current = await this.redis!.incr(burstKey);
    if (current === 1) {
      await this.redis!.expire(burstKey, 1); // Expire after 1 second
    }
  }

  /**
   * Track blocked request for abuse detection
   */
  private trackBlocked(identifier: string, ip?: string, endpoint?: string): void {
    // Track by user identifier
    const userCount = this.limitedUsers.get(identifier) || 0;
    this.limitedUsers.set(identifier, userCount + 1);

    // Track by IP
    if (ip) {
      const ipCount = this.limitedIPs.get(ip) || 0;
      this.limitedIPs.set(ip, ipCount + 1);
    }

    // Update top limited users/IPs
    this.updateTopLimited();
  }

  /**
   * Update top limited users and IPs
   */
  private updateTopLimited(): void {
    this.metrics.topLimitedUsers = Array.from(this.limitedUsers.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([identifier, count]) => ({ identifier, count }));

    this.metrics.topLimitedIPs = Array.from(this.limitedIPs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
  }

  /**
   * Get rate limit metrics
   */
  getMetrics(): RateLimitMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      topLimitedUsers: [],
      topLimitedIPs: [],
      endpointStats: {}
    };
    this.limitedUsers.clear();
    this.limitedIPs.clear();
  }

  /**
   * Check if identifier is whitelisted
   */
  isWhitelisted(identifier: string): boolean {
    return this.config.whitelist?.includes(identifier) || false;
  }

  /**
   * Check if endpoint is exempt from rate limiting
   */
  isExempt(endpoint: string): boolean {
    return this.config.healthCheckExempt?.some(exempt => endpoint.startsWith(exempt)) || false;
  }
}

/**
 * Create rate limit middleware for Fastify
 */
export function createRateLimitMiddleware(rateLimiter: RateLimiter) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const endpoint = request.url;
    const ip = request.ip;

    // Check if endpoint is exempt
    if (rateLimiter.isExempt(endpoint)) {
      return;
    }

    // Determine identifier (user ID or IP)
    let identifier: string;
    let tier: string;

    if (request.user?.userId) {
      // Authenticated user
      identifier = `user:${request.user.userId}`;
      tier = request.user.tier || "free";
    } else {
      // Unauthenticated - use IP
      identifier = `ip:${ip}`;
      tier = "free";
    }

    // Check whitelist
    if (rateLimiter.isWhitelisted(identifier)) {
      return;
    }

    // Check admin bypass
    const adminToken = request.headers["x-admin-token"];
    if (adminToken && rateLimiter.config.adminBypass) {
      return;
    }

    // Check rate limit
    const result = await rateLimiter.checkLimit(identifier, tier, endpoint, ip);

    // Set rate limit headers
    reply.header("X-RateLimit-Limit", result.limit.toString());
    reply.header("X-RateLimit-Remaining", result.remaining.toString());
    reply.header("X-RateLimit-Reset", result.reset.toString());

    if (!result.allowed) {
      if (result.retryAfter) {
        reply.header("Retry-After", result.retryAfter.toString());
      }

      return reply.status(429).send({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
          correlationId: request.id,
          retryAfter: result.retryAfter,
          limit: result.limit,
          reset: new Date(result.reset).toISOString()
        }
      });
    }
  };
}

/**
 * Create WebSocket connection rate limiter
 */
export class WebSocketRateLimiter {
  private connections = new Map<string, number>();
  private readonly maxConnectionsPerUser: number;
  private readonly maxConnectionsPerIP: number;

  constructor(options: {
    maxConnectionsPerUser?: number;
    maxConnectionsPerIP?: number;
  } = {}) {
    this.maxConnectionsPerUser = options.maxConnectionsPerUser || 5;
    this.maxConnectionsPerIP = options.maxConnectionsPerIP || 10;
  }

  /**
   * Check if connection is allowed
   */
  canConnect(identifier: string, isUser: boolean): boolean {
    const maxConnections = isUser ? this.maxConnectionsPerUser : this.maxConnectionsPerIP;
    const currentConnections = this.connections.get(identifier) || 0;
    return currentConnections < maxConnections;
  }

  /**
   * Register new connection
   */
  connect(identifier: string): void {
    const current = this.connections.get(identifier) || 0;
    this.connections.set(identifier, current + 1);
  }

  /**
   * Unregister connection
   */
  disconnect(identifier: string): void {
    const current = this.connections.get(identifier) || 0;
    if (current > 0) {
      this.connections.set(identifier, current - 1);
    }
    if (current <= 1) {
      this.connections.delete(identifier);
    }
  }

  /**
   * Get connection count for identifier
   */
  getConnectionCount(identifier: string): number {
    return this.connections.get(identifier) || 0;
  }

  /**
   * Get all connection stats
   */
  getStats(): Array<{ identifier: string; connections: number }> {
    return Array.from(this.connections.entries())
      .map(([identifier, connections]) => ({ identifier, connections }))
      .sort((a, b) => b.connections - a.connections);
  }
}

/**
 * Abuse detection system
 */
export class AbuseDetector {
  private suspiciousIPs = new Set<string>();
  private suspiciousUsers = new Set<string>();
  private readonly rateLimiter: RateLimiter;
  private readonly thresholds: {
    blockedRequestsPerHour: number;
    blockedRequestsPerDay: number;
  };

  constructor(
    rateLimiter: RateLimiter,
    thresholds?: {
      blockedRequestsPerHour?: number;
      blockedRequestsPerDay?: number;
    }
  ) {
    this.rateLimiter = rateLimiter;
    this.thresholds = {
      blockedRequestsPerHour: thresholds?.blockedRequestsPerHour || 100,
      blockedRequestsPerDay: thresholds?.blockedRequestsPerDay || 500
    };
  }

  /**
   * Analyze metrics for abuse patterns
   */
  analyze(): void {
    const metrics = this.rateLimiter.getMetrics();

    // Check top limited IPs
    for (const { ip, count } of metrics.topLimitedIPs) {
      if (count > this.thresholds.blockedRequestsPerHour) {
        this.suspiciousIPs.add(ip);
        logger.warn({ ip, count }, "Suspicious IP detected - excessive rate limit hits");
      }
    }

    // Check top limited users
    for (const { identifier, count } of metrics.topLimitedUsers) {
      if (count > this.thresholds.blockedRequestsPerHour) {
        this.suspiciousUsers.add(identifier);
        logger.warn({ identifier, count }, "Suspicious user detected - excessive rate limit hits");
      }
    }
  }

  /**
   * Check if IP is suspicious
   */
  isSuspiciousIP(ip: string): boolean {
    return this.suspiciousIPs.has(ip);
  }

  /**
   * Check if user is suspicious
   */
  isSuspiciousUser(identifier: string): boolean {
    return this.suspiciousUsers.has(identifier);
  }

  /**
   * Get all suspicious IPs
   */
  getSuspiciousIPs(): string[] {
    return Array.from(this.suspiciousIPs);
  }

  /**
   * Get all suspicious users
   */
  getSuspiciousUsers(): string[] {
    return Array.from(this.suspiciousUsers);
  }

  /**
   * Clear suspicious flags
   */
  clear(): void {
    this.suspiciousIPs.clear();
    this.suspiciousUsers.clear();
  }

  /**
   * Manually flag IP as suspicious
   */
  flagIP(ip: string): void {
    this.suspiciousIPs.add(ip);
    logger.info({ ip }, "IP manually flagged as suspicious");
  }

  /**
   * Manually flag user as suspicious
   */
  flagUser(identifier: string): void {
    this.suspiciousUsers.add(identifier);
    logger.info({ identifier }, "User manually flagged as suspicious");
  }

  /**
   * Remove IP from suspicious list
   */
  unflagIP(ip: string): void {
    this.suspiciousIPs.delete(ip);
    logger.info({ ip }, "IP unflagged");
  }

  /**
   * Remove user from suspicious list
   */
  unflagUser(identifier: string): void {
    this.suspiciousUsers.delete(identifier);
    logger.info({ identifier }, "User unflagged");
  }
}

/**
 * Rate limit configuration builder
 */
export class RateLimitConfigBuilder {
  private config: Partial<RateLimitConfig> = {};

  withRedis(url: string, keyPrefix?: string): this {
    this.config.redis = { url, keyPrefix };
    return this;
  }

  withTiers(tiers: Record<string, RateLimitTier>): this {
    this.config.tiers = tiers;
    return this;
  }

  withDefaultTier(tier: string): this {
    this.config.defaultTier = tier;
    return this;
  }

  withEndpointLimits(limits: Record<string, Partial<RateLimitTier>>): this {
    this.config.endpointLimits = limits;
    return this;
  }

  withWhitelist(whitelist: string[]): this {
    this.config.whitelist = whitelist;
    return this;
  }

  withAdminBypass(enabled: boolean): this {
    this.config.adminBypass = enabled;
    return this;
  }

  withHealthCheckExempt(endpoints: string[]): this {
    this.config.healthCheckExempt = endpoints;
    return this;
  }

  build(): RateLimitConfig {
    return {
      tiers: this.config.tiers || DEFAULT_TIERS,
      defaultTier: this.config.defaultTier || "free",
      redis: this.config.redis,
      endpointLimits: this.config.endpointLimits,
      whitelist: this.config.whitelist,
      adminBypass: this.config.adminBypass,
      healthCheckExempt: this.config.healthCheckExempt
    };
  }
}

/**
 * Export default configuration
 */
export const defaultRateLimitConfig: RateLimitConfig = {
  tiers: DEFAULT_TIERS,
  defaultTier: "free",
  endpointLimits: DEFAULT_ENDPOINT_LIMITS,
  whitelist: [],
  adminBypass: true,
  healthCheckExempt: ["/health", "/metrics"]
};