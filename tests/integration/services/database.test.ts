import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseService } from '@trading-bot/database';
import { RedisService } from '@trade/shared';
import { cleanupDatabase } from '../helpers/setup';

describe('Database Integration Tests', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    db = new DatabaseService(process.env.TEST_DATABASE_URL!);
    await db.connect();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await db.disconnect();
  });

  describe('User Operations', () => {
    it('should create a new user', async () => {
      const user = await db.users.create({
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User'
      });

      expect(user).toHaveProperty('id');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    it('should find user by email', async () => {
      const created = await db.users.create({
        email: 'findme@example.com',
        password: 'hashed_password',
        name: 'Find Me'
      });

      const found = await db.users.findByEmail('findme@example.com');

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should update user', async () => {
      const user = await db.users.create({
        email: 'update@example.com',
        password: 'hashed_password',
        name: 'Original Name'
      });

      const updated = await db.users.update(user.id, {
        name: 'Updated Name'
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe('update@example.com');
    });

    it('should delete user', async () => {
      const user = await db.users.create({
        email: 'delete@example.com',
        password: 'hashed_password',
        name: 'Delete Me'
      });

      await db.users.delete(user.id);

      const found = await db.users.findById(user.id);
      expect(found).toBeNull();
    });
  });

  describe('Trade Operations', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await db.users.create({
        email: `trader-${Date.now()}@example.com`,
        password: 'hashed_password',
        name: 'Trader'
      });
      userId = user.id;
    });

    it('should create a trade', async () => {
      const trade = await db.trades.create({
        userId,
        symbol: 'BTCUSDT',
        type: 'LONG',
        entryPrice: 50000,
        amount: 0.1,
        leverage: 10,
        status: 'OPEN'
      });

      expect(trade).toHaveProperty('id');
      expect(trade.symbol).toBe('BTCUSDT');
      expect(trade.status).toBe('OPEN');
    });

    it('should find trades by user', async () => {
      await db.trades.create({
        userId,
        symbol: 'BTCUSDT',
        type: 'LONG',
        entryPrice: 50000,
        amount: 0.1,
        leverage: 10,
        status: 'OPEN'
      });

      await db.trades.create({
        userId,
        symbol: 'ETHUSDT',
        type: 'SHORT',
        entryPrice: 3000,
        amount: 1,
        leverage: 5,
        status: 'OPEN'
      });

      const trades = await db.trades.findByUser(userId);

      expect(trades.length).toBe(2);
    });

    it('should update trade status', async () => {
      const trade = await db.trades.create({
        userId,
        symbol: 'BTCUSDT',
        type: 'LONG',
        entryPrice: 50000,
        amount: 0.1,
        leverage: 10,
        status: 'OPEN'
      });

      const updated = await db.trades.update(trade.id, {
        status: 'CLOSED',
        exitPrice: 51000,
        pnl: 100
      });

      expect(updated.status).toBe('CLOSED');
      expect(updated.exitPrice).toBe(51000);
      expect(updated.pnl).toBe(100);
    });

    it('should calculate total PnL for user', async () => {
      await db.trades.create({
        userId,
        symbol: 'BTCUSDT',
        type: 'LONG',
        entryPrice: 50000,
        amount: 0.1,
        leverage: 10,
        status: 'CLOSED',
        exitPrice: 51000,
        pnl: 100
      });

      await db.trades.create({
        userId,
        symbol: 'ETHUSDT',
        type: 'SHORT',
        entryPrice: 3000,
        amount: 1,
        leverage: 5,
        status: 'CLOSED',
        exitPrice: 2900,
        pnl: 50
      });

      const totalPnl = await db.trades.getTotalPnl(userId);

      expect(totalPnl).toBe(150);
    });
  });

  describe('Signal Operations', () => {
    it('should create a signal', async () => {
      const signal = await db.signals.create({
        symbol: 'BTCUSDT',
        type: 'LONG',
        confidence: 0.85,
        price: 50000,
        indicators: {
          rsi: 65,
          macd: { value: 100, signal: 90, histogram: 10 }
        }
      });

      expect(signal).toHaveProperty('id');
      expect(signal.confidence).toBe(0.85);
    });

    it('should find recent signals', async () => {
      await db.signals.create({
        symbol: 'BTCUSDT',
        type: 'LONG',
        confidence: 0.85,
        price: 50000,
        indicators: {}
      });

      const signals = await db.signals.findRecent('BTCUSDT', 10);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('Transaction Handling', () => {
    it('should rollback on error', async () => {
      const initialCount = await db.users.count();

      try {
        await db.transaction(async (trx) => {
          await db.users.create({
            email: 'rollback@example.com',
            password: 'hashed_password',
            name: 'Rollback Test'
          }, trx);

          throw new Error('Force rollback');
        });
      } catch (error) {
        // Expected error
      }

      const finalCount = await db.users.count();
      expect(finalCount).toBe(initialCount);
    });

    it('should commit on success', async () => {
      const initialCount = await db.users.count();

      await db.transaction(async (trx) => {
        await db.users.create({
          email: 'commit@example.com',
          password: 'hashed_password',
          name: 'Commit Test'
        }, trx);
      });

      const finalCount = await db.users.count();
      expect(finalCount).toBe(initialCount + 1);
    });
  });

  describe('Query Performance', () => {
    it('should use indexes for common queries', async () => {
      const start = Date.now();

      await db.trades.findByUser('test-user-id');

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be fast with index
    });

    it('should handle concurrent writes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        db.users.create({
          email: `concurrent-${i}@example.com`,
          password: 'hashed_password',
          name: `User ${i}`
        })
      );

      const users = await Promise.all(promises);

      expect(users.length).toBe(10);
      const emails = users.map(u => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(10);
    });
  });
});

describe('Redis Integration Tests', () => {
  let redis: RedisService;

  beforeAll(async () => {
    redis = new RedisService(process.env.TEST_REDIS_URL!);
    await redis.connect();
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.disconnect();
  });

  describe('Basic Operations', () => {
    it('should set and get value', async () => {
      await redis.set('test-key', 'test-value');
      const value = await redis.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should set with expiration', async () => {
      await redis.set('expire-key', 'expire-value', 1);

      const immediate = await redis.get('expire-key');
      expect(immediate).toBe('expire-value');

      await new Promise(resolve => setTimeout(resolve, 1100));

      const expired = await redis.get('expire-key');
      expect(expired).toBeNull();
    });

    it('should delete key', async () => {
      await redis.set('delete-key', 'delete-value');
      await redis.del('delete-key');

      const value = await redis.get('delete-key');
      expect(value).toBeNull();
    });
  });

  describe('Pub/Sub', () => {
    it('should publish and subscribe to messages', async () => {
      const messages: string[] = [];

      await redis.subscribe('test-channel', (message) => {
        messages.push(message);
      });

      await redis.publish('test-channel', 'message-1');
      await redis.publish('test-channel', 'message-2');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toContain('message-1');
      expect(messages).toContain('message-2');
    });

    it('should unsubscribe from channel', async () => {
      const messages: string[] = [];

      await redis.subscribe('unsub-channel', (message) => {
        messages.push(message);
      });

      await redis.publish('unsub-channel', 'message-1');
      await redis.unsubscribe('unsub-channel');
      await redis.publish('unsub-channel', 'message-2');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toContain('message-1');
      expect(messages).not.toContain('message-2');
    });
  });

  describe('Hash Operations', () => {
    it('should set and get hash fields', async () => {
      await redis.hset('user:123', 'name', 'John Doe');
      await redis.hset('user:123', 'email', 'john@example.com');

      const name = await redis.hget('user:123', 'name');
      const email = await redis.hget('user:123', 'email');

      expect(name).toBe('John Doe');
      expect(email).toBe('john@example.com');
    });

    it('should get all hash fields', async () => {
      await redis.hset('user:456', 'name', 'Jane Doe');
      await redis.hset('user:456', 'email', 'jane@example.com');

      const user = await redis.hgetall('user:456');

      expect(user).toEqual({
        name: 'Jane Doe',
        email: 'jane@example.com'
      });
    });
  });

  describe('List Operations', () => {
    it('should push and pop from list', async () => {
      await redis.lpush('queue', 'item-1');
      await redis.lpush('queue', 'item-2');

      const item1 = await redis.rpop('queue');
      const item2 = await redis.rpop('queue');

      expect(item1).toBe('item-1');
      expect(item2).toBe('item-2');
    });

    it('should get list range', async () => {
      await redis.lpush('list', 'item-1');
      await redis.lpush('list', 'item-2');
      await redis.lpush('list', 'item-3');

      const items = await redis.lrange('list', 0, -1);

      expect(items).toEqual(['item-3', 'item-2', 'item-1']);
    });
  });
});
