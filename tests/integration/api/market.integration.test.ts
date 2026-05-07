import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '@trade/database';

describe('API Integration Tests - Market Data', () => {
  let authToken: string;

  beforeAll(async () => {
    await db.migrate.latest();

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'market-test@example.com',
        password: 'SecurePass123!',
        name: 'Market Test User',
      });

    authToken = response.body.token;
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('GET /api/market/candles/:symbol', () => {
    it('should return candle data', async () => {
      const response = await request(app)
        .get('/api/market/candles/BTC-USDT?interval=1h&limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('timestamp');
        expect(response.body[0]).toHaveProperty('open');
        expect(response.body[0]).toHaveProperty('high');
        expect(response.body[0]).toHaveProperty('low');
        expect(response.body[0]).toHaveProperty('close');
        expect(response.body[0]).toHaveProperty('volume');
      }
    });

    it('should support different intervals', async () => {
      const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

      for (const interval of intervals) {
        const response = await request(app)
          .get(`/api/market/candles/BTC-USDT?interval=${interval}&limit=10`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it('should reject invalid interval', async () => {
      await request(app)
        .get('/api/market/candles/BTC-USDT?interval=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/market/ticker/:symbol', () => {
    it('should return ticker data', async () => {
      const response = await request(app)
        .get('/api/market/ticker/BTC-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTC-USDT');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('volume');
      expect(response.body).toHaveProperty('change24h');
    });

    it('should return 404 for invalid symbol', async () => {
      await request(app)
        .get('/api/market/ticker/INVALID-PAIR')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/market/orderbook/:symbol', () => {
    it('should return orderbook data', async () => {
      const response = await request(app)
        .get('/api/market/orderbook/BTC-USDT?depth=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('bids');
      expect(response.body).toHaveProperty('asks');
      expect(Array.isArray(response.body.bids)).toBe(true);
      expect(Array.isArray(response.body.asks)).toBe(true);

      if (response.body.bids.length > 0) {
        expect(response.body.bids[0]).toHaveLength(2); // [price, quantity]
      }
    });

    it('should limit depth', async () => {
      const response = await request(app)
        .get('/api/market/orderbook/BTC-USDT?depth=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.bids.length).toBeLessThanOrEqual(10);
      expect(response.body.asks.length).toBeLessThanOrEqual(10);
    });
  });

  describe('GET /api/market/symbols', () => {
    it('should return list of available symbols', async () => {
      const response = await request(app)
        .get('/api/market/symbols')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('symbol');
        expect(response.body[0]).toHaveProperty('baseAsset');
        expect(response.body[0]).toHaveProperty('quoteAsset');
      }
    });

    it('should filter by quote asset', async () => {
      const response = await request(app)
        .get('/api/market/symbols?quote=USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body.every((s: any) => s.quoteAsset === 'USDT')).toBe(true);
      }
    });
  });

  describe('GET /api/market/stats/:symbol', () => {
    it('should return market statistics', async () => {
      const response = await request(app)
        .get('/api/market/stats/BTC-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTC-USDT');
      expect(response.body).toHaveProperty('high24h');
      expect(response.body).toHaveProperty('low24h');
      expect(response.body).toHaveProperty('volume24h');
      expect(response.body).toHaveProperty('priceChange24h');
      expect(response.body).toHaveProperty('priceChangePercent24h');
    });
  });
});
