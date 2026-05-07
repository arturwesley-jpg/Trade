import Redis from 'ioredis';
import { MarketTick, Candle } from '../types';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: {
    tick: number;
    candle: number;
  };
}

export class MarketDataCache {
  private redis: Redis;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = {
      ...config,
      keyPrefix: config.keyPrefix || 'market:',
      ttl: {
        tick: config.ttl?.tick || 60, // 1 minute
        candle: config.ttl?.candle || 3600, // 1 hour
      },
    };

    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      keyPrefix: this.config.keyPrefix,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (error) => {
      console.error('[Cache] Redis error:', error);
    });

    this.redis.on('connect', () => {
      console.log('[Cache] Redis connected');
    });
  }

  async setTick(tick: MarketTick): Promise<void> {
    const key = `tick:${tick.symbol}`;
    await this.redis.setex(
      key,
      this.config.ttl!.tick,
      JSON.stringify(tick)
    );
  }

  async getTick(symbol: string): Promise<MarketTick | null> {
    const key = `tick:${symbol}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  async setCandle(candle: Candle): Promise<void> {
    const key = `candle:${candle.symbol}:${candle.interval}:${candle.timestamp.getTime()}`;
    await this.redis.setex(
      key,
      this.config.ttl!.candle,
      JSON.stringify(candle)
    );

    // Also add to sorted set for range queries
    const setKey = `candles:${candle.symbol}:${candle.interval}`;
    await this.redis.zadd(
      setKey,
      candle.timestamp.getTime(),
      JSON.stringify(candle)
    );

    // Keep only last 1000 candles
    await this.redis.zremrangebyrank(setKey, 0, -1001);
  }

  async getCandle(symbol: string, interval: string, timestamp: Date): Promise<Candle | null> {
    const key = `candle:${symbol}:${interval}:${timestamp.getTime()}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  async getCandles(symbol: string, interval: string, limit: number = 100): Promise<Candle[]> {
    const setKey = `candles:${symbol}:${interval}`;
    const data = await this.redis.zrevrange(setKey, 0, limit - 1);

    return data.map(item => JSON.parse(item));
  }

  async getCandlesByTimeRange(
    symbol: string,
    interval: string,
    start: Date,
    end: Date
  ): Promise<Candle[]> {
    const setKey = `candles:${symbol}:${interval}`;
    const data = await this.redis.zrangebyscore(
      setKey,
      start.getTime(),
      end.getTime()
    );

    return data.map(item => JSON.parse(item));
  }

  async getLatestCandle(symbol: string, interval: string): Promise<Candle | null> {
    const setKey = `candles:${symbol}:${interval}`;
    const data = await this.redis.zrevrange(setKey, 0, 0);

    if (data.length === 0) {
      return null;
    }

    return JSON.parse(data[0]);
  }

  async setTickBatch(ticks: MarketTick[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tick of ticks) {
      const key = `tick:${tick.symbol}`;
      pipeline.setex(key, this.config.ttl!.tick, JSON.stringify(tick));
    }

    await pipeline.exec();
  }

  async setCandleBatch(candles: Candle[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const candle of candles) {
      const key = `candle:${candle.symbol}:${candle.interval}:${candle.timestamp.getTime()}`;
      pipeline.setex(key, this.config.ttl!.candle, JSON.stringify(candle));

      const setKey = `candles:${candle.symbol}:${candle.interval}`;
      pipeline.zadd(setKey, candle.timestamp.getTime(), JSON.stringify(candle));
    }

    await pipeline.exec();
  }

  async invalidateTick(symbol: string): Promise<void> {
    const key = `tick:${symbol}`;
    await this.redis.del(key);
  }

  async invalidateCandles(symbol: string, interval: string): Promise<void> {
    const setKey = `candles:${symbol}:${interval}`;
    await this.redis.del(setKey);

    // Also delete individual candle keys
    const pattern = `candle:${symbol}:${interval}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async getStats(): Promise<{
    tickCount: number;
    candleSetCount: number;
    memoryUsed: string;
  }> {
    const tickKeys = await this.redis.keys('tick:*');
    const candleKeys = await this.redis.keys('candles:*');
    const info = await this.redis.info('memory');

    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1].trim() : 'unknown';

    return {
      tickCount: tickKeys.length,
      candleSetCount: candleKeys.length,
      memoryUsed,
    };
  }
}
