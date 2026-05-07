# Distributed Tracing Setup Guide

## 🎯 Overview

This guide explains how to set up and use distributed tracing with Jaeger and OpenTelemetry for the Crypto Trading Bot.

## 📦 Components

### Jaeger
- **UI**: http://localhost:16686
- **Collector**: Port 14268 (HTTP), 14250 (gRPC)
- **Storage**: Badger (embedded database)

### OpenTelemetry Collector
- **OTLP gRPC**: Port 4317
- **OTLP HTTP**: Port 4318
- **Metrics**: Port 8889
- **Health Check**: Port 13133

## 🚀 Quick Start

### 1. Start Tracing Infrastructure

```bash
# Start Jaeger and OpenTelemetry Collector
cd infrastructure/monitoring
docker-compose -f docker-compose.tracing.yml up -d

# Verify services are running
docker-compose -f docker-compose.tracing.yml ps

# Check Jaeger UI
open http://localhost:16686
```

### 2. Install OpenTelemetry SDK

```bash
# Install dependencies
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-express \
  @opentelemetry/instrumentation-pg \
  @opentelemetry/instrumentation-redis-4
```

### 3. Configure Tracing in Application

Create `packages/api/src/tracing.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'trading-bot-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable file system instrumentation (too noisy)
      },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

export default sdk;
```

### 4. Initialize Tracing in Application

Update `packages/api/src/index.ts`:

```typescript
// IMPORTANT: Import tracing BEFORE any other imports
import './tracing';

import express from 'express';
// ... rest of imports
```

### 5. Add Custom Spans

```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('trading-bot-api');

// Example: Trace a function
async function executeTrade(tradeData: TradeData) {
  const span = tracer.startSpan('executeTrade');
  
  try {
    span.setAttributes({
      'trade.symbol': tradeData.symbol,
      'trade.side': tradeData.side,
      'trade.quantity': tradeData.quantity,
    });

    // Your trade execution logic
    const result = await performTrade(tradeData);

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

// Example: Trace with context propagation
async function processTradeRequest(req: Request, res: Response) {
  return context.with(trace.setSpan(context.active(), span), async () => {
    // All operations here will be part of the same trace
    const validation = await validateTrade(req.body);
    const execution = await executeTrade(req.body);
    const notification = await sendNotification(execution);
    
    return execution;
  });
}
```

## 📊 Viewing Traces

### Jaeger UI

1. Open http://localhost:16686
2. Select service: `trading-bot-api`
3. Click "Find Traces"
4. Click on a trace to see details

### Trace Information

Each trace shows:
- **Duration**: Total time for the request
- **Spans**: Individual operations within the trace
- **Tags**: Metadata (HTTP method, status code, etc.)
- **Logs**: Events that occurred during the span
- **Process**: Service information

## 🔍 Common Use Cases

### 1. Trace API Request Flow

```typescript
// Automatically traced by auto-instrumentation
app.get('/api/trades', async (req, res) => {
  const trades = await db.query('SELECT * FROM trades');
  res.json(trades);
});

// Trace will show:
// - HTTP request span
// - Database query span
// - Response time
```

### 2. Trace External API Calls

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('trading-bot-api');

async function fetchBingXPrice(symbol: string) {
  const span = tracer.startSpan('fetchBingXPrice', {
    attributes: {
      'http.method': 'GET',
      'http.url': `https://api.bingx.com/price/${symbol}`,
      'exchange': 'bingx',
      'symbol': symbol,
    },
  });

  try {
    const response = await fetch(`https://api.bingx.com/price/${symbol}`);
    const data = await response.json();
    
    span.setAttributes({
      'http.status_code': response.status,
      'price': data.price,
    });

    return data;
  } finally {
    span.end();
  }
}
```

### 3. Trace Database Queries

```typescript
// Automatically traced by pg instrumentation
const result = await pool.query('SELECT * FROM trades WHERE user_id = $1', [userId]);

// Trace will show:
// - Query text
// - Parameters
// - Execution time
// - Row count
```

### 4. Trace Background Jobs

```typescript
async function processTradeSignals() {
  const span = tracer.startSpan('processTradeSignals');

  try {
    const signals = await fetchSignals();
    span.setAttribute('signals.count', signals.length);

    for (const signal of signals) {
      const childSpan = tracer.startSpan('processSignal', {
        parent: span,
        attributes: {
          'signal.id': signal.id,
          'signal.type': signal.type,
        },
      });

      try {
        await processSignal(signal);
        childSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        childSpan.recordException(error);
        childSpan.setStatus({ code: SpanStatusCode.ERROR });
      } finally {
        childSpan.end();
      }
    }
  } finally {
    span.end();
  }
}
```

## 🎨 Best Practices

### 1. Span Naming
- Use descriptive names: `executeTrade`, not `doWork`
- Use consistent naming: `fetch*`, `process*`, `validate*`
- Include operation type: `db.query`, `http.request`

### 2. Attributes
- Add relevant context: user_id, trade_id, symbol
- Use semantic conventions: `http.method`, `db.statement`
- Don't include sensitive data: passwords, API keys

### 3. Error Handling
- Always record exceptions: `span.recordException(error)`
- Set error status: `span.setStatus({ code: SpanStatusCode.ERROR })`
- Include error details in attributes

### 4. Performance
- Use sampling in production (e.g., 10% of traces)
- Batch span exports
- Limit span attributes (max 128)

## 🔧 Configuration

### Environment Variables

```bash
# OpenTelemetry configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=trading-bot-api
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10% of traces

# Jaeger configuration (alternative)
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=6831
JAEGER_SAMPLER_TYPE=probabilistic
JAEGER_SAMPLER_PARAM=0.1
```

### Sampling Strategies

```typescript
// Always sample (development)
import { AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
const sampler = new AlwaysOnSampler();

// Probabilistic sampling (production)
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
const sampler = new TraceIdRatioBasedSampler(0.1); // 10%

// Parent-based sampling
import { ParentBasedSampler } from '@opentelemetry/sdk-trace-base';
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1),
});
```

## 📈 Monitoring Tracing

### Metrics to Track

- **Trace count**: Number of traces collected
- **Span count**: Number of spans per trace
- **Error rate**: Percentage of traces with errors
- **Latency**: p50, p95, p99 trace duration

### Alerts

Set up alerts for:
- High error rate in traces (>5%)
- Slow traces (>5s)
- Missing traces (service not reporting)
- High span count (>100 spans per trace)

## 🔗 Integration with Other Tools

### Grafana
- Add Jaeger as data source
- Create dashboards with trace metrics
- Link logs to traces using trace_id

### Prometheus
- Export trace metrics to Prometheus
- Create alerts based on trace data
- Visualize trace metrics in Grafana

### Loki
- Add trace_id to log entries
- Link logs to traces in Grafana
- Search logs by trace_id

## 🐛 Troubleshooting

### No traces appearing

1. Check if Jaeger is running:
   ```bash
   curl http://localhost:16686
   ```

2. Check if collector is receiving traces:
   ```bash
   curl http://localhost:13133
   ```

3. Check application logs for tracing errors

4. Verify OTEL_EXPORTER_OTLP_ENDPOINT is correct

### High overhead

1. Reduce sampling rate
2. Disable noisy instrumentations (fs, dns)
3. Increase batch size
4. Use async exporters

### Missing spans

1. Ensure context propagation is working
2. Check if spans are being ended
3. Verify parent-child relationships
4. Check for exceptions in span creation

## 📚 Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/)
- [Semantic Conventions](https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/)

## 🔐 Security

- Don't trace sensitive data (passwords, tokens)
- Use authentication for Jaeger UI in production
- Encrypt trace data in transit
- Set retention policies for trace data
- Implement access controls for trace viewing
