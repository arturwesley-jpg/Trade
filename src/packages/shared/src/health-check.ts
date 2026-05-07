/**
 * Health Check System
 * Comprehensive health checks for all system components
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  status: HealthStatus;
  uptime: number;
  timestamp: number;
  components: ComponentHealth[];
}

export type HealthCheckFunction = () => Promise<HealthCheckResult>;

export class HealthChecker {
  private checks = new Map<string, HealthCheckFunction>();
  private startTime = Date.now();

  /**
   * Register a health check
   */
  register(name: string, checkFn: HealthCheckFunction): void {
    this.checks.set(name, checkFn);
  }

  /**
   * Run all health checks
   */
  async check(): Promise<SystemHealth> {
    const components: ComponentHealth[] = [];
    
    for (const [name, checkFn] of this.checks.entries()) {
      const start = Date.now();
      try {
        const result = await Promise.race([
          checkFn(),
          this.timeout(5000, name)
        ]);
        
        components.push({
          name,
          status: result.status,
          message: result.message,
          responseTime: Date.now() - start,
          details: result.details
        });
      } catch (error) {
        components.push({
          name,
          status: "unhealthy",
          message: error instanceof Error ? error.message : "Health check failed",
          responseTime: Date.now() - start
        });
      }
    }

    const overallStatus = this.calculateOverallStatus(components);
    
    return {
      status: overallStatus,
      uptime: Date.now() - this.startTime,
      timestamp: Date.now(),
      components
    };
  }

  /**
   * Quick liveness check (always returns healthy if process is running)
   */
  async liveness(): Promise<HealthCheckResult> {
    return {
      status: "healthy",
      message: "Service is alive",
      timestamp: Date.now()
    };
  }

  /**
   * Readiness check (checks if service is ready to accept traffic)
   */
  async readiness(): Promise<HealthCheckResult> {
    const health = await this.check();
    const criticalComponents = health.components.filter(c => 
      ["database", "redis", "api"].includes(c.name.toLowerCase())
    );
    
    const allCriticalHealthy = criticalComponents.every(c => c.status === "healthy");
    
    return {
      status: allCriticalHealthy ? "healthy" : "unhealthy",
      message: allCriticalHealthy ? "Service is ready" : "Service is not ready",
      details: { components: criticalComponents },
      timestamp: Date.now()
    };
  }

  private calculateOverallStatus(components: ComponentHealth[]): HealthStatus {
    if (components.length === 0) return "healthy";
    
    const hasUnhealthy = components.some(c => c.status === "unhealthy");
    const hasDegraded = components.some(c => c.status === "degraded");
    
    if (hasUnhealthy) return "unhealthy";
    if (hasDegraded) return "degraded";
    return "healthy";
  }

  private timeout(ms: number, name: string): Promise<HealthCheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout: ${name}`)), ms);
    });
  }
}

/**
 * Database health check
 */
export async function checkDatabase(db: any): Promise<HealthCheckResult> {
  try {
    const start = Date.now();
    await db.execute("SELECT 1");
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 100 ? "healthy" : "degraded",
      message: `Database responding in ${responseTime}ms`,
      details: { responseTime },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Database connection failed",
      timestamp: Date.now()
    };
  }
}

/**
 * Redis health check
 */
export async function checkRedis(redis: any): Promise<HealthCheckResult> {
  try {
    const start = Date.now();
    await redis.ping();
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 50 ? "healthy" : "degraded",
      message: `Redis responding in ${responseTime}ms`,
      details: { responseTime },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Redis connection failed",
      timestamp: Date.now()
    };
  }
}

/**
 * Memory health check
 */
export async function checkMemory(): Promise<HealthCheckResult> {
  const usage = process.memoryUsage();
  const heapUsedPct = (usage.heapUsed / usage.heapTotal) * 100;
  
  let status: HealthStatus = "healthy";
  if (heapUsedPct > 90) status = "unhealthy";
  else if (heapUsedPct > 75) status = "degraded";
  
  return {
    status,
    message: `Heap usage: ${heapUsedPct.toFixed(1)}%`,
    details: {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    },
    timestamp: Date.now()
  };
}

/**
 * Register PostgreSQL health check
 */
export function registerPostgres(healthChecker: HealthChecker, client: { query: (text: string) => Promise<unknown> }): void {
  healthChecker.register("postgres", async () => {
    try {
      const start = Date.now();
      await client.query("SELECT 1");
      const responseTime = Date.now() - start;

      return {
        status: responseTime < 100 ? "healthy" : "degraded",
        message: `PostgreSQL responding in ${responseTime}ms`,
        details: { responseTime },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "PostgreSQL connection failed",
        timestamp: Date.now()
      };
    }
  });
}

/**
 * Register Redis health check
 */
export function registerRedis(healthChecker: HealthChecker, cache: { isConnected: () => boolean; set: (key: string, value: unknown, ttl: number) => Promise<void>; get: <T>(key: string) => Promise<T | null>; del: (key: string) => Promise<void> }): void {
  healthChecker.register("redis", async () => {
    try {
      const start = Date.now();

      if (!cache.isConnected()) {
        return {
          status: "unhealthy",
          message: "Redis not connected",
          timestamp: Date.now()
        };
      }

      const testKey = "health:check";
      const testValue = Date.now().toString();
      await cache.set(testKey, testValue, 10);
      const retrieved = await cache.get<string>(testKey);
      await cache.del(testKey);

      const responseTime = Date.now() - start;

      if (retrieved !== testValue) {
        return {
          status: "degraded",
          message: "Redis read/write mismatch",
          details: { responseTime },
          timestamp: Date.now()
        };
      }

      return {
        status: responseTime < 50 ? "healthy" : "degraded",
        message: `Redis responding in ${responseTime}ms`,
        details: { responseTime },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Redis check failed",
        timestamp: Date.now()
      };
    }
  });
}

/**
 * Default health checker instance
 */
export const healthChecker = new HealthChecker();
export const healthCheck = healthChecker;
