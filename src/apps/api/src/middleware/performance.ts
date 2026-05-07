/**
 * Backend Performance Middleware
 * Tracks API request performance and database queries
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { performanceMonitor } from '@trade/shared/monitoring/performance-monitor';

/**
 * Fastify hook to track API request performance
 */
export function registerPerformanceHooks(app: any) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    (request as any).startTime = Date.now();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any).startTime;
    if (startTime) {
      const duration = Date.now() - startTime;

      performanceMonitor.recordAPICall({
        endpoint: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        duration,
        timestamp: Date.now(),
        error: reply.statusCode >= 400 ? 'true' : undefined
      });

      // Alert on slow requests
      if (duration > 1000) {
        console.warn(`Slow request detected: ${request.method} ${request.url} took ${duration}ms`);
      }
    }
  });
}

/**
 * Database query performance tracker
 */
export class DatabasePerformanceTracker {
  private queryTimes: number[] = [];
  private slowQueryThreshold = 500; // ms
  private maxTrackedQueries = 1000;

  /**
   * Track a database query
   */
  trackQuery(query: string, duration: number): void {
    this.queryTimes.push(duration);

    // Keep only recent queries
    if (this.queryTimes.length > this.maxTrackedQueries) {
      this.queryTimes.shift();
    }

    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      console.warn(`Slow query detected (${duration}ms):`, query.substring(0, 100));
    }

    // Record metric
    performanceMonitor.record({
      name: 'db_query_duration',
      value: duration,
      unit: 'ms',
      tags: {
        slow: duration > this.slowQueryThreshold ? 'true' : 'false'
      }
    });
  }

  /**
   * Get database metrics
   */
  getMetrics() {
    if (this.queryTimes.length === 0) {
      return {
        queryCount: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        maxQueryTime: 0,
        minQueryTime: 0
      };
    }

    const sum = this.queryTimes.reduce((acc, time) => acc + time, 0);
    const slowQueries = this.queryTimes.filter(t => t > this.slowQueryThreshold).length;

    return {
      queryCount: this.queryTimes.length,
      averageQueryTime: sum / this.queryTimes.length,
      slowQueries,
      maxQueryTime: Math.max(...this.queryTimes),
      minQueryTime: Math.min(...this.queryTimes)
    };
  }

  /**
   * Clear tracked queries
   */
  clear(): void {
    this.queryTimes = [];
  }
}

/**
 * PostgreSQL client wrapper with performance tracking
 */
export function wrapPostgresClient(client: any, tracker: DatabasePerformanceTracker) {
  const originalQuery = client.query.bind(client);

  client.query = async function (...args: any[]) {
    const startTime = Date.now();
    try {
      const result = await originalQuery(...args);
      const duration = Date.now() - startTime;

      // Extract query text
      const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text || 'unknown';
      tracker.trackQuery(queryText, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      tracker.trackQuery('ERROR', duration);
      throw error;
    }
  };

  return client;
}

/**
 * WebSocket performance tracker
 */
export class WebSocketPerformanceTracker {
  private connections = 0;
  private messagesReceived = 0;
  private messagesSent = 0;
  private reconnections = 0;
  private errors = 0;
  private latencies: number[] = [];
  private maxLatencies = 100;

  incrementConnections(): void {
    this.connections++;
  }

  decrementConnections(): void {
    this.connections = Math.max(0, this.connections - 1);
  }

  incrementMessagesReceived(): void {
    this.messagesReceived++;
  }

  incrementMessagesSent(): void {
    this.messagesSent++;
  }

  incrementReconnections(): void {
    this.reconnections++;
  }

  incrementErrors(): void {
    this.errors++;
  }

  recordLatency(latency: number): void {
    this.latencies.push(latency);
    if (this.latencies.length > this.maxLatencies) {
      this.latencies.shift();
    }
  }

  getMetrics() {
    const averageLatency = this.latencies.length > 0
      ? this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length
      : 0;

    const metrics = {
      activeConnections: this.connections,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      reconnections: this.reconnections,
      averageLatency,
      errors: this.errors
    };

    // Record to performance monitor
    performanceMonitor.recordWebSocketMetrics(metrics);

    return metrics;
  }

  reset(): void {
    this.messagesReceived = 0;
    this.messagesSent = 0;
    this.reconnections = 0;
    this.errors = 0;
    this.latencies = [];
  }
}

// Singleton instances
export const dbPerformanceTracker = new DatabasePerformanceTracker();
export const wsPerformanceTracker = new WebSocketPerformanceTracker();
