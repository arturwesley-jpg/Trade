import { logger } from '../logger.js';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface AggregatedMetric {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private maxPoints: number;

  constructor(maxPoints: number = 10000) {
    this.maxPoints = maxPoints;
  }

  record(name: string, value: number, tags?: Record<string, string>): void {
    const point: MetricPoint = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const points = this.metrics.get(name)!;
    points.push(point);

    // Keep only last N points
    if (points.length > this.maxPoints) {
      points.shift();
    }
  }

  increment(name: string, value: number = 1): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  decrement(name: string, value: number = 1): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current - value);
  }

  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getMetrics(name: string): MetricPoint[] {
    return this.metrics.get(name) ?? [];
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getGauge(name: string): number {
    return this.gauges.get(name) ?? 0;
  }

  aggregate(name: string, windowMs?: number): AggregatedMetric | null {
    const points = this.getMetrics(name);
    if (points.length === 0) {
      return null;
    }

    // Filter by time window if specified
    const now = Date.now();
    const filtered = windowMs
      ? points.filter((p) => now - p.timestamp <= windowMs)
      : points;

    if (filtered.length === 0) {
      return null;
    }

    const values = filtered.map((p) => p.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);

    return {
      name,
      count: values.length,
      sum,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    };
  }

  getAllAggregates(windowMs?: number): AggregatedMetric[] {
    const results: AggregatedMetric[] = [];
    for (const name of this.metrics.keys()) {
      const agg = this.aggregate(name, windowMs);
      if (agg) {
        results.push(agg);
      }
    }
    return results;
  }

  getAllCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  getAllGauges(): Record<string, number> {
    return Object.fromEntries(this.gauges);
  }

  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
  }

  resetCounter(name: string): void {
    this.counters.delete(name);
  }

  export(): {
    metrics: Record<string, AggregatedMetric | null>;
    counters: Record<string, number>;
    gauges: Record<string, number>;
  } {
    const metrics: Record<string, AggregatedMetric | null> = {};
    for (const name of this.metrics.keys()) {
      metrics[name] = this.aggregate(name);
    }

    return {
      metrics,
      counters: this.getAllCounters(),
      gauges: this.getAllGauges(),
    };
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();

// Decorator for tracking method execution metrics
export function Metric(metricName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = metricName ?? `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        metrics.record(`${name}.duration`, duration);
        metrics.increment(`${name}.success`);
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        metrics.record(`${name}.duration`, duration);
        metrics.increment(`${name}.error`);
        throw error;
      }
    };

    return descriptor;
  };
}
