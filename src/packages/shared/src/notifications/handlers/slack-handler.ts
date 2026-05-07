import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  defaultChannel?: string;
}

export class SlackHandler implements NotificationHandler {
  private readonly webhookUrl?: string;
  private readonly botToken?: string;
  private readonly defaultChannel?: string;

  constructor(config: SlackConfig) {
    if (!config.webhookUrl && !config.botToken) {
      throw new Error("Either webhookUrl or botToken must be provided");
    }

    this.webhookUrl = config.webhookUrl;
    this.botToken = config.botToken;
    this.defaultChannel = config.defaultChannel;

    logger.info(
      { mode: this.webhookUrl ? "webhook" : "bot" },
      "Slack handler initialized"
    );
  }

  async send(message: NotificationMessage): Promise<void> {
    if (this.webhookUrl) {
      await this.sendViaWebhook(message);
    } else if (this.botToken) {
      await this.sendViaBot(message);
    }
  }

  private async sendViaWebhook(message: NotificationMessage): Promise<void> {
    try {
      const payload = this.buildSlackMessage(message);

      const response = await fetch(this.webhookUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Slack webhook error: ${error}`);
      }

      logger.info({ recipient: message.recipient }, "Slack webhook message sent successfully");
    } catch (error) {
      logger.error("Failed to send Slack webhook message", { error: error instanceof Error ? error : String(error), recipient: message.recipient });
      throw error;
    }
  }

  private async sendViaBot(message: NotificationMessage): Promise<void> {
    try {
      const payload = {
        channel: message.recipient || this.defaultChannel,
        ...this.buildSlackMessage(message)
      };

      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.botToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      logger.info(
        { channel: message.recipient, ts: result.ts },
        "Slack bot message sent successfully"
      );
    } catch (error) {
      logger.error("Failed to send Slack bot message", { error: error instanceof Error ? error : String(error), recipient: message.recipient });
      throw error;
    }
  }

  private buildSlackMessage(message: NotificationMessage): Record<string, unknown> {
    const priorityColor = {
      low: "#6c757d",
      normal: "#0d6efd",
      high: "#fd7e14",
      critical: "#dc3545"
    }[message.priority] ?? "#0d6efd";

    const priorityEmoji = {
      low: ":information_source:",
      normal: ":bell:",
      high: ":warning:",
      critical: ":rotating_light:"
    }[message.priority] ?? ":bell:";

    const blocks: Array<Record<string, unknown>> = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${priorityEmoji} ${message.subject ?? "Notification"}`,
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message.message
        }
      }
    ];

    if (message.metadata && Object.keys(message.metadata).length > 0) {
      const fields = Object.entries(message.metadata).map(([key, value]) => ({
        type: "mrkdwn",
        text: `*${key}:*\n${String(value)}`
      }));

      blocks.push({
        type: "section",
        fields
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Priority: *${message.priority.toUpperCase()}* | ${new Date().toISOString()}`
        }
      ]
    });

    return {
      text: `${message.subject ?? "Notification"}: ${message.message}`,
      blocks,
      attachments: [
        {
          color: priorityColor,
          fallback: message.message
        }
      ]
    };
  }

  async verify(): Promise<boolean> {
    try {
      if (this.botToken) {
        const response = await fetch("https://slack.com/api/auth.test", {
          headers: {
            Authorization: `Bearer ${this.botToken}`
          }
        });

        const result = await response.json();
        if (!result.ok) {
          throw new Error(`Slack auth test failed: ${result.error}`);
        }

        logger.info({ team: result.team, user: result.user }, "Slack handler verified successfully");
        return true;
      } else if (this.webhookUrl) {
        logger.info("Slack webhook handler initialized (verification not available for webhooks)");
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Slack handler verification failed", { error: error instanceof Error ? error : String(error) });
      return false;
    }
  }
}
