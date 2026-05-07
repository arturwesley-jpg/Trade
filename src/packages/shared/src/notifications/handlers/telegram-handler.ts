import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export interface TelegramConfig {
  botToken: string;
  apiUrl?: string;
}

export class TelegramHandler implements NotificationHandler {
  private readonly botToken: string;
  private readonly apiUrl: string;

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.apiUrl = config.apiUrl ?? "https://api.telegram.org";
    logger.info("Telegram handler initialized");
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      const text = this.formatMessage(message);
      const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: message.recipient,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
      }

      const result = await response.json();
      logger.info(
        { messageId: result.result?.message_id, chatId: message.recipient },
        "Telegram message sent successfully"
      );
    } catch (error) {
      logger.error("Failed to send Telegram message", { error: error instanceof Error ? error : String(error), recipient: message.recipient });
      throw error;
    }
  }

  private formatMessage(message: NotificationMessage): string {
    const priorityEmoji = {
      low: "ℹ️",
      normal: "📢",
      high: "⚠️",
      critical: "🚨"
    }[message.priority] ?? "📢";

    let text = `${priorityEmoji} <b>${message.priority.toUpperCase()}</b>\n\n`;

    if (message.subject) {
      text += `<b>${this.escapeHtml(message.subject)}</b>\n\n`;
    }

    text += this.escapeHtml(message.message);

    if (message.metadata) {
      text += "\n\n<i>Metadata:</i>\n";
      for (const [key, value] of Object.entries(message.metadata)) {
        text += `• ${this.escapeHtml(key)}: ${this.escapeHtml(String(value))}\n`;
      }
    }

    return text;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async getMe(): Promise<{ id: number; username: string; first_name: string }> {
    const url = `${this.apiUrl}/bot${this.botToken}/getMe`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Failed to get bot info");
    }

    const data = await response.json();
    return data.result;
  }

  async verify(): Promise<boolean> {
    try {
      await this.getMe();
      logger.info("Telegram handler verified successfully");
      return true;
    } catch (error) {
      logger.error("Telegram handler verification failed", { error: error instanceof Error ? error : String(error) });
      return false;
    }
  }
}
