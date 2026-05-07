# Observability Guide

Complete observability system with structured logging, metrics collection, health checks, and alerting.

## Table of Contents

- [Structured Logging](#structured-logging)
- [Metrics Collection](#metrics-collection)
- [Health Checks](#health-checks)
- [Alerting System](#alerting-system)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)

## Structured Logging

### Overview

The system uses Pino for high-performance structured logging with JSON output.

### Basic Usage

```typescript
import { logger, createChildLogger, logError, logPerformance } from "@trade/shared/logger";

// Basic logging
logger.info("Application started");
logger.warn("High memory usage detected");
logger.error("Database connection failed");

// Structured logging with context
logger.info({
  userId: "user123",
  action: "trade_executed",
  symbol: "BTC-USDT",
  amount: 0.5
}, "Trade executed successfully");

// Child logger with persistent context
const requestLogger = createChildLogger({ requestId: "req-123" });
requestLogger.info("Processing request");

// Error logging with stack traces
try {
  throw new Error("Something went wrong");
} catch (error) {
  logError(error, { userId: "user123", operation: "fetchData" });
}

// Performance logging
const start = Date.now();
// ... operation ...
logPerformance("database_query", Date.now() - start, { table: "trades" });
```

### Log Levels

- **trace**: Very detailed debugging information
- **debug**: Debugging information
- **info**: General informational messages
- **warn**: Warning messages
- **error**: Error messages
- **fatal**: Fatal errors that cause application shutdown

### Configuration

```typescript
import { createLogger } from "@trade/shared/logger";

const logger = createLogger({
  level: "info",
  name: "my-service",
  prettyPrint: true, // Enable pretty printing in development
  redact: ["password", "apiKey", "secret"] // Redact sensitive fields
});
```

### Express Middleware

```typescript
import express from "express";
import { requestLogger } from "@trade/shared/logger";

const app = express();
app.use(requestLogger());

app.get("/api/data", (req, res) => {
  req.log.info("Fetching data");
  res.json({ data: [] });
});
```

## Metrics Collection

### Overview

Prometheus metrics for monitoring application performance and business metrics.

### Available Metrics

#### HTTP Metrics
- `trade_http_requests_total` - Total HTTP requests
- `trade_http_request_duration_seconds` - Request duration histogram
- `trade_http_requests_in_flight` - Current in-flight requests

#### Trading Metrics
- `trade_trades_total` - Total trades executed
- `trade_positions_open` - Currently open positions
- `trade_order_execution_duration_seconds` - Order execution time
- `trade_signals_generated_total` - Trading signals generated

#### Market Data Metrics
- `trade_market_data_ticks_total` - Market data ticks received
- `trade_market_data_latency_seconds` - Provider latency
- `trade_provider_errors_total` - Provider errors

#### System Metrics
- `trade_errors_total` - Application errors
- `trade_cache_hits_total` - Cache hits
- `trade_cache_misses_total` - Cache misses
- `trade_db_query_duration_seconds` - Database query duration

### Basic Usage

```typescript
import { metrics } from "@trade/shared/metrics";

// Increment counters
metrics.tradesTotal.inc({ symbol: "BTC-USDT", side: "buy", status: "filled" });
metrics.signalsGenerated.inc({ symbol: "ETH-USDT", direction: "long", strength: "strong" });

// Set gauges
metrics.positionsOpen.set({ symbol: "BTC-USDT" }, 5);

// Observe histograms
const start = Date.now();
// ... operation ...
metrics.orderExecutionDuration.observe(
  { symbol: "BTC-USDT", side: "buy" },
  (Date.now() - start) / 1000
);

// Record market data
metrics.marketDataTicks.inc({ provider: "binance", symbol: "BTC-USDT" });
metrics.marketDataLatency.observe({ provider: "binance" }, 0.05);
```

### Express Middleware

```typescript
import express from "express";
import { metricsMiddleware, metricsHandler } from "@trade/shared/metrics";

const app = express();

// Collect HTTP metrics
app.use(metricsMiddleware());

// Expose metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(await metricsHandler());
});
```

### Custom Metrics

```typescript
import { metrics } from "@trade/shared/metrics";
import { Counter, Histogram } from "prom-client";

// Create custom counter
const customCounter = new Counter({
  name: "trade_custom_events_total",
  help: "Custom events counter",
  labelNames: ["event_type"],
  registers: [metrics.registry]
});

customCounter.inc({ event_type: "user_signup" });
```

## Health Checks

### Overview

Comprehensive health checks for all system components with liveness and readiness probes.

### Basic Usage

```typescript
import { healthChecker, checkDatabase, checkRedis, checkMemory } from "@trade/shared/health-check";

// Register health checks
healthChecker.register("database", () => checkDatabase(db));
healthChecker.register("redis", () => checkRedis(redis));
healthChecker.register("memory", checkMemory);

// Custom health check
healthChecker.register("api", async () => {
  try {
    const response = await fetch("https://api.example.com/health");
    return {
      status: response.ok ? "healthy" : "unhealthy",
      message: `API returned ${response.status}`,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error.message,
      timestamp: Date.now()
    };
  }
});

// Run all health checks
const health = await healthChecker.check();
console.log(health);
```

### Health Check Endpoints

```typescript
import express from "express";
import { healthChecker } from "@trade/shared/health-check";

const app = express();

// Liveness probe (always returns 200 if process is running)
app.get("/health/live", async (req, res) => {
  const result = await healthChecker.liveness();
  res.json(result);
});

// Readiness probe (checks if service can accept traffic)
app.get("/health/ready", async (req, res) => {
  const result = await healthChecker.readiness();
  res.status(result.status === "healthy" ? 200 : 503).json(result);
});

// Detailed health check
app.get("/health", async (req, res) => {
  const health = await healthChecker.check();
  res.status(health.status === "healthy" ? 200 : 503).json(health);
});
```

### Health Status

- **healthy**: Component is functioning normally
- **degraded**: Component is functioning but with reduced performance
- **unhealthy**: Component is not functioning

## Alerting System

### Overview

Multi-channel alerting system supporting Telegram, webhooks, and console output.

### Configuration

```bash
# .env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALERT_CHAT_ID=your_chat_id
ALERT_WEBHOOK_URL=https://hooks.example.com/alerts
```

### Basic Usage

```typescript
import { alert, alerting } from "@trade/shared/alerting";

// Quick alerts
await alert.info("System Started", "Application initialized successfully");
await alert.warning("High Memory Usage", "Memory usage at 85%");
await alert.error("Database Error", "Failed to connect to database");
await alert.critical("System Down", "Critical service failure detected");

// Alerts with metadata
await alert.error("Trade Failed", "Order execution failed", {
  symbol: "BTC-USDT",
  orderId: "order123",
  error: "Insufficient balance"
});

// Custom alerting instance
const customAlerting = new AlertingSystem({
  telegramBotToken: "token",
  telegramChatId: "chatId",
  webhookUrl: "https://hooks.example.com",
  enabledChannels: ["telegram", "webhook"]
});

await customAlerting.send({
  title: "Custom Alert",
  message: "Something happened",
  severity: "warning",
  timestamp: Date.now(),
  metadata: { key: "value" }
});
```

### Alert Severities

- **info**: Informational messages
- **warning**: Warning conditions
- **error**: Error conditions
- **critical**: Critical conditions requiring immediate attention

## Monitoring Setup

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'trading-bot'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

### Grafana Dashboards

#### System Overview Dashboard

- HTTP request rate and latency
- Error rate
- Memory and CPU usage
- Active connections

#### Trading Dashboard

- Trades per minute
- Open positions
- Order execution time
- Signal generation rate

#### Market Data Dashboard

- Ticks per second by provider
- Provider latency
- Provider error rate
- Data quality score

### Example Queries

```promql
# Request rate
rate(trade_http_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(trade_http_request_duration_seconds_bucket[5m]))

# Error rate
rate(trade_errors_total[5m])

# Trades per minute
rate(trade_trades_total[1m]) * 60

# Provider health
1 - (rate(trade_provider_errors_total[5m]) / rate(trade_market_data_ticks_total[5m]))
```

## Troubleshooting

### High Memory Usage

```typescript
import { checkMemory } from "@trade/shared/health-check";

const memoryHealth = await checkMemory();
console.log(memoryHealth);

// Force garbage collection (if --expose-gc flag is set)
if (global.gc) {
  global.gc();
}
```

### Slow Queries

```typescript
import { metrics } from "@trade/shared/metrics";

// Monitor query duration
const timer = metrics.dbQueryDuration.startTimer({ operation: "select", table: "trades" });
const result = await db.query("SELECT * FROM trades");
timer();
```

### Provider Issues

```typescript
import { metrics } from "@trade/shared/metrics";

// Check provider metrics
const providerMetrics = await metrics.getMetrics();
console.log(providerMetrics);

// Alert on provider errors
if (errorCount > threshold) {
  await alert.error("Provider Degraded", `${provider} error rate: ${errorRate}%`);
}
```

### Log Analysis

```bash
# Filter logs by level
cat logs/app.log | grep '"level":"error"'

# Filter logs by user
cat logs/app.log | grep '"userId":"user123"'

# Count errors by type
cat logs/app.log | grep '"level":"error"' | jq -r '.err.name' | sort | uniq -c
```

## Best Practices

1. **Log Structured Data**: Always use structured logging with context
2. **Monitor Key Metrics**: Track business metrics, not just system metrics
3. **Set Up Alerts**: Configure alerts for critical conditions
4. **Regular Health Checks**: Monitor component health continuously
5. **Retention Policies**: Set appropriate log and metric retention periods
6. **Dashboard Organization**: Create role-specific dashboards
7. **Alert Fatigue**: Avoid too many low-priority alerts
8. **Performance Impact**: Monitor observability system overhead

## Integration Example

```typescript
import express from "express";
import { logger, requestLogger } from "@trade/shared/logger";
import { metrics, metricsMiddleware, metricsHandler } from "@trade/shared/metrics";
import { healthChecker, checkDatabase, checkRedis, checkMemory } from "@trade/shared/health-check";
import { alert } from "@trade/shared/alerting";

const app = express();

// Logging middleware
app.use(requestLogger());

// Metrics middleware
app.use(metricsMiddleware());

// Register health checks
healthChecker.register("database", () => checkDatabase(db));
healthChecker.register("redis", () => checkRedis(redis));
healthChecker.register("memory", checkMemory);

// Health endpoints
app.get("/health", async (req, res) => {
  const health = await healthChecker.check();
  res.status(health.status === "healthy" ? 200 : 503).json(health);
});

app.get("/health/live", async (req, res) => {
  res.json(await healthChecker.liveness());
});

app.get("/health/ready", async (req, res) => {
  const result = await healthChecker.readiness();
  res.status(result.status === "healthy" ? 200 : 503).json(result);
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(await metricsHandler());
});

// Error handling
app.use((err, req, res, next) => {
  logger.error({ err, requestId: req.log.bindings().requestId }, "Request error");
  metrics.errorTotal.inc({ type: err.name, severity: "error" });
  
  if (err.statusCode >= 500) {
    alert.error("Server Error", err.message, { path: req.path, method: req.method });
  }
  
  res.status(err.statusCode || 500).json({ error: err.message });
});

// Startup
app.listen(3001, () => {
  logger.info("Server started on port 3001");
  alert.info("System Started", "Trading bot API is now running");
});
```
