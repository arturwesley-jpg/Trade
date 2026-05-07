import type { FastifyRequest } from "fastify";

export interface CorsConfig {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

/**
 * CORS configuration for production security
 */
export function createCorsConfig(config: CorsConfig = {}) {
  const allowedOrigins = config.allowedOrigins ?? [
    process.env.WEB_ORIGIN ?? "http://localhost:3000"
  ];

  return {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: config.allowCredentials ?? true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-API-Key",
      "X-Admin-Token"
    ],
    exposedHeaders: [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset"
    ],
    maxAge: config.maxAge ?? 86400 // 24 hours
  };
}

/**
 * Validate origin for WebSocket connections
 */
export function validateWebSocketOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes("*")) {
    return true;
  }

  return allowedOrigins.includes(origin);
}
