/**
 * Monitoring API Routes
 * Exposes performance metrics and health check endpoints
 */

import type { FastifyInstance } from 'fastify';
import { performanceMonitor } from '@trade/shared/monitoring/performance-monitor';
import { alertingService } from '@trade/shared/monitoring/alerting';
import { healthChecker } from '@trade/shared/monitoring/health-check';
import { dbPerformanceTracker, wsPerformanceTracker } from '../middleware/performance.js';

export function registerMonitoringRoutes(app: FastifyInstance) {
  /**
   * GET /api/monitoring/health
   * Health check endpoint
   */
  app.get('/api/monitoring/health', async (req, res) => {
    try {
      const health = await healthChecker.checkAll();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).send(health);
    } catch (error) {
      res.status(503).send({
        status: 'unhealthy',
        timestamp: Date.now(),
        checks: {},
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  });

  /**
   * GET /api/monitoring/health/liveness
   * Kubernetes liveness probe
   */
  app.get('/api/monitoring/health/liveness', async (req, res) => {
    const alive = await healthChecker.liveness();
    res.status(alive ? 200 : 503).send({ alive });
  });

  /**
   * GET /api/monitoring/health/readiness
   * Kubernetes readiness probe
   */
  app.get('/api/monitoring/health/readiness', async (req, res) => {
    const ready = await healthChecker.readiness();
    res.status(ready ? 200 : 503).send({ ready });
  });

  /**
   * GET /api/monitoring/metrics
   * Get all performance metrics
   */
  app.get('/api/monitoring/metrics', (req, res) => {
    const query = req.query as { since?: string };
    const since = query.since ? parseInt(query.since) : Date.now() - 300000;
    const metrics = performanceMonitor.getAllMetrics(since);
    res.send({ metrics, count: metrics.length });
  });

  /**
   * GET /api/monitoring/metrics/:name
   * Get specific metric with statistics
   */
  app.get('/api/monitoring/metrics/:name', (req, res) => {
    const params = req.params as { name: string | string[] };
    const query = req.query as { since?: string };
    const name = Array.isArray(params.name) ? params.name[0] : params.name;
    const since = query.since ? parseInt(query.since) : Date.now() - 300000;

    const metrics = performanceMonitor.getMetrics(name, since);
    const stats = performanceMonitor.getStats(name, since);

    res.send({
      name,
      metrics,
      stats,
      count: metrics.length
    });
  });

  /**
   * GET /api/monitoring/metrics/stats/summary
   * Get summary statistics for all metrics
   */
  app.get('/api/monitoring/metrics/stats/summary', (req, res) => {
    const query = req.query as { since?: string };
    const since = query.since ? parseInt(query.since) : Date.now() - 300000;

    const metricNames = [
      'web_vitals_lcp',
      'web_vitals_fid',
      'web_vitals_cls',
      'api_request_duration',
      'websocket_latency',
      'db_query_duration'
    ];

    const summary = metricNames.map(name => ({
      name,
      stats: performanceMonitor.getStats(name, since)
    })).filter(item => item.stats !== null);

    res.send({ summary });
  });

  /**
   * GET /api/monitoring/alerts
   * Get alerts
   */
  app.get('/api/monitoring/alerts', (req, res) => {
    const query = req.query as { severity?: string; resolved?: string; since?: string };
    const severity = query.severity as any;
    const resolved = query.resolved === 'true' ? true : query.resolved === 'false' ? false : undefined;
    const since = query.since ? parseInt(query.since) : undefined;

    const alerts = alertingService.getAlerts({ severity, resolved, since });
    res.send({ alerts, count: alerts.length });
  });

  /**
   * GET /api/monitoring/alerts/active
   * Get active (unresolved) alerts
   */
  app.get('/api/monitoring/alerts/active', (req, res) => {
    const alerts = alertingService.getActiveAlerts();
    res.send({ alerts, count: alerts.length });
  });

  /**
   * POST /api/monitoring/alerts/:id/resolve
   * Resolve an alert
   */
  app.post('/api/monitoring/alerts/:id/resolve', (req, res) => {
    const params = req.params as { id: string | string[] };
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const resolved = alertingService.resolveAlert(id);

    if (resolved) {
      res.send({ success: true, message: 'Alert resolved' });
    } else {
      res.status(404).send({ success: false, message: 'Alert not found or already resolved' });
    }
  });

  /**
   * GET /api/monitoring/database
   * Get database performance metrics
   */
  app.get('/api/monitoring/database', (req, res) => {
    const metrics = dbPerformanceTracker.getMetrics();
    res.send(metrics);
  });

  /**
   * GET /api/monitoring/websocket
   * Get WebSocket performance metrics
   */
  app.get('/api/monitoring/websocket', (req, res) => {
    const metrics = wsPerformanceTracker.getMetrics();
    res.send(metrics);
  });

  /**
   * POST /api/monitoring/metrics/clear
   * Clear all metrics (admin only)
   */
  app.post('/api/monitoring/metrics/clear', (req, res) => {
    performanceMonitor.clear();
    res.send({ success: true, message: 'Metrics cleared' });
  });

  /**
   * POST /api/monitoring/alerts/clear
   * Clear all alerts (admin only)
   */
  app.post('/api/monitoring/alerts/clear', (req, res) => {
    alertingService.clear();
    res.send({ success: true, message: 'Alerts cleared' });
  });

  /**
   * GET /api/monitoring/system
   * Get system information
   */
  app.get('/api/monitoring/system', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    res.send({
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    });
  });
}
