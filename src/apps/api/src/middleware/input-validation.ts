import type { FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import DOMPurify from "isomorphic-dompurify";

/**
 * Input validation and sanitization middleware
 */
export class InputValidator {
  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(obj: any): any {
    if (typeof obj === "string") {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj !== null && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate and sanitize request body
   */
  static validateBody<T extends z.ZodType>(schema: T) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Sanitize input first
        const sanitizedBody = this.sanitizeObject(request.body);

        // Validate with Zod schema
        const validated = schema.parse(sanitizedBody);

        // Replace request body with validated data
        request.body = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.status(400).send({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              correlationId: request.id,
              issues: error.issues
            }
          });
        }

        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            correlationId: request.id
          }
        });
      }
    };
  }

  /**
   * Validate query parameters
   */
  static validateQuery<T extends z.ZodType>(schema: T) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validated = schema.parse(request.query);
        request.query = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.status(400).send({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid query parameters",
              correlationId: request.id,
              issues: error.issues
            }
          });
        }

        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            correlationId: request.id
          }
        });
      }
    };
  }

  /**
   * Validate URL parameters
   */
  static validateParams<T extends z.ZodType>(schema: T) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validated = schema.parse(request.params);
        request.params = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.status(400).send({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid URL parameters",
              correlationId: request.id,
              issues: error.issues
            }
          });
        }

        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid URL parameters",
            correlationId: request.id
          }
        });
      }
    };
  }

  /**
   * Check for SQL injection patterns
   */
  static detectSqlInjection(input: string): boolean {
    const sqlPatterns = [
      /(\bOR\b|\bAND\b).*=.*\b/i,
      /UNION.*SELECT/i,
      /DROP.*TABLE/i,
      /INSERT.*INTO/i,
      /DELETE.*FROM/i,
      /UPDATE.*SET/i,
      /--/,
      /;.*--/,
      /\/\*.*\*\//,
      /xp_cmdshell/i,
      /exec\s*\(/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for XSS patterns
   */
  static detectXss(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<img[^>]+src[^>]*>/i,
      /eval\s*\(/i,
      /expression\s*\(/i
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  static isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
