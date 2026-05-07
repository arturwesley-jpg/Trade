/**
 * /positions command
 * Lists all open positions
 */

import type { Context } from "telegraf";
import type { ApiClient } from "../utils/api.js";
import { formatApiError } from "../utils/api.js";
import { formatPosition } from "../utils/formatters.js";
import { Markup } from "telegraf";

export async function handlePositions(ctx: Context, apiClient: ApiClient): Promise<void> {
  try {
    const positions = await apiClient.getPositions();
    const openPositions = positions.filter(p => p.status === "OPEN");

    if (openPositions.length === 0) {
      await ctx.reply("💼 No open positions at the moment.");
      return;
    }

    const totalPnL = openPositions.reduce((sum, p) => sum + p.pnlUsdt, 0);
    const positionMessages = openPositions.map((position, index) =>
      `${index + 1}. ${formatPosition(position)}`
    );

    const message =
      `💼 *Open Positions* (${openPositions.length})\n\n` +
      `${positionMessages.join("\n\n")}\n\n` +
      `📊 Total Unrealized PnL: \`${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)} USDT\``;

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "cmd_positions")]
      ])
    });
  } catch (error) {
    await ctx.reply(`❌ ${formatApiError(error)}`);
  }
}
