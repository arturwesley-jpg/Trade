import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '@trade/database';

describe('API Integration Tests - Signals', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await db.migrate.latest();

    // Create test user and get token
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'signals-test@example.com',
        password: 'SecurePass123!',
        name: 'Signals Test User',
      });

    authToken = response.body.token;
    testUserId = response.body.user.id;
  });

  afterAll(async () => {
    await db('users').where('id', testUserId).del();
    await db.destroy();
  });

  describe('GET /api/signals', () => {
    it('should return list of signals', async () => {
      const response = await request(app)
        .get('/api/signals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('symbol');
        expect(response.body[0]).toHaveProperty('signal');
        expect(response.body[0]).toHaveProperty('confidence');
        expect(response.body[0]).toHaveProperty('timestamp');
      }
    });

    it('should filter signals by symbol', async () => {
      const response = await request(app)
        .get('/api/signals?symbol=BTC-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body.every((s: any) => s.symbol === 'BTC-USDT')).toBe(true);
      }
    });

    it('should filter signals by type', async () => {
      const response = await request(app)
        .get('/api/signals?signal=BUY')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body.every((s: any) => s.signal === 'BUY')).toBe(true);
      }
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/signals?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/signals')
        .expect(401);
    });
  });

  describe('GET /api/signals/:id', () => {
    it('should return signal details', async () => {
      const listResponse = await request(app)
        .get('/api/signals')
        .set('Authorization', `Bearer ${authToken}`);

      if (listResponse.body.length > 0) {
        const signalId = listResponse.body[0].id;

        const response = await request(app)
          .get(`/api/signals/${signalId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', signalId);
        expect(response.body).toHaveProperty('symbol');
        expect(response.body).toHaveProperty('indicators');
      }
    });

    it('should return 404 for non-existent signal', async () => {
      await request(app)
        .get('/api/signals/99999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/signals/generate', () => {
    it('should generate signal for symbol', async () => {
      const response = await request(app)
        .post('/api/signals/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTC-USDT',
        })
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTC-USDT');
      expect(response.body).toHaveProperty('signal');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('indicators');
    });

    it('should reject invalid symbol', async () => {
      await request(app)
        .post('/api/signals/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'INVALID',
        })
        .expect(400);
    });

    it('should reject missing symbol', async () => {
      await request(app)
        .post('/api/signals/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/signals/history/:symbol', () => {
    it('should return signal history for symbol', async () => {
      const response = await request(app)
        .get('/api/signals/history/BTC-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('symbol', 'BTC-USDT');
        expect(response.body[0]).toHaveProperty('signal');
        expect(response.body[0]).toHaveProperty('timestamp');
      }
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/signals/history/BTC-USDT?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/signals/stats', () => {
    it('should return signal statistics', async () => {
      const response = await request(app)
        .get('/api/signals/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalSignals');
      expect(response.body).toHaveProperty('buySignals');
      expect(response.body).toHaveProperty('sellSignals');
      expect(response.body).toHaveProperty('averageConfidence');
    });

    it('should filter stats by symbol', async () => {
      const response = await request(app)
        .get('/api/signals/stats?symbol=BTC-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTC-USDT');
      expect(response.body).toHaveProperty('totalSignals');
    });
  });
});
