import { performance } from 'perf_hooks';
import { logger } from '../logger.js';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
}

export class Profiler {
  private metrics: PerformanceMetric[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private timers: Map<string, number> = new Map();
  private maxMetrics: number;

  constructor(maxMetrics: number = 1000) {
    this.maxMetrics = maxMetrics;
  }

  start(name: string): void {
    this.timers.set(name, performance.now());
  }

  end(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      logger.warn({ name }, 'Timer not found');
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    return duration;
  }

  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name, metadata);
      return result;
    } catch (error) {
      this.end(name, { ...metadata, error: true });
      throw error;
    }
  }

  measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    this.start(name);
    try {
      const result = fn();
      this.end(name, metadata);
      return result;
    } catch (error) {
      this.end(name, { ...metadata, error: true });
      throw error;
    }
  }

  takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: Date.now(),
    };

    this.memorySnapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots.shift();
    }

    return snapshot;
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter((m) => m.name === name);
    }
    return [...this.metrics];
  }

  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);

    return {
      count: metrics.length,
      avg: sum / metrics.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
    };
  }

  getAllStats(): Array<{
    name: string;
    stats: ReturnType<typeof this.getStats>;
  }> {
    const names = new Set(this.metrics.map((m) => m.name));
    return Array.from(names).map((name) => ({
      name,
      stats: this.getStats(name),
    }));
  }

  getMemorySnapshots(): MemorySnapshot[] {
    return [...this.memorySnapshots];
  }

  detectMemoryLeak(thresholdMB: number = 100): {
    detected: boolean;
    growth: number;
    snapshots: MemorySnapshot[];
  } {
    if (this.memorySnapshots.length < 10) {
      return { detected: false, growth: 0, snapshots: [] };
    }

    const recent = this.memorySnapshots.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const growthBytes = last.heapUsed - first.heapUsed;
    const growthMB = growthBytes / (1024 * 1024);

    return {
      detected: growthMB > thresholdMB,
      growth: growthMB,
      snapshots: recent,
    };
  }

  clear(): void {
    this.metrics = [];
    this.memorySnapshots = [];
    this.timers.clear();
  }

  report(): {
    metrics: ReturnType<typeof this.getAllStats>;
    memory: {
      current: MemorySnapshot;
      leak: ReturnType<typeof this.detectMemoryLeak>;
    };
  } {
    return {
      metrics: this.getAllStats(),
      memory: {
        current: this.takeMemorySnapshot(),
        leak: this.detectMemoryLeak(),
      },
    };
  }
}

// Global profiler instance
export const profiler = new Profiler();

// Decorator for profiling methods
export function Profile(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const metricName = name ?? `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return profiler.measure(metricName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

// CPU profiling helper
export class CPUProfiler {
  private startTime: number = 0;
  private startUsage: NodeJS.CpuUsage | null = null;

  start(): void {
    this.startTime = Date.now();
    this.startUsage = process.cpuUsage();
  }

  end(): {
    duration: number;
    user: number;
    system: number;
    total: number;
  } {
    if (!this.startUsage) {
      throw new Error('CPU profiler not started');
    }

    const duration = Date.now() - this.startTime;
    const usage = process.cpuUsage(this.startUsage);

    return {
      duration,
      user: usage.user / 1000, // Convert to ms
      system: usage.system / 1000,
      total: (usage.user + usage.system) / 1000,
    };
  }

  async profile<T>(fn: () => Promise<T>): Promise<{
    result: T;
    profile: ReturnType<typeof this.end>;
  }> {
    this.start();
    const result = await fn();
    const profile = this.end();
    return { result, profile };
  }
}
