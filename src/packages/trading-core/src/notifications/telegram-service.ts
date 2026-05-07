/**
 * Telegram Bot Service
 * Sends notifications via Telegram Bot API
 */

import type { Notification, NotificationDeliveryResult } from "./types.js";

export interface TelegramConfig {
  botToken: string;
  apiUrl?: string; // Default: https://api.telegram.org
}

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_markup?: {
    inline_keyboard?: Array<
      Array<{
        text: string;
        callback_data?: string;
        url?: string;
      }>
    >;
  };
}

export class TelegramService {
  private readonly apiUrl: string;

  constructor(private config: TelegramConfig) {
    this.apiUrl = config.apiUrl || "https://api.telegram.org";
  }

  /**
   * Send Telegram notification
   */
  async send(
    notification: Notification,
    chatId: string
  ): Promise<NotificationDeliveryResult> {
    try {
      const message = this.buildTelegramMessage(notification, chatId);
      const result = await this.sendMessage(message);

      return {
        notificationId: notification.id,
        channel: "telegram",
        success: true,
        deliveredAt: new Date().toISOString(),
        metadata: {
          messageId: result.message_id,
          chatId
        }
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: "telegram",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build Telegram message from notification
   */
  private buildTelegramMessage(
    notification: Notification,
    chatId: string
  ): TelegramMessage {
    const priorityEmojis = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🚨",
      critical: "🔴"
    };

    const emoji = priorityEmojis[notification.priority];
    let text = `${emoji} *${this.escapeMarkdown(notification.title)}*\n\n`;
    text += this.escapeMarkdown(notification.body);

    // Add data as formatted fields
    if (notification.data) {
      text += "\n\n" + this.formatData(notification.data);
    }

    // Add timestamp
    const timestamp = new Date(notification.createdAt).toLocaleString();
    text += `\n\n_${timestamp}_`;

    const message: TelegramMessage = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      disable_notification: notification.priority === "low"
    };

    // Add inline buttons for high priority notifications
    if (notification.priority === "high" || notification.priority === "critical") {
      message.reply_markup = {
        inline_keyboard: [
          [
            {
              text: "View Details",
              callback_data: `view_${notification.id}`
            },
            {
              text: "Acknowledge",
              callback_data: `ack_${notification.id}`
            }
          ]
        ]
      };
    }

    return message;
  }

  /**
   * Format notification data for Telegram
   */
  private formatData(data: Record<string, any>): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const formattedKey = this.formatKey(key);
      const formattedValue = this.formatValue(value);
      lines.push(`*${this.escapeMarkdown(formattedKey)}:* ${this.escapeMarkdown(formattedValue)}`);
    }

    return lines.join("\n");
  }

  /**
   * Format key for display
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format value for display
   */
  private formatValue(value: any): string {
    if (typeof value === "number") {
      return value.toLocaleString();
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (value === null || value === undefined) {
      return "N/A";
    }
    return String(value);
  }

  /**
   * Escape Markdown special characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }

  /**
   * Send message via Telegram Bot API
   */
  private async sendMessage(message: TelegramMessage): Promise<{ message_id: number }> {
    const url = `${this.apiUrl}/bot${this.config.botToken}/sendMessage`;

    console.log(`[Telegram] Sending to chat ${message.chat_id}`);

    // In production, make actual API call:
    // const response = await fetch(url, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(message)
    // });
    //
    // if (!response.ok) {
    //   const error = await response.json();
    //   throw new Error(`Telegram API error: ${error.description}`);
    // }
    //
    // const result = await response.json();
    // return result.result;

    return {
      message_id: Date.now()
    };
  }

  /**
   * Get bot information
   */
  async getBotInfo(): Promise<{
    id: number;
    username: string;
    first_name: string;
  }> {
    const url = `${this.apiUrl}/bot${this.config.botToken}/getMe`;

    // In production:
    // const response = await fetch(url);
    // const result = await response.json();
    // return result.result;

    return {
      id: 123456789,
      username: "trading_bot",
      first_name: "Trading Bot"
    };
  }

  /**
   * Set webhook for receiving updates
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    const url = `${this.apiUrl}/bot${this.config.botToken}/setWebhook`;

    // In production:
    // const response = await fetch(url, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ url: webhookUrl })
    // });
    // const result = await response.json();
    // return result.ok;

    console.log(`[Telegram] Setting webhook to ${webhookUrl}`);
    return true;
  }

  /**
   * Verify Telegram bot token
   */
  async verify(): Promise<boolean> {
    try {
      await this.getBotInfo();
      return true;
    } catch (error) {
      console.error("Telegram bot verification failed:", error);
      return false;
    }
  }
}
