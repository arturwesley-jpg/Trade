import { notificationService } from "@trade/shared/notifications";
import { EmailHandler } from "@trade/shared/notifications";
import { TelegramHandler } from "@trade/shared/notifications";
import { WebhookHandler } from "@trade/shared/notifications";
import { SlackHandler } from "@trade/shared/notifications";
import { WebSocketHandler } from "@trade/shared/notifications";
import { logger } from "@trade/shared/logger";
import type { TradingWebSocketServer } from "../websocket.js";

export function initializeNotifications(wsServer?: TradingWebSocketServer): void {
  // Email handler
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const emailHandler = new EmailHandler({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER
    });

    notificationService.registerHandler("email", emailHandler);
    logger.info("Email notification handler registered");
  }

  // Telegram handler
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const telegramHandler = new TelegramHandler({
      botToken: process.env.TELEGRAM_BOT_TOKEN
    });

    notificationService.registerHandler("telegram", telegramHandler);
    logger.info("Telegram notification handler registered");
  }

  // Webhook handler
  if (process.env.WEBHOOK_URL) {
    const webhookHandler = new WebhookHandler({
      url: process.env.WEBHOOK_URL,
      headers: process.env.WEBHOOK_HEADERS ? JSON.parse(process.env.WEBHOOK_HEADERS) : undefined,
      timeout: process.env.WEBHOOK_TIMEOUT ? parseInt(process.env.WEBHOOK_TIMEOUT, 10) : undefined,
      retries: process.env.WEBHOOK_RETRIES ? parseInt(process.env.WEBHOOK_RETRIES, 10) : undefined
    });

    notificationService.registerHandler("webhook", webhookHandler);
    logger.info("Webhook notification handler registered");
  }

  // Slack handler
  if (process.env.SLACK_WEBHOOK_URL || process.env.SLACK_BOT_TOKEN) {
    const slackHandler = new SlackHandler({
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      botToken: process.env.SLACK_BOT_TOKEN,
      defaultChannel: process.env.SLACK_DEFAULT_CHANNEL
    });

    notificationService.registerHandler("slack", slackHandler);
    logger.info("Slack notification handler registered");
  }

  // WebSocket handler
  if (wsServer) {
    // Collect fallback handlers
    const fallbackHandlers = [];
    if (notificationService.hasHandler("telegram")) {
      fallbackHandlers.push(notificationService["handlers"].get("telegram")!);
    }
    if (notificationService.hasHandler("email")) {
      fallbackHandlers.push(notificationService["handlers"].get("email")!);
    }

    const websocketHandler = new WebSocketHandler({
      broadcastFn: (userId, channel, data) => wsServer.broadcastToUser(userId, channel, data),
      checkClientOnline: (userId) => wsServer.isClientOnline(userId),
      fallbackHandlers,
      maxRetries: 3,
      retryDelay: 5000
    });

    notificationService.registerHandler("push", websocketHandler);
    logger.info("WebSocket notification handler registered with fallback support");
  }

  // Register notification templates
  notificationService.registerTemplate("trade-executed", {
    subject: "Trade Executed: {{symbol}}",
    body: `Trade executed successfully:

Symbol: {{symbol}}
Side: {{side}}
Amount: {{amount}}
Price: {{price}}
Total: {{total}}

Order ID: {{orderId}}
Timestamp: {{timestamp}}`
  });

  notificationService.registerTemplate("position-opened", {
    subject: "Position Opened: {{symbol}}",
    body: `New position opened:

Symbol: {{symbol}}
Side: {{side}}
Size: {{size}}
Entry Price: {{entryPrice}}
Stop Loss: {{stopLoss}}
Take Profit: {{takeProfit}}

Position ID: {{positionId}}
Timestamp: {{timestamp}}`
  });

  notificationService.registerTemplate("position-closed", {
    subject: "Position Closed: {{symbol}}",
    body: `Position closed:

Symbol: {{symbol}}
Side: {{side}}
Size: {{size}}
Entry Price: {{entryPrice}}
Exit Price: {{exitPrice}}
PnL: {{pnl}}
PnL %: {{pnlPercent}}%

Position ID: {{positionId}}
Timestamp: {{timestamp}}`
  });

  notificationService.registerTemplate("alert-triggered", {
    subject: "Alert Triggered: {{alertName}}",
    body: `Alert has been triggered:

Alert: {{alertName}}
Condition: {{condition}}
Current Value: {{currentValue}}
Threshold: {{threshold}}

Message: {{message}}
Timestamp: {{timestamp}}`
  });

  notificationService.registerTemplate("risk-warning", {
    subject: "Risk Warning: {{warningType}}",
    body: `Risk warning detected:

Warning Type: {{warningType}}
Severity: {{severity}}
Description: {{description}}

Current Exposure: {{exposure}}
Risk Limit: {{limit}}

Action Required: {{action}}
Timestamp: {{timestamp}}`
  });

  notificationService.registerTemplate("system-error", {
    subject: "System Error: {{errorType}}",
    body: `System error occurred:

Error Type: {{errorType}}
Component: {{component}}
Message: {{message}}

Stack Trace:
{{stackTrace}}

Timestamp: {{timestamp}}`
  });

  // Configure batching for low-priority notifications
  if (notificationService.hasHandler("email")) {
    notificationService.enableBatching("email", {
      interval: 60000, // 1 minute
      maxSize: 10
    });
  }

  // Configure rate limits
  if (notificationService.hasHandler("telegram")) {
    notificationService.setRateLimit("telegram", {
      maxPerMinute: 20,
      maxPerHour: 100
    });
  }

  if (notificationService.hasHandler("email")) {
    notificationService.setRateLimit("email", {
      maxPerMinute: 10,
      maxPerHour: 100,
      maxPerDay: 500
    });
  }

  logger.info("Notification system initialized");
}
