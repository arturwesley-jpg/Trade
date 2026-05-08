import { z } from "zod";

/**
 * Environment variable validation schema
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters"),

  // API
  PORT: z.string().regex(/^\d+$/).default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),

  // Admin
  ADMIN_TOKEN: z.string().min(16).optional(),

  // Exchange API Keys
  BINGX_API_KEY: z.string().optional(),
  BINGX_API_SECRET: z.string().optional(),

  // External API Keys
  COINGECKO_API_KEY: z.string().optional(),
  CRYPTOPANIC_API_KEY: z.string().optional(),

  // Security
  ENABLE_IP_WHITELIST: z.enum(["true", "false"]).default("false"),
  ADMIN_IP_WHITELIST: z.string().default("127.0.0.1,::1"),
  ENABLE_BRUTE_FORCE_PROTECTION: z.enum(["true", "false"]).default("true"),
  MAX_LOGIN_ATTEMPTS: z.string().regex(/^\d+$/).default("5"),
  LOCKOUT_DURATION_MS: z.string().regex(/^\d+$/).default("900000"),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().regex(/^\d+$/).default("100"),
  RATE_LIMIT_WINDOW: z.string().regex(/^\d+$/).default("900000"),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4000"),

  // Session
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").optional(),

  // 2FA
  TWO_FACTOR_ISSUER: z.string().default("TradingPlatform"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLE_AUDIT_LOGGING: z.enum(["true", "false"]).default("true"),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default("development"),

  // Feature Flags
  ENABLE_LIVE_TRADING: z.enum(["true", "false"]).default("false"),
  ENABLE_2FA: z.enum(["true", "false"]).default("true"),
  ENABLE_API_KEY_AUTH: z.enum(["true", "false"]).default("true"),

  // Backup
  BACKUP_ENCRYPTION_KEY: z.string().min(32).optional()
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables on startup
 */
export function validateEnv(): EnvConfig {
  try {
    const validated = envSchema.parse(process.env);
    console.log("✓ Environment variables validated successfully");
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment validation failed:");
      for (const issue of error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }
    throw new Error("Environment validation failed. Check your .env file.");
  }
}

/**
 * Get parsed environment configuration
 */
export function getEnvConfig(): EnvConfig {
  return validateEnv();
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}
