import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '@trade/database';
import { generateMockAlert } from '../../utils/test-helpers';

describe('API Integration Tests - Alerts', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await db.migrate.latest();

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'alerts-test@example.com',
        password: 'SecurePass123!',
        name: 'Alerts Test User',
      });

    authToken = response.body.token;
    testUserId = response.body.user.id;
  });

  afterAll(async () => {
    await db('alerts').where('user_id', testUserId).del();
    await db('users').where('id', testUserId).del();
    await db.destroy();
  });

  describe('POST /api/alerts', () => {
    it('should create price alert', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTC-USDT',
          type: 'PRICE',
          condition: 'ABOVE',
          value: 55000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.symbol).toBe('BTC-USDT');
      expect(response.body.type).toBe('PRICE');
      expect(response.body.active).toBe(true);
    });

    it('should create signal alert', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'ETH-USDT',
          type: 'SIGNAL',
          condition: 'BUY',
          minConfidence: 70,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('SIGNAL');
    });

    it('should reject invalid alert type', async () => {
      await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTC-USDT',
          type: 'INVALID',
          condition: 'ABOVE',
          value: 55000,
        })
        .expect(400);
    });
  });

  describe('GET /api/alerts', () => {
    it('should return user alerts', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('symbol');
        expect(response.body[0]).toHaveProperty('type');
      }
    });

    it('should filter by symbol', async () => {
      const response = await request(app)
        .get('/api/alerts?symbol=BTC-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body.every((a: any) => a.symbol === 'BTC-USDT')).toBe(true);
      }
    });

    it('should filter by active status', async () => {
      const response = await request(app)
        .get('/api/alerts?active=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body.every((a: any) => a.active === true)).toBe(true);
      }
    });
  });

  describe('PUT /api/alerts/:id', () => {
    it('should update alert', async () => {
      const createResponse = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTC-USDT',
          type: 'PRICE',
          condition: 'ABOVE',
          value: 55000,
        });

      const alertId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          value: 60000,
          active: false,
        })
        .expect(200);

      expect(response.body.value).toBe(60000);
      expect(response.body.active).toBe(false);
    });

    it('should return 404 for non-existent alert', async () => {
      await request(app)
        .put('/api/alerts/99999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          value: 60000,
        })
        .expect(404);
    });
  });

  describe('DELETE /api/alerts/:id', () => {
    it('should delete alert', async () => {
      const createResponse = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTC-USDT',
          type: 'PRICE',
          condition: 'ABOVE',
          value: 55000,
        });

      const alertId = createResponse.body.id;

      await request(app)
        .delete(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      await request(app)
        .get(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/alerts/triggered', () => {
    it('should return triggered alerts', async () => {
      const response = await request(app)
        .get('/api/alerts/triggered')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('triggered', true);
      }
    });
  });
});
