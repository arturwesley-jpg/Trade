/**
 * Example: Integrating Monitoring into the Trading API
 */

import Fastify from 'fastify';
import { getMetrics, createMetricsPlugin } from '@trade/shared/metrics/prometheus';
import { getTelemetry, createTracingPlugin } from '@trade/shared/telemetry/opentelemetry';
import { getSentry, createSentryPlugin } from '@trade/shared/telemetry/sentry';
import { HealthCheckManager, createHealthCheckRoutes } from './health/index.js';
import { createLogger } from '@trade/shared/logger';
import type { Client } from 'pg';
import type { Redis } from 'ioredis';

const logger = createLogger({ name: 'trading-api' });

/**
 * Initialize monitoring and observability
 */
export async function initializeMonitoring(app: any, pgClient: Client, redisClient: Redis) {
  // 1. Initialize Prometheus Metrics
  const metrics = getMetrics({
    prefix: 'trading_',
    defaultLabels: {
      service: 'trading-api',
      environment: process.env.NODE_ENV ?? 'production',
      version: process.env.APP_VERSION ?? '1.0.0'
    }
  });

  // Register metrics plugin
  await app.register(createMetricsPlugin(metrics));

  logger.info('Prometheus metrics initialized');

  // 2. Initialize OpenTelemetry (if enabled)
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const telemetry = getTelemetry({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'trading-api',
      serviceVersion: process.env.OTEL_SERVICE_VERSION ?? '1.0.0',
      environment: process.env.NODE_ENV ?? 'production',
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      enableMetrics: true,
      enableTracing: true
    });

    // Register tracing plugin
    await app.register(createTracingPlugin(telemetry));

    logger.info('OpenTelemetry tracing initialized');
  }

  // 3. Initialize Sentry (if enabled)
  if (process.env.SENTRY_DSN) {
    const sentry = getSentry({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
      release: process.env.APP_VERSION,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0.1'),
      enabled: true
    });

    // Register Sentry plugin
    await app.register(createSentryPlugin(sentry));

    logger.info('Sentry error tracking initialized');
  }

  // 4. Initialize Health Checks
  const healthManager = new HealthCheckManager({
    pgClient,
    redisClient,
    timeout: 5000
  });

  // Register health check routes
  await app.register(createHealthCheckRoutes(healthManager));

  logger.info('Health checks initialized');

  // 5. Add custom metrics for business logic
  setupBusinessMetrics(app, metrics);

  logger.info('Monitoring and observability fully initialized');
}

/**
 * Setup business-specific metrics
 */
function setupBusinessMetrics(app: any, metrics: any) {
  // Example: Track signal generation
  app.addHook('onResponse', async (request: any, reply: any) => {
    if (request.url.includes('/signals') && request.method === 'POST') {
      const signal = request.body;
      if (signal) {
        metrics.recordSignal(
          signal.symbol ?? 'UNKNOWN',
          signal.type ?? 'UNKNOWN',
          signal.confidence ?? 'medium'
        );
      }
    }

    // Example: Track trade execution
    if (request.url.includes('/orders') && request.method === 'POST') {
      const order = request.body;
      if (order) {
        metrics.recordTrade(
          order.symbol ?? 'UNKNOWN',
          order.side ?? 'UNKNOWN',
          reply.statusCode === 200 ? 'filled' : 'rejected'
        );
      }
    }
  });
}

/**
 * Example usage in main app
 */
export async function createApp() {
  const app = Fastify({
    logger: createLogger({ name: 'trading-api', prettyPrint: true })
  });

  // Initialize database and cache clients
  const pgClient = {} as Client; // Your PostgreSQL client
  const redisClient = {} as Redis; // Your Redis client

  // Initialize monitoring
  await initializeMonitoring(app, pgClient, redisClient);

  // Your routes and business logic here
  app.get('/api/signals', async (request, reply) => {
    // Business logic
    return { signals: [] };
  });

  return app;
}

/**
 * Example: Manual metrics recording
 */
export function recordCustomMetrics() {
  const metrics = getMetrics();

  // Record a signal
  metrics.recordSignal('BTC-USDT', 'LONG', 'high');

  // Record a trade
  metrics.recordTrade('BTC-USDT', 'LONG', 'filled', 150.50);

  // Record external API call
  metrics.recordExternalApiCall('binance', '/api/v3/ticker', 'success', 0.123);

  // Record market tick
  metrics.recordMarketTick('BTC-USDT', 'binance', 0.005);

  // Record error
  metrics.recordError('error', 'trading', 'OrderRejected');

  // Update gauges
  metrics.positionsOpen.set({ symbol: 'BTC-USDT' }, 5);
  metrics.accountEquity.set(10000);
  metrics.alertsActive.set({ type: 'price', severity: 'warning' }, 2);
}

/**
 * Example: Using tracing
 */
export async function exampleTracing() {
  const telemetry = getTelemetry();

  // Trace an async operation
  const result = await telemetry.traceAsync(
    'fetchMarketData',
    async (span) => {
      span.setAttribute('symbol', 'BTC-USDT');
      span.setAttribute('provider', 'binance');

      // Your business logic
      const data = await fetchMarketData();

      span.addEvent('data_fetched', { records: data.length });

      return data;
    },
    { operation: 'market_data' }
  );

  return result;
}

async function fetchMarketData() {
  // Mock implementation
  return [];
}

/**
 * Example: Error tracking with Sentry
 */
export function exampleErrorTracking() {
  const sentry = getSentry();

  try {
    // Your business logic that might throw
    throw new Error('Order execution failed');
  } catch (error) {
    // Capture exception with context
    sentry.captureException(error as Error, {
      symbol: 'BTC-USDT',
      orderId: '12345',
      userId: 'user-123'
    });

    // Set user context
    sentry.setUser({
      id: 'user-123',
      email: 'user@example.com'
    });

    // Add breadcrumb
    sentry.addBreadcrumb({
      category: 'trading',
      message: 'Order submitted',
      level: 'info',
      data: {
        symbol: 'BTC-USDT',
        side: 'LONG'
      }
    });
  }
}
