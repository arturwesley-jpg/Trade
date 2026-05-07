/**
 * /help command
 * Command documentation
 */

import type { Context } from "telegraf";

export async function handleHelp(ctx: Context): Promise<void> {
  const helpMessage =
    `❓ *Command Documentation*\n\n` +
    `*General Commands*\n` +
    `/start - Welcome message and main menu\n` +
    `/help - Show this help message\n` +
    `/status - System status and account overview\n\n` +
    `*Trading Information*\n` +
    `/signals - Display current trading signals\n` +
    `/positions - List all open positions\n` +
    `/trades - Show trade history (last 10)\n` +
    `/metrics - Display performance metrics\n` +
    `/alerts - Show active alerts\n\n` +
    `*Features*\n` +
    `• Real-time trading signals\n` +
    `• Position monitoring\n` +
    `• Performance analytics\n` +
    `• Risk metrics\n` +
    `• Alert notifications\n\n` +
    `*Rate Limits*\n` +
    `Maximum 20 requests per minute per user.\n\n` +
    `⚠️ *Note:* Currently operating in paper trading mode. Live trading is disabled.`;

  await ctx.reply(helpMessage, { parse_mode: "Markdown" });
}
