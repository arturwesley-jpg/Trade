# Monitoring Setup Guide

## Overview

This document describes the comprehensive performance monitoring and alerting infrastructure for the Trade application.

## Architecture

The monitoring system consists of several integrated components:

### 1. Performance Monitor
- Tracks frontend and backend performance metrics
- Records Web Vitals (LCP, FID, CLS, FCP, TTFB, TTI)
- Monitors API response times
- Tracks WebSocket latency and connection metrics
- Records database query performance

### 2. Alerting Service
- Evaluates metrics against configurable thresholds
- Triggers alerts when conditions are met
- Supports multiple severity levels (info, warning, error, critical)
- Implements cooldown periods to prevent alert spam
- Provides alert resolution tracking

### 3. Health Check Service
- Monitors system component health
- Provides liveness and readiness probes for Kubernetes
- Supports periodic health checks
- Tracks PostgreSQL, Redis, WebSocket, and API health

### 4. Error Tracker
- Captures frontend and backend errors
- Tracks unhandled exceptions and promise rejections
- Provides error statistics and reporting
- Supports error severity classification

## Components

### Backend Components

#### Performance Middleware
**Location:** `/apps/api/src/middleware/performance.ts`

Tracks API request performance:
```typescript
import { performanceMiddleware } from './middleware/performance';

app.use(performanceMiddleware());
```

#### Database Performance Tracker
Wraps PostgreSQL client to track query performance:
```typescript
import { wrapPostgresClient, dbPerformanceTracker } from './middleware/performance';

const client = wrapPostgresClient(pgClient, dbPerformanceTracker);
```

#### WebSocket Performance Tracker
Tracks WebSocket connection metrics:
```typescript
import { wsPerformanceTracker } from './middleware/performance';

// On connection
wsPerformanceTracker.incrementConnections();

// On message
wsPerformanceTracker.incrementMessagesReceived();

// On latency measurement
wsPerformanceTracker.recordLatency(latencyMs);
```

#### Monitoring Routes
**Location:** `/apps/api/src/routes/monitoring.ts`

Provides monitoring API endpoints:
- `GET /api/monitoring/health` - Overall health status
- `GET /api/monitoring/health/liveness` - Liveness probe
- `GET /api/monitoring/health/readiness` - Readiness probe
- `GET /api/monitoring/metrics` - All performance metrics
- `GET /api/monitoring/metrics/:name` - Specific metric with stats
- `GET /api/monitoring/metrics/stats/summary` - Summary statistics
- `GET /api/monitoring/alerts` - All alerts
- `GET /api/monitoring/alerts/active` - Active alerts only
- `POST /api/monitoring/alerts/:id/resolve` - Resolve an alert
- `GET /api/monitoring/database` - Database metrics
- `GET /api/monitoring/websocket` - WebSocket metrics
- `GET /api/monitoring/system` - System information

### Frontend Components

#### Performance Monitoring Hook
**Location:** `/apps/web/src/hooks/usePerformanceMonitor.ts`

React hooks for performance tracking:

```typescript
import { usePerformanceMonitor, useAPIPerformanceTracking } from './hooks/usePerformanceMonitor';

// Track Web Vitals
function App() {
  usePerformanceMonitor({
    trackWebVitals: true,
    trackNavigation: true,
    trackResources: true
  });
  
  return <YourApp />;
}

// Track API calls
function DataComponent() {
  const { trackAPICall } = useAPIPerformanceTracking();
  
  const fetchData = async () => {
    const start = Date.now();
    try {
      const response = await fetch('/api/data');
      trackAPICall('/api/data', 'GET', response.status, Date.now() - start);
    } catch (error) {
      trackAPICall('/api/data', 'GET', 0, Date.now() - start, error.message);
    }
  };
}
```

#### Monitoring Dashboard
**Location:** `/apps/web/src/components/MonitoringDashboard.tsx`

Real-time monitoring dashboard component:
```typescript
import { MonitoringDashboard } from './components/MonitoringDashboard';

function AdminPage() {
  return <MonitoringDashboard />;
}
```

## Configuration

### Alert Rules

Default alert rules are configured in `/packages/shared/src/monitoring/alerting.ts`:

```typescript
const defaultAlertRules: AlertRule[] = [
  {
    name: 'high_lcp',
    metricName: 'web_vitals_lcp',
    condition: 'above',
    threshold: 2500, // 2.5s
    severity: 'warning',
    message: 'Largest Contentful Paint is above 2.5s',
    enabled: true
  },
  // ... more rules
];
```

### Custom Alert Rules

Add custom alert rules:
```typescript
import { alertingService } from '@trade/shared/monitoring';

alertingService.addRule({
  name: 'custom_metric_alert',
  metricName: 'custom_metric',
  condition: 'above',
  threshold: 100,
  severity: 'warning',
  message: 'Custom metric exceeded threshold',
  enabled: true
});
```

### Health Checks

Register custom health checks:
```typescript
import { healthChecker } from '@trade/shared/monitoring';

healthChecker.register('custom_service', async () => {
  try {
    // Check service health
    await customService.ping();
    return {
      status: 'healthy',
      message: 'Service is responding'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message
    };
  }
});
```

## Integration

### Backend Integration

In your API server (`/apps/api/src/server.ts`):

```typescript
import { performanceMiddleware, dbPerformanceTracker, wrapPostgresClient } from './middleware/performance';
import { registerMonitoringRoutes } from './routes/monitoring';
import { healthChecker, registerPostgres, registerRedis } from '@trade/shared/monitoring';
import { setupBackendErrorTracking } from '@trade/shared/monitoring';

// Setup error tracking
setupBackendErrorTracking();

// Add performance middleware
app.use(performanceMiddleware());

// Wrap database client
const client = wrapPostgresClient(pgClient, dbPerformanceTracker);

// Register health checks
registerPostgres(healthChecker, client);
registerRedis(healthChecker, redisClient);

// Start periodic health checks
healthChecker.startPeriodicChecks(30000); // Every 30 seconds

// Register monitoring routes
registerMonitoringRoutes(app);
```

### Frontend Integration

In your React app (`/apps/web/src/App.tsx`):

```typescript
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor';
import { setupFrontendErrorTracking } from '@trade/shared/monitoring';

// Setup error tracking once
setupFrontendErrorTracking();

function App() {
  // Track Web Vitals
  usePerformanceMonitor({
    trackWebVitals: true,
    trackNavigation: true,
    trackResources: true
  });
  
  return (
    <Router>
      <Routes>
        <Route path="/admin/monitoring" element={<MonitoringDashboard />} />
        {/* other routes */}
      </Routes>
    </Router>
  );
}
```

## Metrics

### Web Vitals

- **LCP (Largest Contentful Paint)**: Time until largest content element is rendered
  - Good: ≤ 2.5s
  - Needs Improvement: 2.5s - 4.0s
  - Poor: > 4.0s

- **FID (First Input Delay)**: Time from user interaction to browser response
  - Good: ≤ 100ms
  - Needs Improvement: 100ms - 300ms
  - Poor: > 300ms

- **CLS (Cumulative Layout Shift)**: Visual stability score
  - Good: ≤ 0.1
  - Needs Improvement: 0.1 - 0.25
  - Poor: > 0.25

- **FCP (First Contentful Paint)**: Time until first content is rendered
- **TTFB (Time to First Byte)**: Time until first byte received from server
- **TTI (Time to Interactive)**: Time until page is fully interactive

### API Metrics

- **Request Duration**: Time to process API requests
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per second

### WebSocket Metrics

- **Active Connections**: Number of active WebSocket connections
- **Message Throughput**: Messages sent/received per second
- **Latency**: Round-trip message latency
- **Reconnection Rate**: Number of reconnections

### Database Metrics

- **Query Time**: Average database query execution time
- **Slow Queries**: Number of queries exceeding threshold
- **Connection Pool**: Active connections and pool size

## Alerting

### Alert Severities

- **Info**: Informational alerts, no action required
- **Warning**: Potential issues, monitor closely
- **Error**: Issues requiring attention
- **Critical**: Severe issues requiring immediate action

### Alert Lifecycle

1. **Triggered**: Alert is created when threshold is exceeded
2. **Cooldown**: Prevents duplicate alerts for same condition
3. **Resolved**: Alert is manually or automatically resolved

### Subscribing to Alerts

```typescript
import { alertingService } from '@trade/shared/monitoring';

const unsubscribe = alertingService.subscribe((alert) => {
  console.log('New alert:', alert);
  
  // Send notification (email, Slack, etc.)
  if (alert.severity === 'critical') {
    sendCriticalAlert(alert);
  }
});

// Cleanup
unsubscribe();
```

## Kubernetes Integration

### Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /api/monitoring/health/liveness
    port: 4000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /api/monitoring/health/readiness
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

## Monitoring Dashboard

The monitoring dashboard provides:

- **Real-time Metrics**: Live performance metrics with statistics
- **Active Alerts**: Current unresolved alerts
- **Alert History**: Recent alert activity
- **Metric Details**: Detailed statistics (min, max, avg, p95, p99)
- **Visual Indicators**: Color-coded status indicators

Access the dashboard at: `/admin/monitoring`

## Best Practices

### 1. Set Appropriate Thresholds

Configure alert thresholds based on your application's performance characteristics:
- Start with conservative thresholds
- Adjust based on actual performance data
- Consider different thresholds for different environments

### 2. Monitor Continuously

- Enable periodic health checks
- Review metrics regularly
- Investigate performance degradation trends

### 3. Act on Alerts

- Establish alert response procedures
- Prioritize by severity
- Document resolution steps

### 4. Optimize Performance

- Use metrics to identify bottlenecks
- Focus on high-impact optimizations
- Measure impact of changes

### 5. Error Tracking

- Review error reports regularly
- Fix high-frequency errors first
- Track error trends over time

## Troubleshooting

### High Memory Usage

Check system metrics:
```bash
curl http://localhost:4000/api/monitoring/system
```

### Slow API Responses

Check API metrics:
```bash
curl http://localhost:4000/api/monitoring/metrics/api_request_duration
```

### Database Performance Issues

Check database metrics:
```bash
curl http://localhost:4000/api/monitoring/database
```

### WebSocket Connection Issues

Check WebSocket metrics:
```bash
curl http://localhost:4000/api/monitoring/websocket
```

## External Monitoring Services

While this implementation provides comprehensive built-in monitoring, you can integrate with external services:

### Sentry (Error Tracking)

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

// Forward errors to Sentry
errorTracker.subscribe((error) => {
  Sentry.captureException(new Error(error.message));
});
```

### DataDog (Metrics & APM)

```typescript
import { StatsD } from 'node-dogstatsd';

const statsd = new StatsD();

// Forward metrics to DataDog
performanceMonitor.subscribe((metric) => {
  statsd.gauge(metric.name, metric.value, metric.tags);
});
```

### Prometheus (Metrics)

```typescript
import { register, Counter, Histogram } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status']
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Maintenance

### Clear Old Data

Metrics and alerts are automatically trimmed to prevent memory issues:
- Performance metrics: Last 10,000 samples
- Alerts: Last 1,000 alerts
- Errors: Last 1,000 errors

Manual cleanup:
```bash
# Clear metrics
curl -X POST http://localhost:4000/api/monitoring/metrics/clear

# Clear alerts
curl -X POST http://localhost:4000/api/monitoring/alerts/clear
```

### Update Alert Rules

```typescript
// Enable/disable rules
alertingService.setRuleEnabled('high_lcp', false);

// Update thresholds
alertingService.addRule({
  name: 'high_lcp',
  metricName: 'web_vitals_lcp',
  condition: 'above',
  threshold: 3000, // Updated threshold
  severity: 'warning',
  message: 'Largest Contentful Paint is above 3s',
  enabled: true
});
```

## Summary

The monitoring infrastructure provides:

- Comprehensive performance tracking
- Real-time alerting
- Health monitoring
- Error tracking
- Kubernetes integration
- Extensible architecture

All monitoring data is available through REST APIs and can be visualized in the built-in dashboard or integrated with external monitoring services.
