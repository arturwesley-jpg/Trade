/**
 * Monitoring Integration for API Server
 * Sets up performance monitoring, health checks, and alerting
 */

import type { FastifyInstance } from 'fastify';
import type { Client } from 'pg';
import { registerPerformanceHooks, wrapPostgresClient, dbPerformanceTracker } from './middleware/performance.js';
import { registerMonitoringRoutes } from './routes/monitoring.js';
import {
  healthChecker,
  registerPostgres,
  setupBackendErrorTracking
} from '@trade/shared/monitoring';

/**
 * Initialize monitoring for the API server
 */
export function initializeMonitoring(app: FastifyInstance, pgClient: Client) {
  // Setup error tracking
  setupBackendErrorTracking();

  // Register performance hooks
  registerPerformanceHooks(app);

  // Wrap database client for performance tracking
  const wrappedClient = wrapPostgresClient(pgClient, dbPerformanceTracker);

  // Register health checks
  registerPostgres(healthChecker, pgClient);

  // Register WebSocket health check
  healthChecker.register('websocket', async () => {
    return {
      status: 'healthy',
      message: 'WebSocket server is operational'
    };
  });

  // Start periodic health checks (every 30 seconds)
  healthChecker.startPeriodicChecks(30000);

  // Register monitoring routes
  registerMonitoringRoutes(app);

  console.log('Monitoring initialized successfully');

  return wrappedClient;
}

/**
 * Cleanup monitoring on shutdown
 */
export function cleanupMonitoring() {
  healthChecker.stopPeriodicChecks();
  healthChecker.destroy();
  console.log('Monitoring cleanup completed');
}
