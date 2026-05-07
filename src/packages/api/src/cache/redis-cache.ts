import Redis from 'ioredis';

/**
 * Multi-layer caching strategy for Trading Bot
 * L1: In-memory cache (fastest, smallest)
 * L2: Redis cache (fast, larger)
 */

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  layer?: 'L1' | 'L2' | 'both';
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private redis: Redis;
  private l1Cache: Map<string, CacheEntry<any>>;
  private readonly L1_MAX_SIZE = 1000;
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.l1Cache = new Map();

    // Cleanup expired L1 entries every minute
    setInterval(() => this.cleanupL1(), 60000);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const layer = options.layer || 'both';

    // Try L1 cache first
    if (layer === 'L1' || layer === 'both') {
      const l1Value = this.getFromL1<T>(key);
      if (l1Value !== null) {
        return l1Value;
      }
    }

    // Try L2 cache (Redis)
    if (layer === 'L2' || layer === 'both') {
      const l2Value = await this.getFromL2<T>(key);
      if (l2Value !== null) {
        // Populate L1 cache
        if (layer === 'both') {
          this.setToL1(key, l2Value, options.ttl || this.DEFAULT_TTL);
        }
        return l2Value;
      }
    }

    return null;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const layer = options.layer || 'both';
    const ttl = options.ttl || this.DEFAULT_TTL;

    // Set in L1 cache
    if (layer === 'L1' || layer === 'both') {
      this.setToL1(key, value, ttl);
    }

    // Set in L2 cache (Redis)
    if (layer === 'L2' || layer === 'both') {
      await this.setToL2(key, value, ttl);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const layer = options.layer || 'both';

    if (layer === 'L1' || layer === 'both') {
      this.l1Cache.delete(key);
    }

    if (layer === 'L2' || layer === 'both') {
      await this.redis.del(key);
    }
  }

  /**
   * Clear all cache
   */
  async clear(options: CacheOptions = {}): Promise<void> {
    const layer = options.layer || 'both';

    if (layer === 'L1' || layer === 'both') {
      this.l1Cache.clear();
    }

    if (layer === 'L2' || layer === 'both') {
      await this.redis.flushdb();
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Generate value
    const value = await factory();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Batch get from cache
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    // Try L1 first
    const l1Misses: string[] = [];
    for (const key of keys) {
      const l1Value = this.getFromL1<T>(key);
      if (l1Value !== null) {
        result.set(key, l1Value);
      } else {
        l1Misses.push(key);
      }
    }

    // Get L1 misses from L2
    if (l1Misses.length > 0) {
      const l2Values = await this.redis.mget(...l1Misses);
      for (let i = 0; i < l1Misses.length; i++) {
        const value = l2Values[i];
        if (value) {
          const parsed = JSON.parse(value) as T;
          result.set(l1Misses[i], parsed);
          // Populate L1
          this.setToL1(l1Misses[i], parsed, this.DEFAULT_TTL);
        }
      }
    }

    return result;
  }

  /**
   * Batch set in cache
   */
  async mset<T>(entries: Map<string, T>, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.DEFAULT_TTL;

    // Set in L1
    for (const [key, value] of entries) {
      this.setToL1(key, value, ttl);
    }

    // Set in L2
    const pipeline = this.redis.pipeline();
    for (const [key, value] of entries) {
      pipeline.setex(key, ttl, JSON.stringify(value));
    }
    await pipeline.exec();
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Clear matching keys from L1
    for (const key of this.l1Cache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.l1Cache.delete(key);
      }
    }

    // Clear matching keys from L2
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    l1Size: number;
    l1MaxSize: number;
    l2Keys: number;
    l2Memory: string;
  }> {
    const l2Info = await this.redis.info('keyspace');
    const l2Keys = this.parseRedisKeyCount(l2Info);
    const l2Memory = await this.redis.info('memory');

    return {
      l1Size: this.l1Cache.size,
      l1MaxSize: this.L1_MAX_SIZE,
      l2Keys,
      l2Memory: this.parseRedisMemory(l2Memory),
    };
  }

  // Private methods

  private getFromL1<T>(key: string): T | null {
    const entry = this.l1Cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.l1Cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  private setToL1<T>(key: string, value: T, ttl: number): void {
    // Evict oldest entry if cache is full
    if (this.l1Cache.size >= this.L1_MAX_SIZE) {
      const firstKey = this.l1Cache.keys().next().value;
      this.l1Cache.delete(firstKey);
    }

    this.l1Cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  private async getFromL2<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private async setToL2<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  private cleanupL1(): void {
    const now = Date.now();
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now > entry.expiresAt) {
        this.l1Cache.delete(key);
      }
    }
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  private parseRedisKeyCount(info: string): number {
    const match = info.match(/keys=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseRedisMemory(info: string): string {
    const match = info.match(/used_memory_human:(.+)/);
    return match ? match[1].trim() : '0B';
  }
}

/**
 * Cache key builders
 */
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userPositions: (userId: string) => `user:${userId}:positions`,
  userTrades: (userId: string) => `user:${userId}:trades`,
  marketData: (symbol: string) => `market:${symbol}`,
  orderBook: (symbol: string) => `orderbook:${symbol}`,
  tradingStats: (userId: string) => `stats:${userId}`,
  symbolStats: (symbol: string) => `stats:symbol:${symbol}`,
};

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};
