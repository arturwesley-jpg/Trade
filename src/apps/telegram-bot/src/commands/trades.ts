/**
 * /trades command
 * Shows trade history
 */

import type { Context } from "telegraf";
import type { ApiClient } from "../utils/api.js";
import { formatApiError } from "../utils/api.js";
import { formatTrade } from "../utils/formatters.js";
import { Markup } from "telegraf";

export async function handleTrades(ctx: Context, apiClient: ApiClient): Promise<void> {
  try {
    const trades = await apiClient.getTrades();

    if (trades.length === 0) {
      await ctx.reply("📝 No closed trades yet.");
      return;
    }

    // Show last 10 trades
    const recentTrades = trades.slice(-10).reverse();
    const totalPnL = trades.reduce((sum, t) => sum + t.pnlUsdt, 0);
    const winningTrades = trades.filter(t => t.pnlUsdt > 0);
    const winRate = (winningTrades.length / trades.length) * 100;

    const tradeMessages = recentTrades.map((trade, index) =>
      `${index + 1}. ${formatTrade(trade)}`
    );

    const message =
      `📝 *Trade History* (Last ${recentTrades.length})\n\n` +
      `${tradeMessages.join("\n\n")}\n\n` +
      `📊 *Summary*\n` +
      `Total Trades: \`${trades.length}\`\n` +
      `Win Rate: \`${winRate.toFixed(1)}%\`\n` +
      `Total PnL: \`${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)} USDT\``;

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "cmd_trades")]
      ])
    });
  } catch (error) {
    await ctx.reply(`❌ ${formatApiError(error)}`);
  }
}
