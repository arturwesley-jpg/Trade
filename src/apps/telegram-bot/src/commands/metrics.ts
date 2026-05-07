/**
 * /metrics command
 * Displays performance metrics
 */

import type { Context } from "telegraf";
import type { ApiClient } from "../utils/api.js";
import { formatApiError } from "../utils/api.js";
import { Markup } from "telegraf";

export async function handleMetrics(ctx: Context, apiClient: ApiClient): Promise<void> {
  try {
    const [performance, risk] = await Promise.all([
      apiClient.getMetricsPerformance(),
      apiClient.getMetricsRisk()
    ]);

    const message =
      `📊 *Performance Metrics*\n\n` +
      `*Returns*\n` +
      `Total Return: \`${performance.totalReturn?.toFixed(2) || 0}%\`\n` +
      `Sharpe Ratio: \`${performance.sharpeRatio?.toFixed(2) || 0}\`\n` +
      `Profit Factor: \`${performance.profitFactor?.toFixed(2) || 0}\`\n\n` +
      `*Win/Loss*\n` +
      `Win Rate: \`${performance.winRate?.toFixed(1) || 0}%\`\n` +
      `Avg Win: \`${performance.averageWin?.toFixed(2) || 0} USDT\`\n` +
      `Avg Loss: \`${performance.averageLoss?.toFixed(2) || 0} USDT\`\n\n` +
      `*Risk Metrics*\n` +
      `Max Drawdown: \`${risk.maxDrawdown?.toFixed(2) || 0}%\`\n` +
      `Volatility: \`${risk.volatility?.toFixed(2) || 0}%\`\n` +
      `Value at Risk: \`${risk.valueAtRisk?.toFixed(2) || 0} USDT\`\n\n` +
      `🕐 Updated: ${new Date().toLocaleTimeString()}`;

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "cmd_metrics")]
      ])
    });
  } catch (error) {
    await ctx.reply(`❌ ${formatApiError(error)}`);
  }
}
