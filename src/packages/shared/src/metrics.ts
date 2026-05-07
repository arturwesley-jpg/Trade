/**
 * Prometheus Metrics Collection
 * Production-ready metrics for monitoring and observability
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export interface MetricsOptions {
  prefix?: string;
  collectDefaultMetrics?: boolean;
  defaultLabels?: Record<string, string>;
}

export class MetricsCollector {
  public readonly registry: Registry;
  
  // HTTP metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestsInFlight: Gauge;
  
  // Trading metrics
  public readonly tradesTotal: Counter;
  public readonly positionsOpen: Gauge;
  public readonly orderExecutionDuration: Histogram;
  public readonly signalsGenerated: Counter;
  
  // Market data metrics
  public readonly marketDataTicks: Counter;
  public readonly marketDataLatency: Histogram;
  public readonly providerErrors: Counter;
  
  // System metrics
  public readonly errorTotal: Counter;
  public readonly cacheHits: Counter;
  public readonly cacheMisses: Counter;
  public readonly dbQueryDuration: Histogram;

  constructor(options: MetricsOptions = {}) {
    this.registry = new Registry();
    
    const prefix = options.prefix ?? "trade_";
    
    if (options.defaultLabels) {
      this.registry.setDefaultLabels(options.defaultLabels);
    }
    
    if (options.collectDefaultMetrics !== false) {
      collectDefaultMetrics({ register: this.registry, prefix });
    }

    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: `${prefix}http_requests_total`,
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry]
    });

    this.httpRequestDuration = new Histogram({
      name: `${prefix}http_request_duration_seconds`,
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.httpRequestsInFlight = new Gauge({
      name: `${prefix}http_requests_in_flight`,
      help: "Number of HTTP requests currently being processed",
      labelNames: ["method", "route"],
      registers: [this.registry]
    });

    // Trading metrics
    this.tradesTotal = new Counter({
      name: `${prefix}trades_total`,
      help: "Total number of trades executed",
      labelNames: ["symbol", "side", "status"],
      registers: [this.registry]
    });

    this.positionsOpen = new Gauge({
      name: `${prefix}positions_open`,
      help: "Number of currently open positions",
      labelNames: ["symbol"],
      registers: [this.registry]
    });

    this.orderExecutionDuration = new Histogram({
      name: `${prefix}order_execution_duration_seconds`,
      help: "Order execution duration in seconds",
      labelNames: ["symbol", "side"],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.signalsGenerated = new Counter({
      name: `${prefix}signals_generated_total`,
      help: "Total number of trading signals generated",
      labelNames: ["symbol", "direction", "strength"],
      registers: [this.registry]
    });

    // Market data metrics
    this.marketDataTicks = new Counter({
      name: `${prefix}market_data_ticks_total`,
      help: "Total number of market data ticks received",
      labelNames: ["provider", "symbol"],
      registers: [this.registry]
    });

    this.marketDataLatency = new Histogram({
      name: `${prefix}market_data_latency_seconds`,
      help: "Market data provider latency in seconds",
      labelNames: ["provider"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry]
    });

    this.providerErrors = new Counter({
      name: `${prefix}provider_errors_total`,
      help: "Total number of provider errors",
      labelNames: ["provider", "error_type"],
      registers: [this.registry]
    });

    // System metrics
    this.errorTotal = new Counter({
      name: `${prefix}errors_total`,
      help: "Total number of errors",
      labelNames: ["type", "severity"],
      registers: [this.registry]
    });

    this.cacheHits = new Counter({
      name: `${prefix}cache_hits_total`,
      help: "Total number of cache hits",
      labelNames: ["cache_name"],
      registers: [this.registry]
    });

    this.cacheMisses = new Counter({
      name: `${prefix}cache_misses_total`,
      help: "Total number of cache misses",
      labelNames: ["cache_name"],
      registers: [this.registry]
    });

    this.dbQueryDuration = new Histogram({
      name: `${prefix}db_query_duration_seconds`,
      help: "Database query duration in seconds",
      labelNames: ["operation", "table"],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry]
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.registry.resetMetrics();
  }
}

/**
 * Default metrics collector instance
 */
export const metrics = new MetricsCollector({
  prefix: "trade_",
  collectDefaultMetrics: true,
  defaultLabels: {
    app: "crypto-trading-bot",
    env: process.env.NODE_ENV ?? "development"
  }
});

/**
 * Express middleware for HTTP metrics
 */
export function metricsMiddleware(metricsCollector = metrics) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const route = req.route?.path ?? req.path;
    
    metricsCollector.httpRequestsInFlight.inc({ method: req.method, route });
    
    res.on("finish", () => {
      const duration = (Date.now() - start) / 1000;
      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode
      };
      
      metricsCollector.httpRequestsTotal.inc(labels);
      metricsCollector.httpRequestDuration.observe(labels, duration);
      metricsCollector.httpRequestsInFlight.dec({ method: req.method, route });
    });
    
    next();
  };
}

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(metricsCollector = metrics): Promise<string> {
  return metricsCollector.getMetrics();
}
