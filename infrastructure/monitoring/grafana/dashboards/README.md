# Grafana Dashboards Configuration

This directory contains Grafana dashboard definitions for monitoring the Crypto Trading Bot.

## 📊 Available Dashboards

### 1. Trading Bot Overview
**File:** `trading-bot-overview.json`

Main dashboard showing:
- System health status
- Active trades
- P&L metrics
- API performance
- Error rates
- Resource usage

### 2. API Performance
**File:** `api-performance.json`

Detailed API metrics:
- Request rate
- Response times (p50, p95, p99)
- Error rates by endpoint
- HTTP status codes
- Request duration histogram

### 3. Database Performance
**File:** `database-performance.json`

Database monitoring:
- Connection pool usage
- Query performance
- Slow queries
- Transaction rates
- Lock waits
- Cache hit ratio

### 4. Trading Metrics
**File:** `trading-metrics.json`

Trading-specific metrics:
- Trade execution rate
- Win/loss ratio
- P&L over time
- Position sizes
- Risk metrics
- Strategy performance

### 5. Infrastructure
**File:** `infrastructure.json`

Infrastructure monitoring:
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Container metrics
- Pod health (Kubernetes)

### 6. Alerts
**File:** `alerts.json`

Active alerts and incidents:
- Critical alerts
- Warning alerts
- Alert history
- MTTR metrics
- Incident timeline

## 🚀 Installation

### Automatic Import

```bash
# Import all dashboards
./scripts/import-dashboards.sh

# Import specific dashboard
./scripts/import-dashboards.sh trading-bot-overview.json
```

### Manual Import

1. Open Grafana: http://localhost:3000
2. Navigate to Dashboards → Import
3. Upload JSON file or paste JSON content
4. Select Prometheus data source
5. Click Import

## 📝 Dashboard Variables

All dashboards support these variables:

- `$datasource` - Prometheus data source
- `$namespace` - Kubernetes namespace (default: trading-bot)
- `$pod` - Pod name filter
- `$interval` - Time interval for aggregation

## 🎨 Customization

### Adding New Panels

1. Edit dashboard in Grafana UI
2. Add panel with desired visualization
3. Configure query and thresholds
4. Save dashboard
5. Export JSON and commit to repository

### Modifying Queries

Example Prometheus queries used:

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Response time p95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU usage
rate(process_cpu_seconds_total[5m]) * 100

# Memory usage
process_resident_memory_bytes / 1024 / 1024
```

## 🔔 Alert Rules

Dashboards include alert rules for:

- High error rate (>5%)
- Slow response time (>1s p95)
- High CPU usage (>80%)
- High memory usage (>80%)
- Database connection failures
- Trading execution failures

## 📚 Best Practices

1. **Use consistent time ranges** across related panels
2. **Set appropriate refresh intervals** (5s for real-time, 1m for historical)
3. **Add descriptions** to panels for clarity
4. **Use thresholds** to highlight issues
5. **Group related metrics** in rows
6. **Test alerts** before enabling in production

## 🔗 Related Documentation

- [Monitoring Guide](../../docs/MONITORING_GUIDE.md)
- [Alert Configuration](../prometheus/alerts/)
- [Metrics Documentation](../../docs/METRICS.md)

## 📞 Support

For dashboard issues or requests:
- Create issue in repository
- Contact DevOps team
- Check Grafana documentation: https://grafana.com/docs/
