/**
 * Audit Logging Middleware
 * Logs all bot interactions for security and debugging
 */

import type { Context, MiddlewareFn } from "telegraf";

export interface AuditLog {
  timestamp: string;
  userId: string;
  username: string;
  command: string;
  chatId: number;
  messageId: number;
}

const auditLogs: AuditLog[] = [];
const MAX_LOGS = 1000;

export function createAuditMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const timestamp = new Date().toISOString();
    const userId = ctx.from?.id?.toString() || "unknown";
    const username = ctx.from?.username || "unknown";
    const command = "text" in ctx.message! ? ctx.message.text || "unknown" : "non-text";
    const chatId = ctx.chat?.id || 0;
    const messageId = ctx.message?.message_id || 0;

    const log: AuditLog = {
      timestamp,
      userId,
      username,
      command,
      chatId,
      messageId
    };

    auditLogs.push(log);

    // Keep only recent logs
    if (auditLogs.length > MAX_LOGS) {
      auditLogs.shift();
    }

    console.log(`[AUDIT] ${timestamp} | User: ${userId} (${username}) | Command: ${command}`);

    await next();
  };
}

export function getAuditLogs(limit = 50): AuditLog[] {
  return auditLogs.slice(-limit).reverse();
}
