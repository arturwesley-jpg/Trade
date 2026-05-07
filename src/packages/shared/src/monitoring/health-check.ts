/**
 * Health Check Service
 * Monitors system health and provides health check endpoints
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
  lastCheck?: number;
  metadata?: Record<string, any>;
}

export type HealthCheckFunction = () => Promise<ComponentHealth>;

export class HealthCheckService {
  private checks: Map<string, HealthCheckFunction> = new Map();
  private lastResults: Map<string, ComponentHealth> = new Map();
  private checkInterval?: NodeJS.Timeout;

  /**
   * Register a health check
   */
  register(name: string, check: HealthCheckFunction): void {
    this.checks.set(name, check);
  }

  /**
   * Unregister a health check
   */
  unregister(name: string): void {
    this.checks.delete(name);
    this.lastResults.delete(name);
  }

  /**
   * Run all health checks
   */
  async checkAll(): Promise<HealthCheckResult> {
    const results: Record<string, ComponentHealth> = {};
    const timestamp = Date.now();

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, check]) => {
        try {
          const startTime = Date.now();
          const result = await Promise.race([
            check(),
            this.timeout(5000) // 5s timeout
          ]);
          const latency = Date.now() - startTime;

          const health: ComponentHealth = {
            ...result,
            latency,
            lastCheck: timestamp
          };

          this.lastResults.set(name, health);
          results[name] = health;
        } catch (error) {
          const health: ComponentHealth = {
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Health check failed',
            lastCheck: timestamp
          };

          this.lastResults.set(name, health);
          results[name] = health;
        }
      }
    );

    await Promise.all(checkPromises);

    // Determine overall status
    const statuses = Object.values(results).map(r => r.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp,
      checks: results
    };
  }

  /**
   * Get last health check results (cached)
   */
  getLastResults(): HealthCheckResult {
    const results: Record<string, ComponentHealth> = {};

    this.lastResults.forEach((health, name) => {
      results[name] = health;
    });

    const statuses = Object.values(results).map(r => r.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      checks: results
    };
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkAll().catch(error => {
        console.error('Periodic health check failed:', error);
      });
    }, intervalMs);

    // Run initial check
    this.checkAll().catch(error => {
      console.error('Initial health check failed:', error);
    });
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Liveness check (is the service running?)
   */
  async liveness(): Promise<boolean> {
    return true; // If we can execute this, we're alive
  }

  /**
   * Readiness check (is the service ready to handle requests?)
   */
  async readiness(): Promise<boolean> {
    const result = await this.checkAll();
    return result.status !== 'unhealthy';
  }

  /**
   * Detailed health status
   */
  async detailed(): Promise<HealthCheckResult> {
    return this.checkAll();
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopPeriodicChecks();
    this.checks.clear();
    this.lastResults.clear();
  }
}

// Singleton instance
export const healthChecker = new HealthCheckService();

// Helper functions to register common checks

export function registerPostgres(
  checker: HealthCheckService,
  client: any
): void {
  checker.register('postgres', async () => {
    try {
      const result = await client.query('SELECT 1');
      return {
        status: 'healthy',
        message: 'PostgreSQL connection is healthy'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'PostgreSQL check failed'
      };
    }
  });
}

export function registerRedis(
  checker: HealthCheckService,
  redis: any
): void {
  checker.register('redis', async () => {
    try {
      await redis.ping();
      return {
        status: 'healthy',
        message: 'Redis connection is healthy'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Redis check failed'
      };
    }
  });
}

export function registerWebSocket(
  checker: HealthCheckService,
  getConnectionCount: () => number
): void {
  checker.register('websocket', async () => {
    const connections = getConnectionCount();
    return {
      status: 'healthy',
      message: `WebSocket server is healthy with ${connections} active connections`,
      metadata: { activeConnections: connections }
    };
  });
}

export function registerAPI(
  checker: HealthCheckService,
  baseUrl: string
): void {
  checker.register('api', async () => {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return {
          status: 'healthy',
          message: 'API is responding'
        };
      } else {
        return {
          status: 'degraded',
          message: `API returned status ${response.status}`
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'API check failed'
      };
    }
  });
}
