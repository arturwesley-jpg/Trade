/**
 * Alerting System
 * Send alerts via multiple channels (Telegram, Email, Webhook)
 */

export type AlertSeverity = "info" | "warning" | "error" | "critical";
export type AlertChannel = "telegram" | "email" | "webhook" | "console";

export interface Alert {
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AlertingOptions {
  telegramBotToken?: string;
  telegramChatId?: string;
  webhookUrl?: string;
  emailConfig?: {
    from: string;
    to: string[];
    smtp: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
  };
  enabledChannels?: AlertChannel[];
}

export class AlertingSystem {
  private readonly options: AlertingOptions;
  private readonly enabledChannels: Set<AlertChannel>;

  constructor(options: AlertingOptions = {}) {
    this.options = options;
    this.enabledChannels = new Set(options.enabledChannels ?? ["console"]);
  }

  /**
   * Send an alert through all enabled channels
   */
  async send(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.enabledChannels.has("console")) {
      promises.push(this.sendToConsole(alert));
    }

    if (this.enabledChannels.has("telegram") && this.options.telegramBotToken && this.options.telegramChatId) {
      promises.push(this.sendToTelegram(alert));
    }

    if (this.enabledChannels.has("webhook") && this.options.webhookUrl) {
      promises.push(this.sendToWebhook(alert));
    }

    if (this.enabledChannels.has("email") && this.options.emailConfig) {
      promises.push(this.sendToEmail(alert));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send info alert
   */
  async info(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.send({
      title,
      message,
      severity: "info",
      timestamp: Date.now(),
      metadata
    });
  }

  /**
   * Send warning alert
   */
  async warning(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.send({
      title,
      message,
      severity: "warning",
      timestamp: Date.now(),
      metadata
    });
  }

  /**
   * Send error alert
   */
  async error(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.send({
      title,
      message,
      severity: "error",
      timestamp: Date.now(),
      metadata
    });
  }

  /**
   * Send critical alert
   */
  async critical(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.send({
      title,
      message,
      severity: "critical",
      timestamp: Date.now(),
      metadata
    });
  }

  /**
   * Alert for Redis connection issues
   */
  async alertRedisDown(error: Error): Promise<void> {
    await this.critical(
      "Redis Connection Failed",
      `Redis connection error: ${error.message}`,
      { error: error.stack }
    );
  }

  private async sendToConsole(alert: Alert): Promise<void> {
    const emoji = this.getSeverityEmoji(alert.severity);
    const timestamp = new Date(alert.timestamp).toISOString();
    console.log(`${emoji} [${alert.severity.toUpperCase()}] ${timestamp}`);
    console.log(`${alert.title}: ${alert.message}`);
    if (alert.metadata) {
      console.log("Metadata:", JSON.stringify(alert.metadata, null, 2));
    }
  }

  private async sendToTelegram(alert: Alert): Promise<void> {
    const { telegramBotToken, telegramChatId } = this.options;
    if (!telegramBotToken || !telegramChatId) return;

    const emoji = this.getSeverityEmoji(alert.severity);
    const text = `${emoji} *${alert.title}*\n\n${alert.message}`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text,
            parse_mode: "Markdown"
          })
        }
      );

      if (!response.ok) {
        console.error("Failed to send Telegram alert:", await response.text());
      }
    } catch (error) {
      console.error("Error sending Telegram alert:", error);
    }
  }

  private async sendToWebhook(alert: Alert): Promise<void> {
    const { webhookUrl } = this.options;
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert)
      });

      if (!response.ok) {
        console.error("Failed to send webhook alert:", await response.text());
      }
    } catch (error) {
      console.error("Error sending webhook alert:", error);
    }
  }

  private async sendToEmail(alert: Alert): Promise<void> {
    // Email implementation would require nodemailer or similar
    // Placeholder for now
    console.log("Email alerting not yet implemented");
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case "info":
        return "ℹ️";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      case "critical":
        return "🚨";
    }
  }
}

/**
 * Default alerting system instance
 */
export const alerting = new AlertingSystem({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_ALERT_CHAT_ID,
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  enabledChannels: ["console", "telegram"]
});

/**
 * Quick alert helpers
 */
export const alert = {
  info: (title: string, message: string, metadata?: Record<string, unknown>) =>
    alerting.info(title, message, metadata),
  warning: (title: string, message: string, metadata?: Record<string, unknown>) =>
    alerting.warning(title, message, metadata),
  error: (title: string, message: string, metadata?: Record<string, unknown>) =>
    alerting.error(title, message, metadata),
  critical: (title: string, message: string, metadata?: Record<string, unknown>) =>
    alerting.critical(title, message, metadata)
};
