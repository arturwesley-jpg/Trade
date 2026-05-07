import type { Request, Response, NextFunction } from "express";
import { cache } from "@trade/shared/cache";
import { logger } from "@trade/shared/logger";

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 60,
    keyGenerator = (req) => `route:${req.method}:${req.path}:${JSON.stringify(req.query)}`,
    condition = () => true
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests by default
    if (req.method !== "GET" || !condition(req)) {
      next();
      return;
    }

    const cacheKey = keyGenerator(req);

    try {
      const cached = await cache.get<{ status: number; body: unknown; headers: Record<string, string> }>(cacheKey);

      if (cached) {
        logger.debug({ cacheKey }, "Cache hit");
        Object.entries(cached.headers).forEach(([key, value]: [string, string]) => {
          res.setHeader(key, value);
        });
        res.setHeader("X-Cache", "HIT");
        res.status(cached.status).json(cached.body);
        return;
      }

      logger.debug({ cacheKey }, "Cache miss");

      // Intercept response
      const originalJson = res.json.bind(res);
      res.json = function (body: unknown) {
        const cacheEntry = {
          status: res.statusCode,
          body,
          headers: {
            "Content-Type": res.getHeader("Content-Type") as string ?? "application/json"
          }
        };

        cache.set(cacheKey, cacheEntry, ttl).catch((error: unknown) => {
          logger.error("Failed to cache response", { error: error instanceof Error ? error : String(error), cacheKey });
        });

        res.setHeader("X-Cache", "MISS");
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error("Cache middleware error", { error: error instanceof Error ? error : String(error), cacheKey });
      next();
    }
  };
}

export function invalidateCache(pattern: string) {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await cache.clear(pattern);
      logger.debug({ pattern }, "Cache invalidated");
    } catch (error) {
      logger.error("Cache invalidation error", { error: error instanceof Error ? error : String(error), pattern });
    }
    next();
  };
}

export async function invalidateCacheByKey(key: string): Promise<void> {
  try {
    await cache.del(key);
    logger.debug({ key }, "Cache key invalidated");
  } catch (error) {
    logger.error("Cache key invalidation error", { error: error instanceof Error ? error : String(error), key });
  }
}

export async function invalidateCacheByPattern(pattern: string): Promise<void> {
  try {
    await cache.clear(pattern);
    logger.debug({ pattern }, "Cache pattern invalidated");
  } catch (error) {
    logger.error("Cache pattern invalidation error", { error: error instanceof Error ? error : String(error), pattern });
  }
}
