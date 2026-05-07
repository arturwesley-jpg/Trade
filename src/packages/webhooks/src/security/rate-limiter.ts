/**
 * Webhook Rate Limiter
 */

import Redis from 'ioredis';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class WebhookRateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }) {
    this.redis = redis;
    this.config = config;
  }

  /**
   * Check if webhook is rate limited
   */
  async isRateLimited(webhookId: string): Promise<boolean> {
    const key = `webhook:ratelimit:${webhookId}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const count = await this.redis.zcard(key);

    if (count >= this.config.maxRequests) {
      return true;
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}`);
    await this.redis.expire(key, Math.ceil(this.config.windowMs / 1000));

    return false;
  }

  /**
   * Get remaining requests for webhook
   */
  async getRemainingRequests(webhookId: string): Promise<number> {
    const key = `webhook:ratelimit:${webhookId}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    await this.redis.zremrangebyscore(key, 0, windowStart);
    const count = await this.redis.zcard(key);

    return Math.max(0, this.config.maxRequests - count);
  }

  /**
   * Reset rate limit for webhook
   */
  async reset(webhookId: string): Promise<void> {
    const key = `webhook:ratelimit:${webhookId}`;
    await this.redis.del(key);
  }
}
