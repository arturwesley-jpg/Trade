import type { Client, QueryResult } from 'pg';
import { logger } from '../logger.js';

export interface QueryMetrics {
  query: string;
  duration: number;
  rows: number;
  timestamp: number;
}

export interface SlowQuery extends QueryMetrics {
  planningTime?: number;
  executionTime?: number;
  plan?: any;
}

export class QueryOptimizer {
  private slowQueryThreshold: number;
  private slowQueries: SlowQuery[] = [];
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold; // ms
  }

  async executeWithMetrics<T = any>(
    client: Client,
    query: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();

    try {
      const result = await client.query<T>(query, params);
      const duration = Date.now() - start;

      // Record metrics
      this.recordMetrics(query, duration, result.rowCount ?? 0);

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        await this.analyzeSlowQuery(client, query, params, duration);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error({ query, duration, error }, 'Query execution failed');
      throw error;
    }
  }

  private recordMetrics(query: string, duration: number, rows: number): void {
    const normalizedQuery = this.normalizeQuery(query);

    if (!this.queryMetrics.has(normalizedQuery)) {
      this.queryMetrics.set(normalizedQuery, []);
    }

    const metrics: QueryMetrics = {
      query: normalizedQuery,
      duration,
      rows,
      timestamp: Date.now()
    };

    const queryHistory = this.queryMetrics.get(normalizedQuery)!;
    queryHistory.push(metrics);

    // Keep only last 100 executions per query
    if (queryHistory.length > 100) {
      queryHistory.shift();
    }
  }

  private async analyzeSlowQuery(
    client: Client,
    query: string,
    params: any[] | undefined,
    duration: number
  ): Promise<void> {
    try {
      // Get query plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const planResult = await client.query(explainQuery, params);
      const plan = planResult.rows[0]['QUERY PLAN'][0];

      const slowQuery: SlowQuery = {
        query: this.normalizeQuery(query),
        duration,
        rows: 0,
        timestamp: Date.now(),
        planningTime: plan['Planning Time'],
        executionTime: plan['Execution Time'],
        plan: plan.Plan
      };

      this.slowQueries.push(slowQuery);

      // Keep only last 50 slow queries
      if (this.slowQueries.length > 50) {
        this.slowQueries.shift();
      }

      logger.warn({
        query: slowQuery.query,
        duration,
        planningTime: slowQuery.planningTime,
        executionTime: slowQuery.executionTime
      }, 'Slow query detected');

    } catch (error) {
      logger.error({ error }, 'Failed to analyze slow query');
    }
  }

  private normalizeQuery(query: string): string {
    // Remove extra whitespace and normalize
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?') // Replace parameter placeholders
      .trim();
  }

  getSlowQueries(): SlowQuery[] {
    return [...this.slowQueries];
  }

  getQueryStats(query: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
  } | null {
    const normalizedQuery = this.normalizeQuery(query);
    const metrics = this.queryMetrics.get(normalizedQuery);

    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);
    const p95Index = Math.floor(durations.length * 0.95);

    return {
      count: metrics.length,
      avgDuration: sum / metrics.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[p95Index]
    };
  }

  getAllStats(): Array<{
    query: string;
    stats: ReturnType<typeof this.getQueryStats>;
  }> {
    const results: Array<{
      query: string;
      stats: ReturnType<typeof this.getQueryStats>;
    }> = [];

    for (const [query] of this.queryMetrics) {
      const stats = this.getQueryStats(query);
      if (stats) {
        results.push({ query, stats });
      }
    }

    return results.sort((a, b) => (b.stats?.avgDuration ?? 0) - (a.stats?.avgDuration ?? 0));
  }

  clearMetrics(): void {
    this.queryMetrics.clear();
    this.slowQueries = [];
  }
}

// Connection pool optimizer
export class ConnectionPoolOptimizer {
  static getRecommendedPoolSize(options: {
    maxConnections: number;
    cpuCores: number;
    avgQueryTime: number; // ms
    requestsPerSecond: number;
  }): {
    min: number;
    max: number;
    idleTimeout: number;
  } {
    const { maxConnections, cpuCores, avgQueryTime, requestsPerSecond } = options;

    // Calculate concurrent queries
    const concurrentQueries = (requestsPerSecond * avgQueryTime) / 1000;

    // Recommended pool size
    const recommended = Math.ceil(concurrentQueries * 1.5);
    const max = Math.min(recommended, maxConnections, cpuCores * 2);
    const min = Math.max(2, Math.floor(max / 4));

    return {
      min,
      max,
      idleTimeout: 30000 // 30 seconds
    };
  }

  static async analyzePoolUsage(client: Client): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
    utilizationPct: number;
  }> {
    const result = await client.query(`
      SELECT
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections
    `);

    const row = result.rows[0];
    const utilizationPct = (row.total_connections / row.max_connections) * 100;

    return {
      totalConnections: row.total_connections,
      activeConnections: row.active_connections,
      idleConnections: row.idle_connections,
      maxConnections: row.max_connections,
      utilizationPct: Math.round(utilizationPct * 100) / 100
    };
  }
}
