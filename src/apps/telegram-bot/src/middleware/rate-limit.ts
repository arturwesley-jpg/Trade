/**
 * Rate Limiting Middleware
 * Prevents spam by limiting requests per user
 */

import type { Context, MiddlewareFn } from "telegraf";
import { TelegramRateLimiter } from "../access-policy.js";

export interface RateLimitMiddlewareOptions {
  maxRequests: number;
  windowMs: number;
}

export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions): MiddlewareFn<Context> {
  const rateLimiter = new TelegramRateLimiter(options);

  return async (ctx, next) => {
    const userId = ctx.from?.id?.toString();

    if (!userId) {
      await ctx.reply("Unable to identify user.");
      return;
    }

    const result = rateLimiter.check(userId);

    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil((result.retryAfterMs ?? 0) / 1000);
      await ctx.reply(
        `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`
      );
      return;
    }

    await next();
  };
}
