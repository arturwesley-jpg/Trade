import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailHandler implements NotificationHandler {
  private transporter: Transporter;
  private from: string;

  constructor(config: EmailConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    });

    logger.info({ host: config.host }, "Email handler initialized");
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: message.recipient,
        subject: message.subject ?? "Notification",
        text: message.message,
        html: this.formatHtml(message.message, message.priority),
        priority: this.mapPriority(message.priority)
      });

      logger.info(
        { messageId: info.messageId, recipient: message.recipient },
        "Email sent successfully"
      );
    } catch (error) {
      logger.error("Failed to send email", { error: error instanceof Error ? error : String(error), recipient: message.recipient });
      throw error;
    }
  }

  private formatHtml(message: string, priority: string): string {
    const priorityColor = {
      low: "#6c757d",
      normal: "#0d6efd",
      high: "#fd7e14",
      critical: "#dc3545"
    }[priority] ?? "#0d6efd";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .priority-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              background-color: ${priorityColor};
              color: white;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 16px;
            }
            .message { white-space: pre-wrap; }
            .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="priority-badge">${priority}</div>
            <div class="message">${this.escapeHtml(message)}</div>
            <div class="footer">
              This is an automated notification from your trading system.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private mapPriority(priority: string): "high" | "normal" | "low" {
    if (priority === "critical" || priority === "high") return "high";
    if (priority === "low") return "low";
    return "normal";
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info("Email handler verified successfully");
      return true;
    } catch (error) {
      logger.error("Email handler verification failed", { error: error instanceof Error ? error : String(error) });
      return false;
    }
  }
}
