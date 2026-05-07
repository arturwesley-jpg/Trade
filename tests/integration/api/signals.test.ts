import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestServer, cleanupDatabase } from '../helpers/setup';
import { createTestUser, createAuthHeaders } from '../helpers/factories';
import type { FastifyInstance } from 'fastify';

describe('Signals API Integration Tests', () => {
  let server: FastifyInstance;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    server = await createTestServer();
    const user = await createTestUser();
    authHeaders = await createAuthHeaders(server, user);
  });

  afterAll(async () => {
    await server.close();
    await cleanupDatabase();
  });

  describe('GET /api/signals', () => {
    it('should get list of signals', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/signals',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.signals)).toBe(true);
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
    });

    it('should filter signals by symbol', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/signals?symbol=BTCUSDT',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      body.signals.forEach((signal: any) => {
        expect(signal.symbol).toBe('BTCUSDT');
      });
    });

    it('should filter signals by type', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/signals?type=LONG',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      body.signals.forEach((signal: any) => {
        expect(signal.type).toBe('LONG');
      });
    });

    it('should paginate signals', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/signals?page=1&limit=10',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.signals.length).toBeLessThanOrEqual(10);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/signals'
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/signals/:id', () => {
    it('should get signal by id', async () => {
      // First create a signal
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'BTCUSDT'
        }
      });

      const signalId = createResponse.json().signal.id;

      const response = await server.inject({
        method: 'GET',
        url: `/api/signals/${signalId}`,
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(signalId);
      expect(body).toHaveProperty('symbol');
      expect(body).toHaveProperty('type');
      expect(body).toHaveProperty('confidence');
    });

    it('should return 404 for non-existent signal', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/signals/99999',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toContain('not found');
    });
  });

  describe('POST /api/signals/generate', () => {
    it('should generate signal for valid symbol', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'BTCUSDT'
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('signal');
      expect(body.signal.symbol).toBe('BTCUSDT');
      expect(body.signal).toHaveProperty('type');
      expect(body.signal).toHaveProperty('confidence');
      expect(body.signal).toHaveProperty('indicators');
      expect(body.signal.confidence).toBeGreaterThanOrEqual(0);
      expect(body.signal.confidence).toBeLessThanOrEqual(1);
    });

    it('should include technical indicators in signal', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'ETHUSDT'
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.signal.indicators).toBeDefined();
      expect(body.signal.indicators).toHaveProperty('rsi');
      expect(body.signal.indicators).toHaveProperty('macd');
      expect(body.signal.indicators).toHaveProperty('bollingerBands');
    });

    it('should include sentiment analysis in signal', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'BTCUSDT',
          includeSentiment: true
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.signal).toHaveProperty('sentiment');
      expect(body.signal.sentiment).toHaveProperty('score');
      expect(body.signal.sentiment).toHaveProperty('sources');
    });

    it('should reject invalid symbol', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'INVALID'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('Invalid symbol');
    });

    it('should rate limit signal generation', async () => {
      const requests = Array.from({ length: 15 }, () =>
        server.inject({
          method: 'POST',
          url: '/api/signals/generate',
          headers: authHeaders,
          payload: {
            symbol: 'BTCUSDT'
          }
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.statusCode === 429);

      expect(rateLimited).toBe(true);
    });
  });

  describe('POST /api/signals/:id/execute', () => {
    let signalId: number;

    beforeEach(async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'BTCUSDT'
        }
      });
      signalId = createResponse.json().signal.id;
    });

    it('should execute signal and create order', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/signals/${signalId}/execute`,
        headers: authHeaders,
        payload: {
          amount: 0.01,
          leverage: 10
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('order');
      expect(body.order.signalId).toBe(signalId);
      expect(body.order.amount).toBe(0.01);
      expect(body.order.leverage).toBe(10);
      expect(body.order.status).toBe('OPEN');
    });

    it('should reject execution with invalid amount', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/signals/${signalId}/execute`,
        headers: authHeaders,
        payload: {
          amount: -1,
          leverage: 10
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('amount');
    });

    it('should reject execution with excessive leverage', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/signals/${signalId}/execute`,
        headers: authHeaders,
        payload: {
          amount: 0.01,
          leverage: 150
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('leverage');
    });

    it('should prevent duplicate execution', async () => {
      // Execute once
      await server.inject({
        method: 'POST',
        url: `/api/signals/${signalId}/execute`,
        headers: authHeaders,
        payload: {
          amount: 0.01,
          leverage: 10
        }
      });

      // Try to execute again
      const response = await server.inject({
        method: 'POST',
        url: `/api/signals/${signalId}/execute`,
        headers: authHeaders,
        payload: {
          amount: 0.01,
          leverage: 10
        }
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('already executed');
    });
  });

  describe('DELETE /api/signals/:id', () => {
    it('should delete signal', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'BTCUSDT'
        }
      });

      const signalId = createResponse.json().signal.id;

      const response = await server.inject({
        method: 'DELETE',
        url: `/api/signals/${signalId}`,
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toContain('deleted');

      // Verify it's deleted
      const getResponse = await server.inject({
        method: 'GET',
        url: `/api/signals/${signalId}`,
        headers: authHeaders
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should not delete executed signal', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/signals/generate',
        headers: authHeaders,
        payload: {
          symbol: 'BTCUSDT'
        }
      });

      const signalId = createResponse.json().signal.id;

      // Execute the signal
      await server.inject({
        method: 'POST',
        url: `/api/signals/${signalId}/execute`,
        headers: authHeaders,
        payload: {
          amount: 0.01,
          leverage: 10
        }
      });

      // Try to delete
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/signals/${signalId}`,
        headers: authHeaders
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('cannot delete executed signal');
    });
  });
});
