/**
 * Performance Monitoring Service
 * Tracks frontend and backend performance metrics
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface WebVitalsMetrics {
  // Core Web Vitals
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift

  // Additional metrics
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  TTI?: number; // Time to Interactive
}

export interface APIPerformanceMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  error?: string;
}

export interface WebSocketMetrics {
  activeConnections: number;
  messagesReceived: number;
  messagesSent: number;
  reconnections: number;
  averageLatency: number;
  errors: number;
}

export interface DatabaseMetrics {
  queryCount: number;
  averageQueryTime: number;
  slowQueries: number;
  connectionPoolSize: number;
  activeConnections: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 10000;
  private listeners: Array<(metric: PerformanceMetric) => void> = [];

  /**
   * Record a performance metric
   */
  record(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };

    this.metrics.push(fullMetric);

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(fullMetric));
  }

  /**
   * Record Web Vitals metrics
   */
  recordWebVitals(vitals: WebVitalsMetrics): void {
    Object.entries(vitals).forEach(([name, value]) => {
      if (value !== undefined) {
        this.record({
          name: `web_vitals_${name.toLowerCase()}`,
          value,
          unit: name === 'CLS' ? 'score' : 'ms',
          tags: { type: 'web_vitals' }
        });
      }
    });
  }

  /**
   * Record API performance
   */
  recordAPICall(metrics: APIPerformanceMetrics): void {
    this.record({
      name: 'api_request_duration',
      value: metrics.duration,
      unit: 'ms',
      tags: {
        endpoint: metrics.endpoint,
        method: metrics.method,
        status: metrics.statusCode.toString(),
        error: metrics.error ? 'true' : 'false'
      }
    });
  }

  /**
   * Record WebSocket metrics
   */
  recordWebSocketMetrics(metrics: WebSocketMetrics): void {
    this.record({
      name: 'websocket_active_connections',
      value: metrics.activeConnections,
      unit: 'count',
      tags: { type: 'websocket' }
    });

    this.record({
      name: 'websocket_latency',
      value: metrics.averageLatency,
      unit: 'ms',
      tags: { type: 'websocket' }
    });

    this.record({
      name: 'websocket_reconnections',
      value: metrics.reconnections,
      unit: 'count',
      tags: { type: 'websocket' }
    });
  }

  /**
   * Record database metrics
   */
  recordDatabaseMetrics(metrics: DatabaseMetrics): void {
    this.record({
      name: 'db_query_time',
      value: metrics.averageQueryTime,
      unit: 'ms',
      tags: { type: 'database' }
    });

    this.record({
      name: 'db_slow_queries',
      value: metrics.slowQueries,
      unit: 'count',
      tags: { type: 'database' }
    });

    this.record({
      name: 'db_active_connections',
      value: metrics.activeConnections,
      unit: 'count',
      tags: { type: 'database' }
    });
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, since?: number): PerformanceMetric[] {
    let filtered = this.metrics.filter(m => m.name === name);

    if (since) {
      filtered = filtered.filter(m => m.timestamp >= since);
    }

    return filtered;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(since?: number): PerformanceMetric[] {
    if (since) {
      return this.metrics.filter(m => m.timestamp >= since);
    }
    return [...this.metrics];
  }

  /**
   * Get aggregated statistics for a metric
   */
  getStats(name: string, since?: number): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics(name, since);

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99)
    };
  }

  /**
   * Subscribe to metric events
   */
  subscribe(listener: (metric: PerformanceMetric) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();
