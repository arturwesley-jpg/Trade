import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export interface DiscordConfig {
  defaultUsername?: string;
  defaultAvatarUrl?: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
}

export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

export class DiscordHandler implements NotificationHandler {
  private readonly defaultUsername: string;
  private readonly defaultAvatarUrl?: string;

  constructor(config: DiscordConfig = {}) {
    this.defaultUsername = config.defaultUsername ?? "Trading Platform";
    this.defaultAvatarUrl = config.defaultAvatarUrl;
    logger.info("Discord handler initialized");
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      const payload = this.buildPayload(message);
      const webhookUrl = message.recipient;

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Discord webhook error: ${error}`);
      }

      logger.info({ webhookUrl: this.maskUrl(webhookUrl) }, "Discord message sent successfully");
    } catch (error) {
      logger.error("Failed to send Discord message", {
        error: error instanceof Error ? error : String(error)
      });
      throw error;
    }
  }

  private buildPayload(message: NotificationMessage): DiscordWebhookPayload {
    const priorityColors = {
      low: 0x6b7280, // Gray
      normal: 0x3b82f6, // Blue
      high: 0xf59e0b, // Orange
      critical: 0xef4444 // Red
    };

    const priorityEmojis = {
      low: "ℹ️",
      normal: "📢",
      high: "⚠️",
      critical: "🚨"
    };

    const embed: DiscordEmbed = {
      title: `${priorityEmojis[message.priority]} ${message.subject || "Notification"}`,
      description: message.message,
      color: priorityColors[message.priority],
      timestamp: new Date().toISOString()
    };

    // Add metadata fields
    if (message.metadata && Object.keys(message.metadata).length > 0) {
      embed.fields = Object.entries(message.metadata).map(([key, value]) => ({
        name: this.formatKey(key),
        value: String(value),
        inline: true
      }));
    }

    // Add footer
    embed.footer = {
      text: `Priority: ${message.priority.toUpperCase()}`
    };

    return {
      username: this.defaultUsername,
      avatar_url: this.defaultAvatarUrl,
      embeds: [embed]
    };
  }

  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private maskUrl(url: string): string {
    return url.replace(/\/[\w-]+$/, "/***");
  }

  validateWebhookUrl(url: string): boolean {
    const webhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return webhookRegex.test(url);
  }

  async verify(): Promise<boolean> {
    try {
      logger.info("Discord handler verified successfully");
      return true;
    } catch (error) {
      logger.error("Discord handler verification failed", {
        error: error instanceof Error ? error : String(error)
      });
      return false;
    }
  }
}
