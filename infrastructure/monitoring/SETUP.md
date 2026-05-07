# Monitoring Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- PostgreSQL and Redis running

## Step 1: Install Dependencies

```bash
# Install monitoring dependencies
npm install

# Or install specific packages
npm install prom-client @opentelemetry/api @opentelemetry/sdk-node @sentry/node
```

## Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp infrastructure/monitoring/.env.example infrastructure/monitoring/.env
```

Edit `.env` and configure:

```env
# Grafana credentials
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_password

# Database connection
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_db_password
POSTGRES_DB=trading

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_SERVICE_KEY=your_pagerduty_key

# Sentry (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# OpenTelemetry (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Step 3: Start Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Check status
docker-compose -f docker-compose.monitoring.yml ps

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f
```

## Step 4: Verify Services

Check that all services are running:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (login with configured credentials)
- Alertmanager: http://localhost:9093
- Jaeger: http://localhost:16686

## Step 5: Import Grafana Dashboards

Dashboards are automatically provisioned from `infrastructure/monitoring/grafana/dashboards/`:

1. System Overview
2. API Performance
3. Trading Metrics
4. Error Monitoring
5. Alert Monitoring

Access them in Grafana under Dashboards.

## Step 6: Configure Alerts

Alerts are automatically loaded from `infrastructure/monitoring/prometheus/alerts.yml`.

Test alerts:

1. Go to Prometheus: http://localhost:9090/alerts
2. Check alert status
3. Trigger a test alert by stopping a service

## Step 7: Integrate with Application

Add monitoring to your API:

```typescript
import { initializeMonitoring } from './monitoring-example';

const app = Fastify();
await initializeMonitoring(app, pgClient, redisClient);
```

## Step 8: Verify Metrics

1. Check metrics endpoint: http://localhost:3000/metrics
2. Verify metrics in Prometheus: http://localhost:9090/graph
3. View dashboards in Grafana: http://localhost:3001

## Step 9: Test Health Checks

```bash
# Liveness probe
curl http://localhost:3000/health/live

# Readiness probe
curl http://localhost:3000/health/ready

# Full health check
curl http://localhost:3000/health
```

## Step 10: Configure Alerting Channels

### Slack

1. Create a Slack webhook: https://api.slack.com/messaging/webhooks
2. Add webhook URL to `.env`: `SLACK_WEBHOOK_URL=...`
3. Restart Alertmanager: `docker-compose -f docker-compose.monitoring.yml restart alertmanager`

### PagerDuty

1. Create a PagerDuty service
2. Get integration key
3. Add to `.env`: `PAGERDUTY_SERVICE_KEY=...`
4. Restart Alertmanager

## Troubleshooting

### Prometheus not scraping targets

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check network connectivity
docker-compose -f docker-compose.monitoring.yml exec prometheus ping api

# Verify metrics endpoint
curl http://localhost:3000/metrics
```

### Grafana dashboards not loading

```bash
# Check Grafana logs
docker-compose -f docker-compose.monitoring.yml logs grafana

# Verify datasource
curl -u admin:password http://localhost:3001/api/datasources

# Reimport dashboards
docker-compose -f docker-compose.monitoring.yml restart grafana
```

### Alerts not firing

```bash
# Check alert rules
curl http://localhost:9090/api/v1/rules

# Check Alertmanager status
curl http://localhost:9093/api/v2/status

# Test alert
curl -X POST http://localhost:9093/api/v1/alerts -d '[{"labels":{"alertname":"test"}}]'
```

## Production Considerations

1. **Security**:
   - Use strong passwords
   - Enable HTTPS
   - Restrict network access
   - Use authentication for all services

2. **Performance**:
   - Adjust scrape intervals based on load
   - Use recording rules for expensive queries
   - Set appropriate retention periods
   - Monitor monitoring system resource usage

3. **High Availability**:
   - Run multiple Prometheus instances
   - Use Thanos for long-term storage
   - Deploy Alertmanager in cluster mode
   - Use external storage for Grafana

4. **Backup**:
   - Regular backups of Prometheus data
   - Export Grafana dashboards
   - Version control alert rules
   - Document runbooks

## Next Steps

1. Customize dashboards for your needs
2. Add custom metrics for business logic
3. Create runbooks for common alerts
4. Set up log aggregation with Loki
5. Enable distributed tracing with Jaeger
6. Configure Sentry for error tracking
7. Set up performance profiling
8. Create SLO dashboards
9. Document monitoring procedures
10. Train team on monitoring tools

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
