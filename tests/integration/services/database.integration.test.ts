import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@trade/database';
import { Cache } from '@trade/shared';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Users table', () => {
    it('should insert and retrieve user', async () => {
      const user = {
        email: 'db-test@example.com',
        password_hash: 'hashed_password',
        name: 'DB Test User',
      };

      const [userId] = await db('users').insert(user).returning('id');

      const retrieved = await db('users').where('id', userId).first();

      expect(retrieved).toBeDefined();
      expect(retrieved.email).toBe(user.email);
      expect(retrieved.name).toBe(user.name);

      await db('users').where('id', userId).del();
    });

    it('should enforce unique email constraint', async () => {
      const user = {
        email: 'unique-test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User',
      };

      await db('users').insert(user);

      await expect(
        db('users').insert(user)
      ).rejects.toThrow();

      await db('users').where('email', user.email).del();
    });
  });

  describe('Signals table', () => {
    it('should insert and retrieve signal', async () => {
      const signal = {
        symbol: 'BTC-USDT',
        signal: 'BUY',
        confidence: 75,
        strength: 80,
        indicators: JSON.stringify({
          rsi: { value: 45, signal: 'BUY' },
        }),
        explanation: 'Test signal',
      };

      const [signalId] = await db('signals').insert(signal).returning('id');

      const retrieved = await db('signals').where('id', signalId).first();

      expect(retrieved).toBeDefined();
      expect(retrieved.symbol).toBe(signal.symbol);
      expect(retrieved.signal).toBe(signal.signal);

      await db('signals').where('id', signalId).del();
    });

    it('should query signals by symbol', async () => {
      const signals = [
        { symbol: 'BTC-USDT', signal: 'BUY', confidence: 75, strength: 80 },
        { symbol: 'ETH-USDT', signal: 'SELL', confidence: 70, strength: 75 },
        { symbol: 'BTC-USDT', signal: 'SELL', confidence: 65, strength: 70 },
      ];

      await db('signals').insert(signals);

      const btcSignals = await db('signals').where('symbol', 'BTC-USDT');

      expect(btcSignals).toHaveLength(2);
      expect(btcSignals.every((s: any) => s.symbol === 'BTC-USDT')).toBe(true);

      await db('signals').whereIn('symbol', ['BTC-USDT', 'ETH-USDT']).del();
    });
  });

  describe('Alerts table', () => {
    let testUserId: string;

    beforeAll(async () => {
      const [userId] = await db('users').insert({
        email: 'alerts-db-test@example.com',
        password_hash: 'hashed_password',
        name: 'Alerts DB Test',
      }).returning('id');

      testUserId = userId;
    });

    afterAll(async () => {
      await db('alerts').where('user_id', testUserId).del();
      await db('users').where('id', testUserId).del();
    });

    it('should insert and retrieve alert', async () => {
      const alert = {
        user_id: testUserId,
        symbol: 'BTC-USDT',
        type: 'PRICE',
        condition: 'ABOVE',
        value: 55000,
        active: true,
      };

      const [alertId] = await db('alerts').insert(alert).returning('id');

      const retrieved = await db('alerts').where('id', alertId).first();

      expect(retrieved).toBeDefined();
      expect(retrieved.symbol).toBe(alert.symbol);
      expect(retrieved.type).toBe(alert.type);

      await db('alerts').where('id', alertId).del();
    });

    it('should query active alerts', async () => {
      const alerts = [
        { user_id: testUserId, symbol: 'BTC-USDT', type: 'PRICE', condition: 'ABOVE', value: 55000, active: true },
        { user_id: testUserId, symbol: 'ETH-USDT', type: 'PRICE', condition: 'BELOW', value: 3000, active: false },
      ];

      await db('alerts').insert(alerts);

      const activeAlerts = await db('alerts')
        .where('user_id', testUserId)
        .where('active', true);

      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].active).toBe(true);

      await db('alerts').where('user_id', testUserId).del();
    });
  });

  describe('Trades table', () => {
    let testUserId: string;

    beforeAll(async () => {
      const [userId] = await db('users').insert({
        email: 'trades-db-test@example.com',
        password_hash: 'hashed_password',
        name: 'Trades DB Test',
      }).returning('id');

      testUserId = userId;
    });

    afterAll(async () => {
      await db('trades').where('user_id', testUserId).del();
      await db('users').where('id', testUserId).del();
    });

    it('should insert and retrieve trade', async () => {
      const trade = {
        user_id: testUserId,
        symbol: 'BTC-USDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0.1,
        price: 50000,
        status: 'FILLED',
      };

      const [tradeId] = await db('trades').insert(trade).returning('id');

      const retrieved = await db('trades').where('id', tradeId).first();

      expect(retrieved).toBeDefined();
      expect(retrieved.symbol).toBe(trade.symbol);
      expect(retrieved.side).toBe(trade.side);

      await db('trades').where('id', tradeId).del();
    });

    it('should calculate trade statistics', async () => {
      const trades = [
        { user_id: testUserId, symbol: 'BTC-USDT', side: 'BUY', type: 'MARKET', quantity: 0.1, price: 50000, status: 'FILLED', pnl: 500 },
        { user_id: testUserId, symbol: 'BTC-USDT', side: 'SELL', type: 'MARKET', quantity: 0.1, price: 51000, status: 'FILLED', pnl: -200 },
        { user_id: testUserId, symbol: 'ETH-USDT', side: 'BUY', type: 'MARKET', quantity: 1, price: 3000, status: 'FILLED', pnl: 300 },
      ];

      await db('trades').insert(trades);

      const stats = await db('trades')
        .where('user_id', testUserId)
        .sum('pnl as totalPnl')
        .count('* as totalTrades')
        .first();

      expect(stats.totalTrades).toBe('3');
      expect(Number(stats.totalPnl)).toBe(600);

      await db('trades').where('user_id', testUserId).del();
    });
  });

  describe('Cache operations', () => {
    let cache: Cache;

    beforeAll(() => {
      cache = new Cache({ ttl: 60, maxSize: 100 });
    });

    it('should set and get cache value', async () => {
      await cache.set('test-key', { data: 'test-value' });

      const value = await cache.get('test-key');

      expect(value).toEqual({ data: 'test-value' });
    });

    it('should return null for non-existent key', async () => {
      const value = await cache.get('non-existent-key');

      expect(value).toBeNull();
    });

    it('should delete cache value', async () => {
      await cache.set('delete-test', { data: 'value' });
      await cache.del('delete-test');

      const value = await cache.get('delete-test');

      expect(value).toBeNull();
    });

    it('should respect TTL', async () => {
      const shortCache = new Cache({ ttl: 1, maxSize: 100 });

      await shortCache.set('ttl-test', { data: 'value' });

      await new Promise(resolve => setTimeout(resolve, 1100));

      const value = await shortCache.get('ttl-test');

      expect(value).toBeNull();
    });
  });
});
