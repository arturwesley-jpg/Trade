/**
 * Example: Integrating Monitoring into Backend API
 */

import Fastify from 'fastify';
import type { Client } from 'pg';
import { initializeMonitoring, cleanupMonitoring } from './monitoring-setup.js';
import { wsPerformanceTracker } from './middleware/performance.js';
import { degradationManager } from '@trade/shared/monitoring';

async function startServer() {
  const app = Fastify({ logger: true });

  // Database client (example)
  const pgClient = {} as Client; // Your actual PostgreSQL client

  // Initialize monitoring
  initializeMonitoring(app, pgClient);

  // Example: Track WebSocket connections
  app.get('/ws', { websocket: true }, (connection, req) => {
    wsPerformanceTracker.incrementConnections();

    connection.on('message', (message) => {
      wsPerformanceTracker.incrementMessagesReceived();

      // Process message...

      wsPerformanceTracker.incrementMessagesSent();
    });

    connection.on('close', () => {
      wsPerformanceTracker.decrementConnections();
    });

    connection.on('error', () => {
      wsPerformanceTracker.incrementErrors();
    });
  });

  // Example: Using circuit breaker for external API calls
  app.get('/api/external-data', async (req, reply) => {
    try {
      const data = await degradationManager.executeWithFallback(
        'external_api',
        async () => {
          // Call external API
          const response = await fetch('https://api.example.com/data');
          return response.json();
        },
        async () => {
          // Fallback: return cached or default data
          return { status: 'degraded', data: [] };
        },
        'external_data_cache_key'
      );

      reply.send(data);
    } catch (error) {
      reply.status(503).send({ error: 'Service unavailable' });
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    cleanupMonitoring();
    await app.close();
    process.exit(0);
  });

  await app.listen({ port: 4000, host: '0.0.0.0' });
  console.log('Server started on port 4000');
}

startServer().catch(console.error);
