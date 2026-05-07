/**
 * /start command
 * Welcome message and main menu
 */

import type { Context } from "telegraf";
import { Markup } from "telegraf";

export async function handleStart(ctx: Context): Promise<void> {
  const welcomeMessage =
    `🤖 *Welcome to Crypto Trading Bot*\n\n` +
    `This bot provides real-time trading signals, position monitoring, and performance metrics.\n\n` +
    `*Quick Start:*\n` +
    `• /status - Check system status\n` +
    `• /signals - View trading signals\n` +
    `• /positions - See open positions\n` +
    `• /help - Full command list\n\n` +
    `⚠️ *Note:* Currently in paper trading mode.`;

  await ctx.reply(welcomeMessage, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback("📊 Status", "cmd_status"),
        Markup.button.callback("📈 Signals", "cmd_signals")
      ],
      [
        Markup.button.callback("💼 Positions", "cmd_positions"),
        Markup.button.callback("📝 Trades", "cmd_trades")
      ],
      [
        Markup.button.callback("📊 Metrics", "cmd_metrics"),
        Markup.button.callback("❓ Help", "cmd_help")
      ]
    ])
  });
}
