import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, cleanupDatabase } from '../helpers/setup';
import { createTestUser, createAuthHeaders } from '../helpers/factories';
import type { FastifyInstance } from 'fastify';

describe('Market Data API Integration Tests', () => {
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

  describe('GET /api/market/ticks/:symbol', () => {
    it('should get latest market tick for symbol', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/ticks/BTCUSDT',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.symbol).toBe('BTCUSDT');
      expect(body).toHaveProperty('price');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('volume');
      expect(typeof body.price).toBe('number');
      expect(body.price).toBeGreaterThan(0);
    });

    it('should return 404 for invalid symbol', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/ticks/INVALID',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/market/candles/:symbol', () => {
    it('should get OHLCV candles for symbol', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/candles/BTCUSDT?interval=1h&limit=100',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.candles)).toBe(true);
      expect(body.candles.length).toBeLessThanOrEqual(100);

      if (body.candles.length > 0) {
        const candle = body.candles[0];
        expect(candle).toHaveProperty('timestamp');
        expect(candle).toHaveProperty('open');
        expect(candle).toHaveProperty('high');
        expect(candle).toHaveProperty('low');
        expect(candle).toHaveProperty('close');
        expect(candle).toHaveProperty('volume');
      }
    });

    it('should support different intervals', async () => {
      const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

      for (const interval of intervals) {
        const response = await server.inject({
          method: 'GET',
          url: `/api/market/candles/BTCUSDT?interval=${interval}&limit=10`,
          headers: authHeaders
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().interval).toBe(interval);
      }
    });

    it('should filter by date range', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      const response = await server.inject({
        method: 'GET',
        url: `/api/market/candles/BTCUSDT?interval=1d&startDate=${startDate}&endDate=${endDate}`,
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      body.candles.forEach((candle: any) => {
        const timestamp = new Date(candle.timestamp);
        expect(timestamp >= new Date(startDate)).toBe(true);
        expect(timestamp <= new Date(endDate)).toBe(true);
      });
    });

    it('should reject invalid interval', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/candles/BTCUSDT?interval=invalid',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('interval');
    });
  });

  describe('GET /api/market/orderbook/:symbol', () => {
    it('should get order book for symbol', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/orderbook/BTCUSDT',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('bids');
      expect(body).toHaveProperty('asks');
      expect(Array.isArray(body.bids)).toBe(true);
      expect(Array.isArray(body.asks)).toBe(true);

      if (body.bids.length > 0) {
        const bid = body.bids[0];
        expect(bid).toHaveProperty('price');
        expect(bid).toHaveProperty('quantity');
      }
    });

    it('should support depth parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/orderbook/BTCUSDT?depth=20',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.bids.length).toBeLessThanOrEqual(20);
      expect(body.asks.length).toBeLessThanOrEqual(20);
    });
  });

  describe('GET /api/market/symbols', () => {
    it('should get list of available symbols', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/symbols',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.symbols)).toBe(true);
      expect(body.symbols.length).toBeGreaterThan(0);

      const symbol = body.symbols[0];
      expect(symbol).toHaveProperty('symbol');
      expect(symbol).toHaveProperty('baseAsset');
      expect(symbol).toHaveProperty('quoteAsset');
      expect(symbol).toHaveProperty('status');
    });

    it('should filter symbols by quote asset', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/symbols?quoteAsset=USDT',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      body.symbols.forEach((symbol: any) => {
        expect(symbol.quoteAsset).toBe('USDT');
      });
    });
  });

  describe('GET /api/market/stats/:symbol', () => {
    it('should get 24h statistics for symbol', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/stats/BTCUSDT',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.symbol).toBe('BTCUSDT');
      expect(body).toHaveProperty('priceChange');
      expect(body).toHaveProperty('priceChangePercent');
      expect(body).toHaveProperty('high');
      expect(body).toHaveProperty('low');
      expect(body).toHaveProperty('volume');
      expect(body).toHaveProperty('quoteVolume');
    });
  });

  describe('GET /api/market/provider-status', () => {
    it('should get status of all market data providers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/market/provider-status',
        headers: authHeaders
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.providers)).toBe(true);

      if (body.providers.length > 0) {
        const provider = body.providers[0];
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('status');
        expect(provider).toHaveProperty('latency');
        expect(provider).toHaveProperty('lastUpdate');
        expect(['healthy', 'degraded', 'down']).toContain(provider.status);
      }
    });
  });
});
