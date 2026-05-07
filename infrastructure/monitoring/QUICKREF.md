# Monitoring and Observability - Quick Reference

## Services

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Grafana | 3001 | http://localhost:3001 | Dashboards and visualization |
| Prometheus | 9090 | http://localhost:9090 | Metrics collection and storage |
| Alertmanager | 9093 | http://localhost:9093 | Alert management |
| Jaeger | 16686 | http://localhost:16686 | Distributed tracing |
| Node Exporter | 9100 | http://localhost:9100 | System metrics |
| Postgres Exporter | 9187 | http://localhost:9187 | Database metrics |
| Redis Exporter | 9121 | http://localhost:9121 | Cache metrics |
| Loki | 3100 | http://localhost:3100 | Log aggregation |

## Quick Commands

```bash
# Start monitoring stack
./infrastructure/monitoring/start-monitoring.sh

# Stop monitoring stack
./infrastructure/monitoring/stop-monitoring.sh

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Restart a service
docker-compose -f docker-compose.monitoring.yml restart prometheus

# Check service status
docker-compose -f docker-compose.monitoring.yml ps
```

## Key Metrics

### HTTP Metrics
- `trading_http_requests_total` - Total HTTP requests
- `trading_http_request_duration_seconds` - Request duration
- `trading_http_request_size_bytes` - Request size
- `trading_http_response_size_bytes` - Response size

### Trading Metrics
- `trading_signals_generated_total` - Signals generated
- `trading_trades_executed_total` - Trades executed
- `trading_positions_open` - Open positions
- `trading_trade_pnl_usdt` - Trade P&L
- `trading_account_equity_usdt` - Account equity

### System Metrics
- `trading_active_connections` - Active connections
- `trading_database_connections` - Database connections
- `trading_cache_hits_total` - Cache hits
- `trading_errors_total` - Total errors

## Dashboards

1. **System Overview** - Overall system health and performance
2. **API Performance** - API metrics and latency
3. **Trading Metrics** - Trading-specific business metrics
4. **Error Monitoring** - Error tracking and analysis
5. **Alert Monitoring** - Alert status and history

## Health Checks

```bash
# Liveness probe
curl http://localhost:3000/health/live

# Readiness probe
curl http://localhost:3000/health/ready

# Full health check
curl http://localhost:3000/health
```

## Alert Severity

- **Critical** - Immediate action required (PagerDuty + Slack)
- **Warning** - Attention needed (Slack only)

## Common Queries

### Prometheus Queries

```promql
# Request rate
sum(rate(trading_http_requests_total[5m]))

# Error rate
sum(rate(trading_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(trading_http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, sum(rate(trading_http_request_duration_seconds_bucket[5m])) by (le))

# Active positions
sum(trading_positions_open)

# Cache hit rate
sum(rate(trading_cache_hits_total[5m])) / (sum(rate(trading_cache_hits_total[5m])) + sum(rate(trading_cache_misses_total[5m])))
```

### Loki Queries

```logql
# All errors
{job="trading-api"} |= "error"

# Errors in last hour
{job="trading-api"} |= "error" | json | __error__="" | line_format "{{.msg}}"

# Slow queries
{job="trading-api"} | json | duration > 1s
```

## Troubleshooting

### Service not starting
```bash
# Check logs
docker-compose -f docker-compose.monitoring.yml logs [service-name]

# Restart service
docker-compose -f docker-compose.monitoring.yml restart [service-name]
```

### Metrics not appearing
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check metrics endpoint
curl http://localhost:3000/metrics
```

### Alerts not firing
```bash
# Check alert rules
curl http://localhost:9090/api/v1/rules

# Check Alertmanager
curl http://localhost:9093/api/v2/status
```

## Integration Code

### Record Metrics
```typescript
import { getMetrics } from '@trade/shared/metrics/prometheus';

const metrics = getMetrics();
metrics.recordSignal('BTC-USDT', 'LONG', 'high');
metrics.recordTrade('BTC-USDT', 'LONG', 'filled', 150.50);
```

### Add Tracing
```typescript
import { getTelemetry } from '@trade/shared/telemetry/opentelemetry';

const telemetry = getTelemetry();
await telemetry.traceAsync('operation', async (span) => {
  span.setAttribute('key', 'value');
  return await doWork();
});
```

### Track Errors
```typescript
import { getSentry } from '@trade/shared/telemetry/sentry';

const sentry = getSentry();
sentry.captureException(error, { context: 'data' });
```

## Support

- Documentation: `infrastructure/monitoring/README.md`
- Setup Guide: `infrastructure/monitoring/SETUP.md`
- Example Code: `apps/api/src/monitoring-example.ts`
