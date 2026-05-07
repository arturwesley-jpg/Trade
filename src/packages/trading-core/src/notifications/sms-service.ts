/**
 * SMS Notification Service
 * Uses Twilio for SMS delivery
 */

import type { Notification, NotificationDeliveryResult } from "./types.js";

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  maxLength?: number; // Default 160 characters
}

export class SMSService {
  private readonly maxLength: number;

  constructor(private config: SMSConfig) {
    this.maxLength = config.maxLength || 160;
  }

  /**
   * Send SMS notification
   */
  async send(
    notification: Notification,
    recipientPhone: string
  ): Promise<NotificationDeliveryResult> {
    try {
      const message = this.buildSMSMessage(notification);
      const result = await this.sendSMS(recipientPhone, message);

      return {
        notificationId: notification.id,
        channel: "sms",
        success: true,
        deliveredAt: new Date().toISOString(),
        metadata: {
          messageSid: result.sid,
          recipient: recipientPhone,
          segments: result.segments
        }
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: "sms",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build SMS message from notification
   */
  private buildSMSMessage(notification: Notification): string {
    const priorityEmojis = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🚨",
      critical: "🔴"
    };

    const emoji = priorityEmojis[notification.priority];
    let message = `${emoji} ${notification.title}\n\n${notification.body}`;

    // Add key data points if available
    if (notification.data) {
      const keyData = this.extractKeyData(notification.data);
      if (keyData) {
        message += `\n\n${keyData}`;
      }
    }

    // Truncate if too long
    if (message.length > this.maxLength) {
      message = message.substring(0, this.maxLength - 3) + "...";
    }

    return message;
  }

  /**
   * Extract key data points for SMS
   */
  private extractKeyData(data: Record<string, any>): string {
    const keyFields = ["symbol", "price", "change", "volume"];
    const extracted: string[] = [];

    for (const field of keyFields) {
      if (data[field] !== undefined) {
        extracted.push(`${field}: ${data[field]}`);
      }
    }

    return extracted.join(", ");
  }

  /**
   * Send SMS using Twilio
   */
  private async sendSMS(
    to: string,
    body: string
  ): Promise<{ sid: string; segments: number }> {
    // Simulate SMS sending
    console.log(`[SMS] Sending to ${to}: ${body}`);

    // In production, use Twilio SDK:
    // const twilio = require('twilio');
    // const client = twilio(this.config.accountSid, this.config.authToken);
    // const message = await client.messages.create({
    //   body,
    //   from: this.config.fromNumber,
    //   to
    // });
    // return {
    //   sid: message.sid,
    //   segments: message.numSegments
    // };

    return {
      sid: `SM${Date.now()}${Math.random().toString(36).substring(7)}`,
      segments: Math.ceil(body.length / 160)
    };
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    // E.164 format: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Format phone number to E.164
   */
  formatPhoneNumber(phone: string, defaultCountryCode = "+1"): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");

    // If already has country code
    if (phone.startsWith("+")) {
      return "+" + digits;
    }

    // Add default country code
    return defaultCountryCode + digits;
  }

  /**
   * Verify SMS configuration
   */
  async verify(): Promise<boolean> {
    try {
      // In production, verify Twilio credentials
      // const twilio = require('twilio');
      // const client = twilio(this.config.accountSid, this.config.authToken);
      // await client.api.accounts(this.config.accountSid).fetch();
      return true;
    } catch (error) {
      console.error("SMS configuration verification failed:", error);
      return false;
    }
  }
}
