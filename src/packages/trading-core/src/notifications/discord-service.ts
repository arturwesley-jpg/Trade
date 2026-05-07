/**
 * Discord Webhook Service
 * Sends notifications via Discord webhooks
 */

import type { Notification, NotificationDeliveryResult } from "./types.js";

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
  author?: {
    name: string;
    icon_url?: string;
  };
}

export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

export class DiscordService {
  constructor(private config: DiscordConfig = {}) {}

  /**
   * Send Discord notification
   */
  async send(
    notification: Notification,
    webhookUrl: string
  ): Promise<NotificationDeliveryResult> {
    try {
      const payload = this.buildDiscordPayload(notification);
      await this.sendWebhook(webhookUrl, payload);

      return {
        notificationId: notification.id,
        channel: "discord",
        success: true,
        deliveredAt: new Date().toISOString(),
        metadata: {
          webhookUrl: this.maskWebhookUrl(webhookUrl)
        }
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: "discord",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build Discord webhook payload
   */
  private buildDiscordPayload(notification: Notification): DiscordWebhookPayload {
    const priorityColors = {
      low: 0x3b82f6, // Blue
      medium: 0xf59e0b, // Orange
      high: 0xef4444, // Red
      critical: 0xdc2626 // Dark red
    };

    const priorityEmojis = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🚨",
      critical: "🔴"
    };

    const embed: DiscordEmbed = {
      title: `${priorityEmojis[notification.priority]} ${notification.title}`,
      description: notification.body,
      color: priorityColors[notification.priority],
      timestamp: notification.createdAt
    };

    // Add data fields
    if (notification.data) {
      embed.fields = this.formatDataFields(notification.data);
    }

    // Add footer
    embed.footer = {
      text: `Priority: ${notification.priority.toUpperCase()}`
    };

    return {
      username: this.config.defaultUsername || "Trading Platform",
      avatar_url: this.config.defaultAvatarUrl,
      embeds: [embed]
    };
  }

  /**
   * Format notification data as Discord embed fields
   */
  private formatDataFields(data: Record<string, any>): Array<{
    name: string;
    value: string;
    inline: boolean;
  }> {
    return Object.entries(data).map(([key, value]) => ({
      name: this.formatKey(key),
      value: this.formatValue(value),
      inline: true
    }));
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
      return value ? "✅" : "❌";
    }
    if (value === null || value === undefined) {
      return "N/A";
    }
    return String(value);
  }

  /**
   * Send webhook to Discord
   */
  private async sendWebhook(
    webhookUrl: string,
    payload: DiscordWebhookPayload
  ): Promise<void> {
    console.log(`[Discord] Sending webhook: ${payload.embeds?.[0]?.title}`);

    // In production:
    // const response = await fetch(webhookUrl, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload)
    // });
    //
    // if (!response.ok) {
    //   const error = await response.text();
    //   throw new Error(`Discord webhook error: ${error}`);
    // }
  }

  /**
   * Validate Discord webhook URL
   */
  validateWebhookUrl(url: string): boolean {
    const webhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return webhookRegex.test(url);
  }

  /**
   * Mask webhook URL for logging
   */
  private maskWebhookUrl(url: string): string {
    return url.replace(/\/[\w-]+$/, "/***");
  }

  /**
   * Verify Discord webhook
   */
  async verify(webhookUrl: string): Promise<boolean> {
    try {
      if (!this.validateWebhookUrl(webhookUrl)) {
        return false;
      }

      // In production, test webhook with a simple message:
      // await this.sendWebhook(webhookUrl, {
      //   content: "Webhook verification successful"
      // });

      return true;
    } catch (error) {
      console.error("Discord webhook verification failed:", error);
      return false;
    }
  }
}
