import type { AlertEvent, AlertDeliveryChannel } from "./types.js";

export interface AlertDeliveryService {
  deliver(event: AlertEvent): Promise<{ success: boolean; error?: string }>;
}

export interface TelegramDeliveryConfig {
  botToken: string;
  getUserChatId: (userId: string) => Promise<string | null>;
}

export interface EmailDeliveryConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  getUserEmail: (userId: string) => Promise<string | null>;
}

export interface WebhookDeliveryConfig {
  getUserWebhookUrl: (userId: string) => Promise<string | null>;
  timeout?: number;
}

/**
 * Telegram notification delivery
 */
export class TelegramDeliveryService implements AlertDeliveryService {
  constructor(private config: TelegramDeliveryConfig) {}

  async deliver(event: AlertEvent): Promise<{ success: boolean; error?: string }> {
    try {
      const chatId = await this.config.getUserChatId(event.userId);
      if (!chatId) {
        return { success: false, error: "User chat ID not found" };
      }

      const message = this.formatMessage(event);
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown"
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Telegram API error: ${error}` };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  private formatMessage(event: AlertEvent): string {
    const severityEmoji = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🚨",
      critical: "🔴"
    };

    const emoji = severityEmoji[event.severity];

    return (
      `${emoji} *${event.title}*\n\n` +
      `${event.message}\n\n` +
      `Type: \`${event.type}\`\n` +
      `Severity: \`${event.severity}\`\n` +
      `Time: \`${new Date(event.createdAt).toLocaleString()}\``
    );
  }
}

/**
 * Email notification delivery
 */
export class EmailDeliveryService implements AlertDeliveryService {
  constructor(private config: EmailDeliveryConfig) {}

  async deliver(event: AlertEvent): Promise<{ success: boolean; error?: string }> {
    try {
      const email = await this.config.getUserEmail(event.userId);
      if (!email) {
        return { success: false, error: "User email not found" };
      }

      // TODO: Implement actual email sending using nodemailer or similar
      // For now, return success as placeholder
      console.log(`[Email] Would send to ${email}:`, event.title);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

/**
 * Webhook notification delivery
 */
export class WebhookDeliveryService implements AlertDeliveryService {
  constructor(private config: WebhookDeliveryConfig) {}

  async deliver(event: AlertEvent): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookUrl = await this.config.getUserWebhookUrl(event.userId);
      if (!webhookUrl) {
        return { success: false, error: "User webhook URL not found" };
      }

      const timeout = this.config.timeout || 5000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "alert",
          data: event
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: `Webhook returned ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

/**
 * In-app notification (stored in database, no external delivery)
 */
export class InAppDeliveryService implements AlertDeliveryService {
  async deliver(event: AlertEvent): Promise<{ success: boolean; error?: string }> {
    // In-app notifications are already stored in the database
    // This service just marks them as delivered
    return { success: true };
  }
}

/**
 * Alert delivery manager with retry logic and rate limiting
 */
export class AlertDeliveryManager {
  private services: Map<AlertDeliveryChannel, AlertDeliveryService>;
  private deliveryQueue: AlertEvent[] = [];
  private isProcessing = false;
  private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(services: Partial<Record<AlertDeliveryChannel, AlertDeliveryService>>) {
    this.services = new Map(Object.entries(services) as [AlertDeliveryChannel, AlertDeliveryService][]);
  }

  /**
   * Deliver alert to all configured channels
   */
  async deliver(event: AlertEvent): Promise<{
    channel: AlertDeliveryChannel;
    success: boolean;
    error?: string;
  }[]> {
    const results: {
      channel: AlertDeliveryChannel;
      success: boolean;
      error?: string;
    }[] = [];

    for (const channel of event.deliveryChannels) {
      // Check rate limit
      if (!this.checkRateLimit(event.userId, channel)) {
        results.push({
          channel,
          success: false,
          error: "Rate limit exceeded"
        });
        continue;
      }

      const service = this.services.get(channel);
      if (!service) {
        results.push({
          channel,
          success: false,
          error: "Delivery service not configured"
        });
        continue;
      }

      const result = await service.deliver(event);
      results.push({
        channel,
        ...result
      });

      // Update rate limit
      if (result.success) {
        this.updateRateLimit(event.userId, channel);
      }
    }

    return results;
  }

  /**
   * Deliver with retry logic
   */
  async deliverWithRetry(
    event: AlertEvent,
    maxRetries = 3,
    retryDelayMs = 1000
  ): Promise<{
    channel: AlertDeliveryChannel;
    success: boolean;
    error?: string;
    attempts: number;
  }[]> {
    const results: {
      channel: AlertDeliveryChannel;
      success: boolean;
      error?: string;
      attempts: number;
    }[] = [];

    for (const channel of event.deliveryChannels) {
      let attempts = 0;
      let success = false;
      let lastError: string | undefined;

      while (attempts < maxRetries && !success) {
        attempts++;

        if (attempts > 1) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * Math.pow(2, attempts - 2)));
        }

        const service = this.services.get(channel);
        if (!service) {
          lastError = "Delivery service not configured";
          break;
        }

        const result = await service.deliver(event);
        success = result.success;
        lastError = result.error;
      }

      results.push({
        channel,
        success,
        error: lastError,
        attempts
      });
    }

    return results;
  }

  /**
   * Check rate limit for user and channel
   * Default: 10 alerts per minute per channel
   */
  private checkRateLimit(userId: string, channel: AlertDeliveryChannel): boolean {
    const key = `${userId}:${channel}`;
    const limit = this.rateLimits.get(key);
    const now = Date.now();

    if (!limit || now > limit.resetAt) {
      return true;
    }

    return limit.count < 10; // Max 10 per minute
  }

  /**
   * Update rate limit counter
   */
  private updateRateLimit(userId: string, channel: AlertDeliveryChannel): void {
    const key = `${userId}:${channel}`;
    const now = Date.now();
    const limit = this.rateLimits.get(key);

    if (!limit || now > limit.resetAt) {
      this.rateLimits.set(key, {
        count: 1,
        resetAt: now + 60_000 // 1 minute
      });
    } else {
      limit.count++;
    }
  }

  /**
   * Queue alert for batch delivery
   */
  queueAlert(event: AlertEvent): void {
    this.deliveryQueue.push(event);
    if (!this.isProcessing) {
      void this.processQueue();
    }
  }

  /**
   * Process queued alerts
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.deliveryQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.deliveryQueue.length > 0) {
      const event = this.deliveryQueue.shift();
      if (event) {
        await this.deliver(event);
      }

      // Small delay between deliveries
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }
}
