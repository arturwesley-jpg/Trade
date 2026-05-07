import type { Client } from 'pg';
import { logger } from '../logger.js';

export interface LoadTestConfig {
  name: string;
  duration: number; // seconds
  concurrency: number;
  rampUp?: number; // seconds
  endpoint?: string;
  requestGenerator: () => Promise<void>;
}

export interface LoadTestResult {
  name: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errors: Array<{ message: string; count: number }>;
}

export class LoadTester {
  private results: number[] = [];
  private errors: Map<string, number> = new Map();
  private successCount = 0;
  private failCount = 0;

  async run(config: LoadTestConfig): Promise<LoadTestResult> {
    logger.info({ name: config.name, duration: config.duration, concurrency: config.concurrency }, 'Starting load test');

    const startTime = Date.now();
    const endTime = startTime + config.duration * 1000;
    const rampUpTime = config.rampUp ? config.rampUp * 1000 : 0;

    this.reset();

    const workers: Promise<void>[] = [];

    // Ramp up workers gradually
    for (let i = 0; i < config.concurrency; i++) {
      const delay = rampUpTime > 0 ? (i / config.concurrency) * rampUpTime : 0;

      workers.push(
        this.worker(config.requestGenerator, endTime, delay)
      );
    }

    await Promise.all(workers);

    const duration = (Date.now() - startTime) / 1000;
    return this.buildResult(config.name, duration);
  }

  private async worker(
    requestGenerator: () => Promise<void>,
    endTime: number,
    delay: number
  ): Promise<void> {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    while (Date.now() < endTime) {
      const start = Date.now();
      try {
        await requestGenerator();
        const duration = Date.now() - start;
        this.results.push(duration);
        this.successCount++;
      } catch (error) {
        const duration = Date.now() - start;
        this.results.push(duration);
        this.failCount++;

        const message = error instanceof Error ? error.message : 'Unknown error';
        this.errors.set(message, (this.errors.get(message) ?? 0) + 1);
      }
    }
  }

  private buildResult(name: string, duration: number): LoadTestResult {
    const sorted = this.results.sort((a, b) => a - b);
    const total = this.successCount + this.failCount;

    return {
      name,
      duration,
      totalRequests: total,
      successfulRequests: this.successCount,
      failedRequests: this.failCount,
      requestsPerSecond: total / duration,
      avgResponseTime: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      minResponseTime: sorted[0] ?? 0,
      maxResponseTime: sorted[sorted.length - 1] ?? 0,
      p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
      errors: Array.from(this.errors.entries()).map(([message, count]) => ({
        message,
        count,
      })),
    };
  }

  private reset(): void {
    this.results = [];
    this.errors.clear();
    this.successCount = 0;
    this.failCount = 0;
  }
}

// Database load testing
export class DatabaseLoadTester {
  constructor(private client: Client) {}

  async testQuery(
    query: string,
    params: any[],
    config: { duration: number; concurrency: number }
  ): Promise<LoadTestResult> {
    const tester = new LoadTester();

    return tester.run({
      name: 'Database Query Load Test',
      duration: config.duration,
      concurrency: config.concurrency,
      requestGenerator: async () => {
        await this.client.query(query, params);
      },
    });
  }

  async testInserts(
    table: string,
    dataGenerator: () => Record<string, any>,
    config: { duration: number; concurrency: number }
  ): Promise<LoadTestResult> {
    const tester = new LoadTester();

    return tester.run({
      name: 'Database Insert Load Test',
      duration: config.duration,
      concurrency: config.concurrency,
      requestGenerator: async () => {
        const data = dataGenerator();
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        await this.client.query(query, values);
      },
    });
  }

  async testConnectionPool(
    config: { duration: number; concurrency: number }
  ): Promise<LoadTestResult> {
    const tester = new LoadTester();

    return tester.run({
      name: 'Connection Pool Load Test',
      duration: config.duration,
      concurrency: config.concurrency,
      requestGenerator: async () => {
        await this.client.query('SELECT 1');
      },
    });
  }
}

// Benchmark helper
export class Benchmark {
  static async compare(
    name: string,
    implementations: Array<{ name: string; fn: () => Promise<void> }>,
    iterations: number = 1000
  ): Promise<Array<{ name: string; avgTime: number; opsPerSec: number }>> {
    logger.info({ name, iterations }, 'Starting benchmark comparison');

    const results: Array<{ name: string; avgTime: number; opsPerSec: number }> = [];

    for (const impl of implementations) {
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await impl.fn();
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const opsPerSec = 1000 / avgTime;

      results.push({
        name: impl.name,
        avgTime,
        opsPerSec,
      });

      logger.info({ name: impl.name, avgTime, opsPerSec }, 'Benchmark result');
    }

    return results.sort((a, b) => a.avgTime - b.avgTime);
  }
}
