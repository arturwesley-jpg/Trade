/**
 * Authentication Middleware
 * Validates user access based on whitelist
 */

import type { Context, MiddlewareFn } from "telegraf";
import { createTelegramAccessPolicy } from "../access-policy.js";

export interface AuthMiddlewareOptions {
  appEnv: string;
  allowedUserIds: string;
  adminUserIds: string;
}

export function createAuthMiddleware(options: AuthMiddlewareOptions): MiddlewareFn<Context> {
  const accessPolicy = createTelegramAccessPolicy(options);

  return async (ctx, next) => {
    const timestamp = new Date().toISOString();
    const userId = ctx.from?.id?.toString();
    const username = ctx.from?.username || "unknown";
    const command = "text" in ctx.message! ? ctx.message.text : "non-text";

    console.log(`[${timestamp}] User ${userId} (${username}) - Command: ${command}`);

    const access = accessPolicy.checkUser(userId);
    if (!access.allowed) {
      console.log(`[${timestamp}] Access denied for user ${userId}: ${access.reason}`);
      await ctx.reply(`Access denied. ${access.reason}`);
      return;
    }

    await next();
  };
}

export function createAdminMiddleware(options: AuthMiddlewareOptions): MiddlewareFn<Context> {
  const accessPolicy = createTelegramAccessPolicy(options);

  return async (ctx, next) => {
    const userId = ctx.from?.id?.toString();

    if (!accessPolicy.isAdmin(userId)) {
      await ctx.reply("This command is restricted to administrators.");
      return;
    }

    await next();
  };
}
