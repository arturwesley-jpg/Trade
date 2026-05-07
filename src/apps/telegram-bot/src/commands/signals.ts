/**
 * /signals command
 * Displays current trading signals
 */

import type { Context } from "telegraf";
import type { ApiClient } from "../utils/api.js";
import { formatApiError } from "../utils/api.js";
import { Markup } from "telegraf";

export async function handleSignals(ctx: Context, apiClient: ApiClient): Promise<void> {
  try {
    const signals = await apiClient.getSignals();

    if (!signals || signals.length === 0) {
      await ctx.reply("📊 No trading signals available at the moment.");
      return;
    }

    const signalMessages = signals.map((signal, index) => {
      const confidenceEmoji =
        signal.confidence === "high" ? "🟢" :
        signal.confidence === "medium" ? "🟡" : "🟠";

      return (
        `${index + 1}. ${confidenceEmoji} *${signal.symbol}*\n` +
        `Direction: \`${signal.direction}\`\n` +
        `Confidence: \`${signal.confidence}\`\n` +
        `Price Change: \`${signal.priceChangePct >= 0 ? "+" : ""}${signal.priceChangePct.toFixed(2)}%\`\n` +
        `${signal.rationale}`
      );
    });

    const message = `📊 *Trading Signals*\n\n${signalMessages.join("\n\n")}`;

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "cmd_signals")]
      ])
    });
  } catch (error) {
    await ctx.reply(`❌ ${formatApiError(error)}`);
  }
}
