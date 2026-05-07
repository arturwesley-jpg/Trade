/**
 * Health Check System
 * Comprehensive health checks for liveness and readiness probes
 */

import type { Client } from "pg";
import type { Redis } from "ioredis";

export interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  message?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface DependencyHealth {
  name: string;
  status: "up" | "down" | "degraded";
  latency?: number;
  message?: string;
  details?: Record<string, any>;
}

export interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version?: string;
  dependencies: DependencyHealth[];
}

export interface HealthCheckOptions {
  pgClient?: Client;
  redisClient?: Redis;
  timeout?: number;
}

/**
 * Health Check Manager
 */
export class HealthCheckManager {
  private startTime: number;
  private pgClient?: Client;
  private redisClient?: Redis;
  private timeout: number;

  constructor(options: HealthCheckOptions = {}) {
    this.startTime = Date.now();
    this.pgClient = options.pgClient;
    this.redisClient = options.redisClient;
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Liveness probe - checks if the application is running
   * Should return 200 if the app is alive, even if dependencies are down
   */
  async checkLiveness(): Promise<HealthCheckResult> {
    try {
      // Basic check - if we can execute this code, we're alive
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      return {
        status: "healthy",
        message: "Application is running",
        details: {
          uptime: this.getUptime(),
          memory: {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${heapTotalMB}MB`,
            heapUsedPercent: Math.round((heapUsedMB / heapTotalMB) * 100)
          },
          pid: process.pid
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Readiness probe - checks if the application is ready to serve traffic
   * Should return 200 only if all critical dependencies are healthy
   */
  async checkReadiness(): Promise<HealthStatus> {
    const dependencies: DependencyHealth[] = [];

    // Check PostgreSQL
    if (this.pgClient) {
      dependencies.push(await this.checkPostgres());
    }

    // Check Redis
    if (this.redisClient) {
      dependencies.push(await this.checkRedis());
    }

    // Check external APIs (optional)
    dependencies.push(await this.checkExternalApis());

    // Determine overall status
    const hasUnhealthy = dependencies.some(dep => dep.status === "down");
    const hasDegraded = dependencies.some(dep => dep.status === "degraded");

    let status: "healthy" | "unhealthy" | "degraded";
    if (hasUnhealthy) {
      status = "unhealthy";
    } else if (hasDegraded) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      version: process.env.APP_VERSION ?? "unknown",
      dependencies
    };
  }

  /**
   * Check PostgreSQL connection
   */
  private async checkPostgres(): Promise<DependencyHealth> {
    if (!this.pgClient) {
      return {
        name: "postgresql",
        status: "down",
        message: "PostgreSQL client not configured"
      };
    }

    const startTime = Date.now();

    try {
      await Promise.race([
        this.pgClient.query("SELECT 1"),
        this.timeoutPromise()
      ]);

      const latency = Date.now() - startTime;

      return {
        name: "postgresql",
        status: latency > 1000 ? "degraded" : "up",
        latency,
        message: latency > 1000 ? "High latency detected" : "Connected"
      };
    } catch (error) {
      return {
        name: "postgresql",
        status: "down",
        message: error instanceof Error ? error.message : "Connection failed",
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(): Promise<DependencyHealth> {
    if (!this.redisClient) {
      return {
        name: "redis",
        status: "down",
        message: "Redis client not configured"
      };
    }

    const startTime = Date.now();

    try {
      await Promise.race([
        this.redisClient.ping(),
        this.timeoutPromise()
      ]);

      const latency = Date.now() - startTime;

      return {
        name: "redis",
        status: latency > 500 ? "degraded" : "up",
        latency,
        message: latency > 500 ? "High latency detected" : "Connected"
      };
    } catch (error) {
      return {
        name: "redis",
        status: "down",
        message: error instanceof Error ? error.message : "Connection failed",
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Check external APIs (placeholder)
   */
  private async checkExternalApis(): Promise<DependencyHealth> {
    // This is a placeholder - in production, you'd check actual external APIs
    return {
      name: "external_apis",
      status: "up",
      message: "External APIs accessible"
    };
  }

  /**
   * Get application uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Create a timeout promise
   */
  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Health check timeout")), this.timeout);
    });
  }
}

/**
 * Create health check routes for Fastify
 */
export function createHealthCheckRoutes(manager: HealthCheckManager) {
  return async (fastify: any) => {
    // Liveness probe
    fastify.get("/health/live", async (request: any, reply: any) => {
      const result = await manager.checkLiveness();

      if (result.status === "healthy") {
        return reply.status(200).send(result);
      } else {
        return reply.status(503).send(result);
      }
    });

    // Readiness probe
    fastify.get("/health/ready", async (request: any, reply: any) => {
      const result = await manager.checkReadiness();

      if (result.status === "healthy") {
        return reply.status(200).send(result);
      } else if (result.status === "degraded") {
        return reply.status(200).send(result); // Still serve traffic but warn
      } else {
        return reply.status(503).send(result);
      }
    });

    // Detailed health check (for monitoring)
    fastify.get("/health", async (request: any, reply: any) => {
      const liveness = await manager.checkLiveness();
      const readiness = await manager.checkReadiness();

      return reply.status(200).send({
        liveness,
        readiness
      });
    });
  };
}
