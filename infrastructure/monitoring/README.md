# Monitoring and Observability

Comprehensive monitoring and observability setup for the trading platform.

## Overview

This monitoring stack provides:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert management and routing
- **Loki**: Log aggregation
- **Jaeger**: Distributed tracing
- **Node Exporter**: System metrics
- **PostgreSQL Exporter**: Database metrics
- **Redis Exporter**: Cache metrics

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Check status
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Jaeger**: http://localhost:16686

### 3. Configure Environment Variables

Create `.env` file:

```env
# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_password

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_db_password
POSTGRES_DB=trading

# Redis
REDIS_PASSWORD=your_redis_password

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_SERVICE_KEY=your_pagerduty_key

# Sentry (Optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# OpenTelemetry (Optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Architecture

```
┌─────────────┐
│   Trading   │
│     API     │──┐
└─────────────┘  │
                 │
┌─────────────┐  │    ┌──────────────┐
│   Worker    │──┼───▶│  Prometheus  │
└─────────────┘  │    └──────┬───────┘
                 │           │
┌─────────────┐  │           │
│  PostgreSQL │──┤           │
└─────────────┘  │           ▼
                 │    ┌──────────────┐
┌─────────────┐  │    │   Grafana    │
│    Redis    │──┘    └──────────────┘
└─────────────┘
                      ┌──────────────┐
                      │ Alertmanager │
                      └──────────────┘
```

## Metrics

### API Metrics

- `trading_http_requests_total`: Total HTTP requests
- `trading_http_request_duration_seconds`: Request duration
- `trading_http_request_size_bytes`: Request size
- `trading_http_response_size_bytes`: Response size

### Trading Metrics

- `trading_signals_generated_total`: Signals generated
- `trading_trades_executed_total`: Trades executed
- `trading_positions_open`: Open positions
- `trading_trade_pnl_usdt`: Trade P&L
- `trading_account_equity_usdt`: Account equity

### System Metrics

- `trading_active_connections`: Active connections
- `trading_database_connections`: Database connections
- `trading_redis_connections`: Redis connections
- `trading_cache_hits_total`: Cache hits
- `trading_cache_misses_total`: Cache misses

### Error Metrics

- `trading_errors_total`: Total errors
- `trading_errors_by_type_total`: Errors by type

## Dashboards

### 1. System Overview
- System health status
- Request rate and latency
- CPU, memory, disk usage
- Active connections
- Database connections

### 2. API Performance
- Request rate by route
- Response time percentiles
- Status code distribution
- Error rates
- Cache performance

### 3. Trading Metrics
- Signals generated
- Trades executed
- Open positions
- Account equity
- P&L distribution
- Market data latency
- Provider health

### 4. Error Monitoring
- Total errors
- Errors by component
- Errors by type
- HTTP errors by route
- External API errors

## Alerting

### Alert Severity Levels

- **Critical**: Immediate action required (PagerDuty + Slack)
- **Warning**: Attention needed (Slack only)

### Alert Rules

#### API Alerts
- High error rate (>5% for 5m)
- High API latency (p95 >2s for 5m)
- Critical API latency (p95 >5s for 2m)

#### Database Alerts
- Database connection down
- High database connection usage (>80%)
- Slow database queries (p95 >1s)

#### System Alerts
- High CPU usage (>80% for 5m)
- Critical CPU usage (>95% for 2m)
- High memory usage (>85% for 5m)
- Low disk space (<15%)

#### Trading Alerts
- Signal generation failure
- High order rejection rate (>20%)
- High market data latency (>1s)
- No market ticks received
- High trading losses

## Health Checks

### Liveness Probe
```bash
curl http://localhost:3000/health/live
```

Returns 200 if application is running.

### Readiness Probe
```bash
curl http://localhost:3000/health/ready
```

Returns 200 if application is ready to serve traffic (all dependencies healthy).

### Full Health Check
```bash
curl http://localhost:3000/health
```

Returns detailed health information including all dependencies.

## Logging

### Structured Logging

All logs are in JSON format with:
- Timestamp
- Log level
- Message
- Context (requestId, userId, etc.)
- Error details (if applicable)

### Log Levels

- `trace`: Very detailed debugging
- `debug`: Debugging information
- `info`: General information
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Fatal errors

### Log Aggregation

Logs are collected by Promtail and sent to Loki for aggregation and querying.

Query logs in Grafana:
```logql
{job="trading-api"} |= "error"
```

## Distributed Tracing

### OpenTelemetry

Traces are collected using OpenTelemetry and sent to Jaeger.

View traces in Jaeger UI: http://localhost:16686

### Trace Context

Each trace includes:
- Operation name
- Duration
- Status (OK/ERROR)
- Attributes (HTTP method, route, status code, etc.)
- Events
- Exceptions

## Performance Profiling

### CPU Profiling

Sentry automatically collects CPU profiles for performance analysis.

### Memory Profiling

Monitor memory usage through Prometheus metrics:
```promql
process_resident_memory_bytes
nodejs_heap_size_used_bytes
```

## Maintenance

### Data Retention

- **Prometheus**: 30 days
- **Loki**: 31 days
- **Jaeger**: 7 days (default)

### Backup

```bash
# Backup Prometheus data
docker run --rm -v trading-prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data

# Backup Grafana data
docker run --rm -v trading-grafana-data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz /data
```

### Cleanup

```bash
# Stop and remove all monitoring services
docker-compose -f docker-compose.monitoring.yml down

# Remove volumes (WARNING: deletes all data)
docker-compose -f docker-compose.monitoring.yml down -v
```

## Troubleshooting

### Prometheus Not Scraping Targets

1. Check target status: http://localhost:9090/targets
2. Verify network connectivity
3. Check firewall rules
4. Verify metrics endpoint is accessible

### Grafana Dashboard Not Loading

1. Check Prometheus datasource connection
2. Verify Prometheus is running
3. Check Grafana logs: `docker logs trading-grafana`

### Alerts Not Firing

1. Check alert rules: http://localhost:9090/alerts
2. Verify Alertmanager is running
3. Check Alertmanager logs: `docker logs trading-alertmanager`
4. Verify webhook URLs are correct

### High Memory Usage

1. Reduce Prometheus retention period
2. Decrease scrape frequency
3. Limit number of metrics collected
4. Increase container memory limits

## Best Practices

1. **Set up alerts early**: Don't wait for production issues
2. **Monitor what matters**: Focus on business metrics, not just system metrics
3. **Use SLOs**: Define Service Level Objectives and track them
4. **Regular reviews**: Review dashboards and alerts regularly
5. **Document runbooks**: Create runbooks for common alerts
6. **Test alerts**: Regularly test alert routing and notifications
7. **Optimize queries**: Use recording rules for expensive queries
8. **Secure access**: Use authentication and HTTPS in production
9. **Backup data**: Regular backups of Prometheus and Grafana data
10. **Monitor the monitors**: Set up alerts for monitoring system health

## Integration with Application

### Add Metrics to Your Code

```typescript
import { getMetrics } from '@trade/shared/metrics/prometheus';

const metrics = getMetrics();

// Record a signal
metrics.recordSignal('BTC-USDT', 'LONG', 'high');

// Record a trade
metrics.recordTrade('BTC-USDT', 'LONG', 'filled', 150.50);

// Record external API call
metrics.recordExternalApiCall('binance', '/api/v3/ticker', 'success', 0.123);
```

### Add Health Checks

```typescript
import { HealthCheckManager } from '@trade/api/health/health-checks';

const healthManager = new HealthCheckManager({
  pgClient,
  redisClient,
  timeout: 5000
});

// Register health check routes
app.get('/health/live', async () => {
  return healthManager.checkLiveness();
});

app.get('/health/ready', async () => {
  return healthManager.checkReadiness();
});
```

### Add Tracing

```typescript
import { getTelemetry } from '@trade/shared/telemetry/opentelemetry';

const telemetry = getTelemetry({
  serviceName: 'trading-api',
  serviceVersion: '1.0.0',
  environment: 'production'
});

// Trace an async operation
await telemetry.traceAsync('fetchMarketData', async (span) => {
  span.setAttribute('symbol', 'BTC-USDT');
  const data = await fetchData();
  return data;
});
```

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.monitoring.yml logs`
2. Review documentation
3. Check Prometheus/Grafana community forums
4. Open an issue in the project repository
