import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export interface WebhookConfig {
  url: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export class WebhookHandler implements NotificationHandler {
  private readonly url: string;
  private readonly method: "POST" | "PUT";
  private readonly headers: Record<string, string>;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(config: WebhookConfig) {
    this.url = config.url;
    this.method = config.method ?? "POST";
    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": "Trade-Notification-System/1.0",
      ...config.headers
    };
    this.timeout = config.timeout ?? 10000;
    this.retries = config.retries ?? 3;

    logger.info({ url: this.url }, "Webhook handler initialized");
  }

  async send(message: NotificationMessage): Promise<void> {
    const payload = {
      recipient: message.recipient,
      subject: message.subject,
      message: message.message,
      priority: message.priority,
      metadata: message.metadata,
      timestamp: new Date().toISOString()
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(this.url, {
          method: this.method,
          headers: this.headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Webhook returned ${response.status}: ${errorText}`);
        }

        logger.info(
          { url: this.url, recipient: message.recipient, attempt },
          "Webhook notification sent successfully"
        );
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          { error: lastError, url: this.url, attempt, maxRetries: this.retries },
          "Webhook notification attempt failed"
        );

        if (attempt < this.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(
      "Failed to send webhook notification after all retries",
      { error: lastError instanceof Error ? lastError : String(lastError), url: this.url, recipient: message.recipient }
    );
    throw lastError;
  }

  async verify(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.url, {
        method: "HEAD",
        headers: this.headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const isValid = response.ok || response.status === 405; // 405 = Method Not Allowed is acceptable
      if (isValid) {
        logger.info({ url: this.url }, "Webhook handler verified successfully");
      } else {
        logger.warn({ url: this.url, status: response.status }, "Webhook verification returned non-OK status");
      }
      return isValid;
    } catch (error) {
      logger.error("Webhook handler verification failed", { error: error instanceof Error ? error : String(error), url: this.url });
      return false;
    }
  }
}
