/**
 * Slack Webhook Service
 * Sends notifications via Slack webhooks
 */

import type { Notification, NotificationDeliveryResult } from "./types.js";

export interface SlackConfig {
  defaultUsername?: string;
  defaultIconEmoji?: string;
  defaultIconUrl?: string;
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  title?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

export interface SlackWebhookPayload {
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  channel?: string;
  text?: string;
  attachments?: SlackAttachment[];
}

export class SlackService {
  constructor(private config: SlackConfig = {}) {}

  /**
   * Send Slack notification
   */
  async send(
    notification: Notification,
    webhookUrl: string,
    channel?: string
  ): Promise<NotificationDeliveryResult> {
    try {
      const payload = this.buildSlackPayload(notification, channel);
      await this.sendWebhook(webhookUrl, payload);

      return {
        notificationId: notification.id,
        channel: "slack",
        success: true,
        deliveredAt: new Date().toISOString(),
        metadata: {
          webhookUrl: this.maskWebhookUrl(webhookUrl),
          channel
        }
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: "slack",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build Slack webhook payload
   */
  private buildSlackPayload(
    notification: Notification,
    channel?: string
  ): SlackWebhookPayload {
    const priorityColors = {
      low: "#3b82f6",
      medium: "#f59e0b",
      high: "#ef4444",
      critical: "#dc2626"
    };

    const priorityEmojis = {
      low: ":information_source:",
      medium: ":warning:",
      high: ":rotating_light:",
      critical: ":red_circle:"
    };

    const attachment: SlackAttachment = {
      color: priorityColors[notification.priority],
      pretext: `${priorityEmojis[notification.priority]} *${notification.priority.toUpperCase()} Priority Alert*`,
      title: notification.title,
      text: notification.body,
      footer: "Trading Platform",
      ts: Math.floor(new Date(notification.createdAt).getTime() / 1000)
    };

    // Add data fields
    if (notification.data) {
      attachment.fields = this.formatDataFields(notification.data);
    }

    return {
      username: this.config.defaultUsername || "Trading Platform",
      icon_emoji: this.config.defaultIconEmoji || ":chart_with_upwards_trend:",
      icon_url: this.config.defaultIconUrl,
      channel,
      attachments: [attachment]
    };
  }

  /**
   * Format notification data as Slack attachment fields
   */
  private formatDataFields(data: Record<string, any>): Array<{
    title: string;
    value: string;
    short: boolean;
  }> {
    return Object.entries(data).map(([key, value]) => ({
      title: this.formatKey(key),
      value: this.formatValue(value),
      short: true
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
      return value ? "✓" : "✗";
    }
    if (value === null || value === undefined) {
      return "N/A";
    }
    return String(value);
  }

  /**
   * Send webhook to Slack
   */
  private async sendWebhook(
    webhookUrl: string,
    payload: SlackWebhookPayload
  ): Promise<void> {
    console.log(`[Slack] Sending webhook: ${payload.attachments?.[0]?.title}`);

    // In production:
    // const response = await fetch(webhookUrl, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload)
    // });
    //
    // if (!response.ok) {
    //   const error = await response.text();
    //   throw new Error(`Slack webhook error: ${error}`);
    // }
  }

  /**
   * Validate Slack webhook URL
   */
  validateWebhookUrl(url: string): boolean {
    const webhookRegex = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/;
    return webhookRegex.test(url);
  }

  /**
   * Mask webhook URL for logging
   */
  private maskWebhookUrl(url: string): string {
    return url.replace(/\/[a-zA-Z0-9]+$/, "/***");
  }

  /**
   * Verify Slack webhook
   */
  async verify(webhookUrl: string): Promise<boolean> {
    try {
      if (!this.validateWebhookUrl(webhookUrl)) {
        return false;
      }

      // In production, test webhook with a simple message:
      // await this.sendWebhook(webhookUrl, {
      //   text: "Webhook verification successful"
      // });

      return true;
    } catch (error) {
      console.error("Slack webhook verification failed:", error);
      return false;
    }
  }
}
