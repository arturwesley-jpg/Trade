/**
 * Prometheus Metrics for Trading Platform
 * Comprehensive metrics collection for monitoring and observability
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export interface PrometheusMetricsOptions {
  prefix?: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
}

export class PrometheusMetrics {
  public readonly registry: Registry;

  // HTTP Metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestSize: Histogram;
  public readonly httpResponseSize: Histogram;

  // Business Metrics - Trading
  public readonly signalsGenerated: Counter;
  public readonly tradesExecuted: Counter;
  public readonly tradesTotal: Counter;
  public readonly ordersFilled: Counter;
  public readonly ordersRejected: Counter;
  public readonly positionsOpen: Gauge;
  public readonly tradePnl: Histogram;
  public readonly accountEquity: Gauge;

  // Business Metrics - Alerts
  public readonly alertsTriggered: Counter;
  public readonly alertsResolved: Counter;
  public readonly alertsActive: Gauge;

  // System Metrics
  public readonly activeConnections: Gauge;
  public readonly databaseConnections: Gauge;
  public readonly redisConnections: Gauge;
  public readonly cacheHits: Counter;
  public readonly cacheMisses: Counter;

  // External API Metrics
  public readonly externalApiCalls: Counter;
  public readonly externalApiDuration: Histogram;
  public readonly externalApiErrors: Counter;

  // WebSocket Metrics
  public readonly wsConnectionsActive: Gauge;
  public readonly wsMessagesReceived: Counter;
  public readonly wsMessagesSent: Counter;
  public readonly wsErrors: Counter;

  // Market Data Metrics
  public readonly marketTicksReceived: Counter;
  public readonly marketDataLatency: Histogram;
  public readonly providerHealthScore: Gauge;

  // Error Metrics
  public readonly errorsTotal: Counter;
  public readonly errorsByType: Counter;

  // Performance Metrics
  public readonly operationDuration: Histogram;
  public readonly queueSize: Gauge;
  public readonly queueProcessingTime: Histogram;

  constructor(options: PrometheusMetricsOptions = {}) {
    this.registry = new Registry();

    const prefix = options.prefix ?? "trading_";

    if (options.defaultLabels) {
      this.registry.setDefaultLabels(options.defaultLabels);
    }

    if (options.collectDefaultMetrics !== false) {
      collectDefaultMetrics({
        register: this.registry,
        prefix,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
      });
    }

    // HTTP Metrics
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
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.httpRequestSize = new Histogram({
      name: `${prefix}http_request_size_bytes`,
      help: "HTTP request size in bytes",
      labelNames: ["method", "route"],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry]
    });

    this.httpResponseSize = new Histogram({
      name: `${prefix}http_response_size_bytes`,
      help: "HTTP response size in bytes",
      labelNames: ["method", "route"],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry]
    });

    // Business Metrics - Trading
    this.signalsGenerated = new Counter({
      name: `${prefix}signals_generated_total`,
      help: "Total number of trading signals generated",
      labelNames: ["symbol", "signal_type", "confidence"],
      registers: [this.registry]
    });

    this.tradesExecuted = new Counter({
      name: `${prefix}trades_executed_total`,
      help: "Total number of trades executed",
      labelNames: ["symbol", "side", "status"],
      registers: [this.registry]
    });

    this.tradesTotal = new Counter({
      name: `${prefix}trades_total`,
      help: "Total number of trades",
      labelNames: ["symbol", "side", "result"],
      registers: [this.registry]
    });

    this.ordersFilled = new Counter({
      name: `${prefix}orders_filled_total`,
      help: "Total number of orders filled",
      labelNames: ["symbol", "side", "order_type"],
      registers: [this.registry]
    });

    this.ordersRejected = new Counter({
      name: `${prefix}orders_rejected_total`,
      help: "Total number of orders rejected",
      labelNames: ["symbol", "reason"],
      registers: [this.registry]
    });

    this.positionsOpen = new Gauge({
      name: `${prefix}positions_open`,
      help: "Number of currently open positions",
      labelNames: ["symbol"],
      registers: [this.registry]
    });

    this.tradePnl = new Histogram({
      name: `${prefix}trade_pnl_usdt`,
      help: "Trade profit/loss in USDT",
      labelNames: ["symbol", "side"],
      buckets: [-1000, -500, -100, -50, -10, 0, 10, 50, 100, 500, 1000],
      registers: [this.registry]
    });

    this.accountEquity = new Gauge({
      name: `${prefix}account_equity_usdt`,
      help: "Current account equity in USDT",
      registers: [this.registry]
    });

    // Business Metrics - Alerts
    this.alertsTriggered = new Counter({
      name: `${prefix}alerts_triggered_total`,
      help: "Total number of alerts triggered",
      labelNames: ["type", "severity"],
      registers: [this.registry]
    });

    this.alertsResolved = new Counter({
      name: `${prefix}alerts_resolved_total`,
      help: "Total number of alerts resolved",
      labelNames: ["type", "severity"],
      registers: [this.registry]
    });

    this.alertsActive = new Gauge({
      name: `${prefix}alerts_active`,
      help: "Number of currently active alerts",
      labelNames: ["type", "severity"],
      registers: [this.registry]
    });

    // System Metrics
    this.activeConnections = new Gauge({
      name: `${prefix}active_connections`,
      help: "Number of active connections",
      labelNames: ["type"],
      registers: [this.registry]
    });

    this.databaseConnections = new Gauge({
      name: `${prefix}database_connections`,
      help: "Number of database connections",
      labelNames: ["state"],
      registers: [this.registry]
    });

    this.redisConnections = new Gauge({
      name: `${prefix}redis_connections`,
      help: "Number of Redis connections",
      labelNames: ["state"],
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

    // External API Metrics
    this.externalApiCalls = new Counter({
      name: `${prefix}external_api_calls_total`,
      help: "Total number of external API calls",
      labelNames: ["provider", "endpoint", "status"],
      registers: [this.registry]
    });

    this.externalApiDuration = new Histogram({
      name: `${prefix}external_api_duration_seconds`,
      help: "External API call duration in seconds",
      labelNames: ["provider", "endpoint"],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry]
    });

    this.externalApiErrors = new Counter({
      name: `${prefix}external_api_errors_total`,
      help: "Total number of external API errors",
      labelNames: ["provider", "error_type"],
      registers: [this.registry]
    });

    // WebSocket Metrics
    this.wsConnectionsActive = new Gauge({
      name: `${prefix}ws_connections_active`,
      help: "Number of active WebSocket connections",
      labelNames: ["type"],
      registers: [this.registry]
    });

    this.wsMessagesReceived = new Counter({
      name: `${prefix}ws_messages_received_total`,
      help: "Total number of WebSocket messages received",
      labelNames: ["type"],
      registers: [this.registry]
    });

    this.wsMessagesSent = new Counter({
      name: `${prefix}ws_messages_sent_total`,
      help: "Total number of WebSocket messages sent",
      labelNames: ["type"],
      registers: [this.registry]
    });

    this.wsErrors = new Counter({
      name: `${prefix}ws_errors_total`,
      help: "Total number of WebSocket errors",
      labelNames: ["error_type"],
      registers: [this.registry]
    });

    // Market Data Metrics
    this.marketTicksReceived = new Counter({
      name: `${prefix}market_ticks_received_total`,
      help: "Total number of market ticks received",
      labelNames: ["symbol", "provider"],
      registers: [this.registry]
    });

    this.marketDataLatency = new Histogram({
      name: `${prefix}market_data_latency_seconds`,
      help: "Market data latency in seconds",
      labelNames: ["symbol", "provider"],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry]
    });

    this.providerHealthScore = new Gauge({
      name: `${prefix}provider_health_score`,
      help: "Provider health score (0-100)",
      labelNames: ["provider", "symbol"],
      registers: [this.registry]
    });

    // Error Metrics
    this.errorsTotal = new Counter({
      name: `${prefix}errors_total`,
      help: "Total number of errors",
      labelNames: ["severity", "component"],
      registers: [this.registry]
    });

    this.errorsByType = new Counter({
      name: `${prefix}errors_by_type_total`,
      help: "Total number of errors by type",
      labelNames: ["error_type", "component"],
      registers: [this.registry]
    });

    // Performance Metrics
    this.operationDuration = new Histogram({
      name: `${prefix}operation_duration_seconds`,
      help: "Operation duration in seconds",
      labelNames: ["operation", "status"],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.queueSize = new Gauge({
      name: `${prefix}queue_size`,
      help: "Current queue size",
      labelNames: ["queue_name"],
      registers: [this.registry]
    });

    this.queueProcessingTime = new Histogram({
      name: `${prefix}queue_processing_time_seconds`,
      help: "Queue processing time in seconds",
      labelNames: ["queue_name"],
      buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10, 30],
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
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<any> {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.registry.resetMetrics();
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);

    if (requestSize !== undefined) {
      this.httpRequestSize.observe({ method, route }, requestSize);
    }

    if (responseSize !== undefined) {
      this.httpResponseSize.observe({ method, route }, responseSize);
    }
  }

  /**
   * Record trading signal
   */
  recordSignal(symbol: string, signalType: string, confidence: string): void {
    this.signalsGenerated.inc({ symbol, signal_type: signalType, confidence });
  }

  /**
   * Record trade execution
   */
  recordTrade(symbol: string, side: string, status: string, pnl?: number): void {
    this.tradesExecuted.inc({ symbol, side, status });

    if (pnl !== undefined) {
      this.tradePnl.observe({ symbol, side }, pnl);
    }
  }

  /**
   * Record external API call
   */
  recordExternalApiCall(
    provider: string,
    endpoint: string,
    status: string,
    durationSeconds: number,
    errorType?: string
  ): void {
    this.externalApiCalls.inc({ provider, endpoint, status });
    this.externalApiDuration.observe({ provider, endpoint }, durationSeconds);

    if (errorType) {
      this.externalApiErrors.inc({ provider, error_type: errorType });
    }
  }

  /**
   * Record market tick
   */
  recordMarketTick(symbol: string, provider: string, latencySeconds: number): void {
    this.marketTicksReceived.inc({ symbol, provider });
    this.marketDataLatency.observe({ symbol, provider }, latencySeconds);
  }

  /**
   * Record error
   */
  recordError(severity: string, component: string, errorType: string): void {
    this.errorsTotal.inc({ severity, component });
    this.errorsByType.inc({ error_type: errorType, component });
  }
}

/**
 * Singleton instance
 */
let metricsInstance: PrometheusMetrics | null = null;

/**
 * Get or create metrics instance
 */
export function getMetrics(options?: PrometheusMetricsOptions): PrometheusMetrics {
  if (!metricsInstance) {
    metricsInstance = new PrometheusMetrics(options);
  }
  return metricsInstance;
}

/**
 * Create Fastify plugin for metrics
 */
export function createMetricsPlugin(metrics: PrometheusMetrics) {
  return async (fastify: any) => {
    // Metrics endpoint
    fastify.get("/metrics", async (request: any, reply: any) => {
      reply.header("Content-Type", "text/plain; version=0.0.4");
      return metrics.getMetrics();
    });

    // Metrics middleware
    fastify.addHook("onRequest", async (request: any) => {
      request.startTime = Date.now();
    });

    fastify.addHook("onResponse", async (request: any, reply: any) => {
      const duration = (Date.now() - request.startTime) / 1000;
      const route = request.routeOptions?.url ?? request.url;

      metrics.recordHttpRequest(
        request.method,
        route,
        reply.statusCode,
        duration
      );
    });
  };
}
