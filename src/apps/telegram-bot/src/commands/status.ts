/**
 * /status command
 * Shows current system status and account overview
 */

import type { Context } from "telegraf";
import type { ApiClient } from "../utils/api.js";
import { formatApiError } from "../utils/api.js";

export async function handleStatus(ctx: Context, apiClient: ApiClient): Promise<void> {
  try {
    const [health, positions, paperStatus] = await Promise.all([
      apiClient.getHealth(),
      apiClient.getPositions(),
      apiClient.getPaperStatus()
    ]);

    const openPositions = positions.filter(p => p.status === "OPEN");
    const totalPnL = positions.reduce((sum, p) => sum + p.pnlUsdt, 0);

    const message =
      `🔍 *System Status*\n\n` +
      `Status: \`${health.status}\`\n` +
      `Mode: \`${health.mode}\`\n` +
      `Live Trading: \`${health.liveTradingEnabled ? "Enabled" : "Disabled"}\`\n\n` +
      `📊 *Account Overview*\n` +
      `Open Positions: \`${openPositions.length}\`\n` +
      `Total Trades: \`${paperStatus.metrics.totalTrades || 0}\`\n` +
      `Win Rate: \`${paperStatus.metrics.winRate?.toFixed(1) || 0}%\`\n` +
      `Total PnL: \`${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)} USDT\`\n\n` +
      `🕐 Updated: ${new Date().toLocaleTimeString()}`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.reply(`❌ ${formatApiError(error)}`);
  }
}
