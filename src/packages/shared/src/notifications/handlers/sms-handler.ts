import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  apiUrl?: string;
  maxLength?: number;
}

export class SMSHandler implements NotificationHandler {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly apiUrl: string;
  private readonly maxLength: number;

  constructor(config: SMSConfig) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
    this.apiUrl = config.apiUrl ?? "https://api.twilio.com/2010-04-01";
    this.maxLength = config.maxLength ?? 160;
    logger.info("SMS handler initialized");
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      const text = this.formatMessage(message);
      const url = `${this.apiUrl}/Accounts/${this.accountSid}/Messages.json`;

      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`
        },
        body: new URLSearchParams({
          To: message.recipient,
          From: this.fromNumber,
          Body: text
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twilio API error: ${error}`);
      }

      const result = await response.json();
      logger.info(
        { messageSid: result.sid, recipient: message.recipient },
        "SMS sent successfully"
      );
    } catch (error) {
      logger.error("Failed to send SMS", {
        error: error instanceof Error ? error : String(error),
        recipient: message.recipient
      });
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

    let text = `${priorityEmoji} ${message.subject || "Alert"}\n\n${message.message}`;

    // Truncate if too long
    if (text.length > this.maxLength) {
      text = text.substring(0, this.maxLength - 3) + "...";
    }

    return text;
  }

  validatePhoneNumber(phone: string): boolean {
    // E.164 format: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  async verify(): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/Accounts/${this.accountSid}.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to verify Twilio credentials");
      }

      logger.info("SMS handler verified successfully");
      return true;
    } catch (error) {
      logger.error("SMS handler verification failed", {
        error: error instanceof Error ? error : String(error)
      });
      return false;
    }
  }
}
