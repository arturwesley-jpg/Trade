import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

export interface CacheOptions {
  url?: string;
  ttl?: number;
  prefix?: string;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheClient {
  private client: RedisClientType | null = null;
  private readonly url: string;
  private readonly defaultTTL: number;
  private readonly prefix: string;
  private connected = false;

  constructor(options: CacheOptions = {}) {
    this.url = options.url ?? process.env.REDIS_URL ?? "redis://localhost:6379";
    this.defaultTTL = options.ttl ?? 300; // 5 minutes default
    this.prefix = options.prefix ?? "trade:";
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.client = createClient({ url: this.url });

      this.client.on("error", (err: Error) => {
        logger.error({ err }, "Redis client error");
      });

      this.client.on("connect", () => {
        logger.info("Redis client connected");
      });

      this.client.on("disconnect", () => {
        logger.warn("Redis client disconnected");
        this.connected = false;
      });

      await this.client.connect();
      this.connected = true;
      logger.info({ url: this.url }, "Redis cache connected");
    } catch (error) {
      logger.error("Failed to connect to Redis", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      logger.info("Redis cache disconnected");
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.connected) {
      logger.warn("Cache get called but Redis not connected");
      return null;
    }

    try {
      const value = await this.client.get(this.getKey(key));
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error("Cache get error", { key, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.client || !this.connected) {
      logger.warn("Cache set called but Redis not connected");
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      const expiresIn = ttl ?? this.defaultTTL;
      await this.client.setEx(this.getKey(key), expiresIn, serialized);
      logger.debug({ key, ttl: expiresIn }, "Cache set");
    } catch (error) {
      logger.error("Cache set error", { key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.connected) {
      logger.warn("Cache del called but Redis not connected");
      return;
    }

    try {
      await this.client.del(this.getKey(key));
      logger.debug({ key }, "Cache deleted");
    } catch (error) {
      logger.error("Cache delete error", { key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      logger.error("Cache exists error", { error: error instanceof Error ? error : String(error), key });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client || !this.connected) {
      return -2;
    }

    try {
      return await this.client.ttl(this.getKey(key));
    } catch (error) {
      logger.error("Cache TTL error", { error: error instanceof Error ? error : String(error), key });
      return -2;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }

    try {
      await this.client.expire(this.getKey(key), ttl);
    } catch (error) {
      logger.error("Cache expire error", { error: error instanceof Error ? error : String(error), key });
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client || !this.connected) {
      return [];
    }

    try {
      const keys = await this.client.keys(this.getKey(pattern));
      return keys.map((k: string) => k.replace(this.prefix, ""));
    } catch (error) {
      logger.error("Cache keys error", { error: error instanceof Error ? error : String(error), pattern });
      return [];
    }
  }

  async clear(pattern?: string): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }

    try {
      const searchPattern = pattern ? this.getKey(pattern) : `${this.prefix}*`;
      const keys = await this.client.keys(searchPattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info({ count: keys.length, pattern }, "Cache cleared");
      }
    } catch (error) {
      logger.error("Cache clear error", { error: error instanceof Error ? error : String(error), pattern });
    }
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (!this.client || !this.connected) {
      return keys.map(() => null);
    }

    try {
      const prefixedKeys = keys.map((k) => this.getKey(k));
      const values = await this.client.mGet(prefixedKeys);
      return values.map((v: string | null, i: number) => {
        if (v === null) {
          return null;
        }
        return JSON.parse(v) as T;
      });
    } catch (error) {
      logger.error("Cache mget error", { error: error instanceof Error ? error : String(error), keys });
      return keys.map(() => null);
    }
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }

    try {
      const pipeline = this.client.multi();
      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        const expiresIn = entry.ttl ?? this.defaultTTL;
        pipeline.setEx(this.getKey(entry.key), expiresIn, serialized);
      }
      await pipeline.exec();
      logger.debug({ count: entries.length }, "Cache mset");
    } catch (error) {
      logger.error("Cache mset error", { error: error instanceof Error ? error : String(error) });
    }
  }

  async increment(key: string, amount = 1): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    try {
      return await this.client.incrBy(this.getKey(key), amount);
    } catch (error) {
      logger.error("Cache increment error", { error: error instanceof Error ? error : String(error), key });
      return 0;
    }
  }

  async decrement(key: string, amount = 1): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    try {
      return await this.client.decrBy(this.getKey(key), amount);
    } catch (error) {
      logger.error("Cache decrement error", { error: error instanceof Error ? error : String(error), key });
      return 0;
    }
  }

  async delete(key: string): Promise<void> {
    return this.del(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }
    try {
      const keys = await this.keys(pattern);
      for (const key of keys) {
        await this.del(key);
      }
    } catch (error) {
      logger.error("Cache deletePattern error", { error: error instanceof Error ? error : String(error), pattern });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
export const cache = new CacheClient();

// Cache decorator for methods
export function Cacheable(ttl?: number) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;

      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      await cache.set(cacheKey, result, ttl);
      return result;
    };

    return descriptor;
  };
}

// Cache-aside pattern helper
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetcher();
  await cache.set(key, value, ttl);
  return value;
}

// Write-through cache helper
export async function writeThrough<T>(
  key: string,
  value: T,
  writer: (value: T) => Promise<void>,
  ttl?: number
): Promise<void> {
  await writer(value);
  await cache.set(key, value, ttl);
}

// Write-behind cache helper (fire and forget)
export async function writeBehind<T>(
  key: string,
  value: T,
  writer: (value: T) => Promise<void>,
  ttl?: number
): Promise<void> {
  await cache.set(key, value, ttl);
  writer(value).catch((error) => {
    logger.error({ error, key }, "Write-behind error");
  });
}
