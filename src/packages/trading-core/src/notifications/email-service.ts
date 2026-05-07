/**
 * Email Notification Service
 * Uses nodemailer for SMTP email delivery
 */

import type { Notification, NotificationDeliveryResult } from "./types.js";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  constructor(private config: EmailConfig) {}

  /**
   * Send email notification
   */
  async send(
    notification: Notification,
    recipientEmail: string
  ): Promise<NotificationDeliveryResult> {
    try {
      const template = this.buildEmailTemplate(notification);

      // In production, use nodemailer
      // For now, simulate email sending
      const result = await this.sendEmail({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      return {
        notificationId: notification.id,
        channel: "email",
        success: true,
        deliveredAt: new Date().toISOString(),
        metadata: {
          messageId: result.messageId,
          recipient: recipientEmail
        }
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: "email",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build email template from notification
   */
  private buildEmailTemplate(notification: Notification): EmailTemplate {
    const priorityColors = {
      low: "#3b82f6",
      medium: "#f59e0b",
      high: "#ef4444",
      critical: "#dc2626"
    };

    const priorityLabels = {
      low: "Info",
      medium: "Warning",
      high: "Alert",
      critical: "Critical"
    };

    const color = priorityColors[notification.priority];
    const label = priorityLabels[notification.priority];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.subject || notification.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${color}; padding: 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${label}: ${notification.title}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px;">
              <div style="color: #374151; font-size: 16px; line-height: 1.6;">
                ${this.formatBody(notification.body)}
              </div>

              ${notification.data ? this.formatData(notification.data) : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Sent at ${new Date(notification.createdAt).toLocaleString()}
              </p>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">
                Trading Platform Notification System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const text = `
${label}: ${notification.title}

${notification.body}

${notification.data ? this.formatDataText(notification.data) : ""}

Sent at ${new Date(notification.createdAt).toLocaleString()}
    `.trim();

    return {
      subject: notification.subject || notification.title,
      html,
      text
    };
  }

  /**
   * Format notification body with HTML
   */
  private formatBody(body: string): string {
    return body
      .split("\n")
      .map(line => `<p style="margin: 0 0 10px 0;">${this.escapeHtml(line)}</p>`)
      .join("");
  }

  /**
   * Format notification data as HTML table
   */
  private formatData(data: Record<string, any>): string {
    const rows = Object.entries(data)
      .map(
        ([key, value]) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">
            ${this.escapeHtml(this.formatKey(key))}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">
            ${this.escapeHtml(String(value))}
          </td>
        </tr>
      `
      )
      .join("");

    return `
      <div style="margin-top: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 18px;">Details</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          ${rows}
        </table>
      </div>
    `;
  }

  /**
   * Format notification data as plain text
   */
  private formatDataText(data: Record<string, any>): string {
    return (
      "\nDetails:\n" +
      Object.entries(data)
        .map(([key, value]) => `  ${this.formatKey(key)}: ${value}`)
        .join("\n")
    );
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
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Send email using SMTP
   * In production, this would use nodemailer
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ messageId: string }> {
    // Simulate email sending
    console.log(`[Email] Sending to ${options.to}: ${options.subject}`);

    // In production:
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport(this.config);
    // return await transporter.sendMail({
    //   from: `"${this.config.from.name}" <${this.config.from.address}>`,
    //   to: options.to,
    //   subject: options.subject,
    //   text: options.text,
    //   html: options.html
    // });

    return {
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`
    };
  }

  /**
   * Verify email configuration
   */
  async verify(): Promise<boolean> {
    try {
      // In production, verify SMTP connection
      // const nodemailer = require('nodemailer');
      // const transporter = nodemailer.createTransport(this.config);
      // await transporter.verify();
      return true;
    } catch (error) {
      console.error("Email configuration verification failed:", error);
      return false;
    }
  }
}
