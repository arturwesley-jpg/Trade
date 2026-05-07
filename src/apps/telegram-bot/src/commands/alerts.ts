/**
 * /alerts command
 * Shows active alerts
 */

import type { Context } from "telegraf";
import type { ApiClient } from "../utils/api.js";
import { formatApiError } from "../utils/api.js";
import { formatDate } from "../utils/formatters.js";
import { Markup } from "telegraf";

export async function handleAlerts(ctx: Context, apiClient: ApiClient): Promise<void> {
  try {
    const alerts = await apiClient.getAlerts();

    if (alerts.length === 0) {
      await ctx.reply("🔔 No active alerts.");
      return;
    }

    const alertMessages = alerts.map((alert, index) => {
      const severityEmoji =
        alert.severity === "high" ? "🔴" :
        alert.severity === "medium" ? "🟡" : "🟢";

      const statusEmoji =
        alert.status === "OPEN" ? "🔓" :
        alert.status === "ACKED" ? "👁" : "✅";

      return (
        `${index + 1}. ${severityEmoji} ${statusEmoji} *${alert.title}*\n` +
        `Type: \`${alert.type}\`\n` +
        `Status: \`${alert.status}\`\n` +
        `${alert.message}\n` +
        `Created: ${formatDate(alert.createdAt)}`
      );
    });

    const message = `🔔 *Active Alerts* (${alerts.length})\n\n${alertMessages.join("\n\n")}`;

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "cmd_alerts")]
      ])
    });
  } catch (error) {
    await ctx.reply(`❌ ${formatApiError(error)}`);
  }
}
