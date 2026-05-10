import { DatabaseClient } from '@trade/database';
import { CacheClient } from '../cache';
import { logger } from '../logger';

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  prefix: string;
}

export class CachedRepository<T> {
  constructor(
    private db: DatabaseClient,
    private cache: CacheClient,
    private config: CacheConfig
  ) {}

  async findById(
    table: string,
    id: string,
    cacheKey?: string
  ): Promise<T | null> {
    if (!this.config.enabled) {
      return this.queryDatabase(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    }

    const key = cacheKey ?? `${this.config.prefix}${table}:${id}`;

    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }

    // Query database
    const result = await this.queryDatabase(`SELECT * FROM ${table} WHERE id = $1`, [id]);

    // Store in cache
    if (result) {
      await this.cache.set(key, result, this.config.ttl);
    }

    return result;
  }

  async findMany(
    query: string,
    params: any[],
    cacheKey: string
  ): Promise<T[]> {
    if (!this.config.enabled) {
      return this.queryDatabaseMany(query, params);
    }

    const key = `${this.config.prefix}${cacheKey}`;

    // Try cache first
    const cached = await this.cache.get<T[]>(key);
    if (cached) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }

    // Query database
    const results = await this.queryDatabaseMany(query, params);

    // Store in cache
    await this.cache.set(key, results, this.config.ttl);

    return results;
  }

  async invalidate(keys: string | string[]): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    const prefixedKeys = keyArray.map(k => `${this.config.prefix}${k}`);

    await Promise.all(prefixedKeys.map(k => this.cache.delete(k)));
    logger.debug({ keys: prefixedKeys }, 'Cache invalidated');
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const fullPattern = `${this.config.prefix}${pattern}`;
    await this.cache.deletePattern(fullPattern);
    logger.debug({ pattern: fullPattern }, 'Cache pattern invalidated');
  }

  private async queryDatabase(query: string, params: any[]): Promise<T | null> {
    const result = await this.db.query(query, params);
    return (result.rows[0] as T) ?? null;
  }

  private async queryDatabaseMany(query: string, params: any[]): Promise<T[]> {
    const result = await this.db.query(query, params);
    return result.rows as T[];
  }
}

// Cache warming strategies
export class CacheWarmer {
  constructor(
    private cache: CacheClient,
    private db: DatabaseClient
  ) {}

  async warmPopularData(config: {
    tables: Array<{
      name: string;
      query: string;
      cacheKey: string;
      ttl: number;
    }>;
  }): Promise<void> {
    logger.info('Starting cache warming');

    await Promise.all(
      config.tables.map(async (table) => {
        try {
          const result = await this.db.query(table.query);
          await this.cache.set(table.cacheKey, result.rows, table.ttl);
          logger.info({ table: table.name, rows: result.rowCount }, 'Cache warmed');
        } catch (error) {
          logger.error({ table: table.name, error: error instanceof Error ? error : new Error(String(error)) }, 'Failed to warm cache');
        }
      })
    );

    logger.info('Cache warming completed');
  }

  async warmUserData(userId: string): Promise<void> {
    const queries = [
      {
        key: `user:${userId}:profile`,
        query: 'SELECT * FROM users WHERE id = $1',
        params: [userId],
        ttl: 3600,
      },
      {
        key: `user:${userId}:positions`,
        query: 'SELECT * FROM positions WHERE user_id = $1 AND status = $2',
        params: [userId, 'OPEN'],
        ttl: 300,
      },
      {
        key: `user:${userId}:orders`,
        query: 'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        params: [userId],
        ttl: 60,
      },
    ];

    await Promise.all(
      queries.map(async (q) => {
        try {
          const result = await this.db.query(q.query, q.params);
          await this.cache.set(q.key, result.rows, q.ttl);
        } catch (error) {
          logger.error({ key: q.key, error: error instanceof Error ? error : new Error(String(error)) }, 'Failed to warm user cache');
        }
      })
    );
  }
}

// Cache invalidation strategies
export class CacheInvalidator {
  constructor(private cache: CacheClient) {}

  async onUserUpdate(userId: string): Promise<void> {
    await this.cache.deletePattern(`user:${userId}:*`);
  }

  async onTradeExecuted(userId: string, symbol: string): Promise<void> {
    await Promise.all([
      this.cache.deletePattern(`user:${userId}:*`),
      this.cache.deletePattern(`symbol:${symbol}:*`),
      this.cache.delete('dashboard:metrics'),
    ]);
  }

  async onMarketDataUpdate(symbol: string): Promise<void> {
    await this.cache.deletePattern(`market:${symbol}:*`);
  }

  async onSignalGenerated(symbol: string): Promise<void> {
    await Promise.all([
      this.cache.deletePattern(`signal:${symbol}:*`),
      this.cache.delete('signals:latest'),
    ]);
  }
}

// Write-through cache
export class WriteThroughCache<T> {
  constructor(
    private db: DatabaseClient,
    private cache: CacheClient,
    private ttl: number
  ) {}

  async set(key: string, value: T, dbWriter: () => Promise<void>): Promise<void> {
    // Write to database first
    await dbWriter();

    // Then update cache
    await this.cache.set(key, value, this.ttl);
  }

  async get(key: string, dbReader: () => Promise<T | null>): Promise<T | null> {
    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached) {
      return cached;
    }

    // Read from database
    const value = await dbReader();
    if (value) {
      await this.cache.set(key, value, this.ttl);
    }

    return value;
  }

  async delete(key: string, dbDeleter: () => Promise<void>): Promise<void> {
    // Delete from database first
    await dbDeleter();

    // Then invalidate cache
    await this.cache.delete(key);
  }
}

// Cache-aside pattern
export class CacheAside<T> {
  constructor(
    private cache: CacheClient,
    private ttl: number
  ) {}

  async get(
    key: string,
    loader: () => Promise<T | null>
  ): Promise<T | null> {
    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached) {
      return cached;
    }

    // Load from source
    const value = await loader();
    if (value) {
      await this.cache.set(key, value, this.ttl);
    }

    return value;
  }

  async invalidate(key: string): Promise<void> {
    await this.cache.delete(key);
  }
}
