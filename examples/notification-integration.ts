/**
 * Example: Notification System Integration
 * Shows how to integrate the notification system into your application
 */

import express from "express";
import { Client } from "pg";
import {
  NotificationManager,
  startNotificationWorker,
  createAlertNotificationIntegration
} from "@trade/trading-core/notifications";
import notificationRoutes from "./routes/notifications-v2.js";
import alertRoutes from "./routes/alerts.js";

// Initialize Express app
const app = express();
app.use(express.json());

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432"),
  database: process.env.DATABASE_NAME || "trading_platform",
  user: process.env.DATABASE_USER || "postgres",
  password: process.env.DATABASE_PASSWORD || "postgres"
};

// Notification configuration
const notificationConfig = {
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || ""
    },
    from: {
      name: process.env.SMTP_FROM_NAME || "Trading Platform",
      address: process.env.SMTP_FROM_ADDRESS || "noreply@tradingplatform.com"
    }
  },
  sms: process.env.TWILIO_ACCOUNT_SID
    ? {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN || "",
        fromNumber: process.env.TWILIO_FROM_NUMBER || ""
      }
    : undefined,
  push: process.env.VAPID_PUBLIC_KEY
    ? {
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
        vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@tradingplatform.com"
      }
    : undefined,
  telegram: process.env.TELEGRAM_BOT_TOKEN
    ? {
        botToken: process.env.TELEGRAM_BOT_TOKEN
      }
    : undefined,
  discord: {},
  slack: {}
};

async function startServer() {
  try {
    // Initialize database client
    const client = new Client(dbConfig);
    await client.connect();
    console.log("✓ Database connected");

    // Initialize notification manager
    const notificationManager = new NotificationManager(client, notificationConfig);
    console.log("✓ Notification manager initialized");

    // Attach to app for route access
    app.locals.notificationManager = notificationManager;

    // Start notification worker
    const worker = await startNotificationWorker({
      database: dbConfig,
      notifications: notificationConfig,
      pollIntervalMs: parseInt(process.env.NOTIFICATION_WORKER_POLL_INTERVAL_MS || "5000"),
      batchSize: parseInt(process.env.NOTIFICATION_WORKER_BATCH_SIZE || "100")
    });
    console.log("✓ Notification worker started");

    // Initialize alert-notification integration
    const alertIntegration = createAlertNotificationIntegration(notificationManager, {
      defaultChannels: ["in-app", "email"],
      priorityMapping: {
        price: "medium",
        indicator: "medium",
        whale: "high",
        news: "low",
        risk: "high",
        trade: "high",
        system: "critical",
        performance: "medium"
      },
      enableAutoNotifications: true
    });
    console.log("✓ Alert-notification integration initialized");

    // Mount routes
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/alerts", alertRoutes);

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          notificationManager: "initialized",
          notificationWorker: worker.getStatus()
        }
      });
    });

    // Start server
    const port = parseInt(process.env.PORT || "3000");
    app.listen(port, () => {
      console.log(`✓ Server listening on port ${port}`);
      console.log("\nNotification System Ready!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("API Endpoints:");
      console.log(`  POST   /api/notifications/send`);
      console.log(`  GET    /api/notifications/history`);
      console.log(`  GET    /api/notifications/stats`);
      console.log(`  GET    /api/notifications/preferences`);
      console.log(`  PUT    /api/notifications/preferences`);
      console.log(`  POST   /api/notifications/push/subscribe`);
      console.log(`  POST   /api/notifications/test`);
      console.log(`  POST   /api/alerts`);
      console.log(`  GET    /api/alerts`);
      console.log(`  PUT    /api/alerts/:id`);
      console.log(`  DELETE /api/alerts/:id`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      console.log("\nSIGTERM received, shutting down gracefully...");
      await worker.stop();
      await client.end();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("\nSIGINT received, shutting down gracefully...");
      await worker.stop();
      await client.end();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();

/**
 * Example: Send notification from anywhere in your app
 */
export async function sendPriceAlert(
  notificationManager: NotificationManager,
  userId: string,
  symbol: string,
  currentPrice: number,
  targetPrice: number
) {
  await notificationManager.send({
    userId,
    channels: ["email", "push", "telegram"],
    priority: "high",
    title: `Price Alert: ${symbol}`,
    body: `${symbol} has reached your target price of $${targetPrice.toLocaleString()}`,
    data: {
      symbol,
      currentPrice,
      targetPrice,
      change: ((currentPrice - targetPrice) / targetPrice * 100).toFixed(2) + "%",
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Example: Send whale alert
 */
export async function sendWhaleAlert(
  notificationManager: NotificationManager,
  userId: string,
  transaction: {
    symbol: string;
    amount: number;
    value: number;
    type: "buy" | "sell";
    exchange: string;
  }
) {
  await notificationManager.send({
    userId,
    channels: ["telegram", "discord", "in-app"],
    priority: "high",
    title: `🐋 Whale Alert: ${transaction.symbol}`,
    body: `Large ${transaction.type} detected on ${transaction.exchange}\nAmount: ${transaction.amount.toLocaleString()} ${transaction.symbol}\nValue: $${transaction.value.toLocaleString()}`,
    data: {
      alertType: "whale",
      ...transaction,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Example: Send risk alert
 */
export async function sendRiskAlert(
  notificationManager: NotificationManager,
  userId: string,
  risk: {
    level: "low" | "medium" | "high" | "critical";
    message: string;
    metrics: Record<string, any>;
  }
) {
  const priorityMap = {
    low: "low" as const,
    medium: "medium" as const,
    high: "high" as const,
    critical: "critical" as const
  };

  await notificationManager.send({
    userId,
    channels: ["email", "sms", "push"],
    priority: priorityMap[risk.level],
    title: `⚠️ Risk Alert: ${risk.level.toUpperCase()}`,
    body: risk.message,
    data: {
      alertType: "risk",
      riskLevel: risk.level,
      ...risk.metrics,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Example: Send trade execution notification
 */
export async function sendTradeNotification(
  notificationManager: NotificationManager,
  userId: string,
  trade: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    total: number;
    orderId: string;
  }
) {
  await notificationManager.send({
    userId,
    channels: ["in-app", "email"],
    priority: "medium",
    title: `Trade Executed: ${trade.side.toUpperCase()} ${trade.symbol}`,
    body: `Your ${trade.side} order has been executed\n\nQuantity: ${trade.quantity}\nPrice: $${trade.price}\nTotal: $${trade.total.toLocaleString()}\nOrder ID: ${trade.orderId}`,
    data: {
      alertType: "trade",
      ...trade,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Example: Send daily digest
 */
export async function sendDailyDigest(
  notificationManager: NotificationManager,
  userId: string,
  summary: {
    totalTrades: number;
    profitLoss: number;
    topGainer: { symbol: string; change: number };
    topLoser: { symbol: string; change: number };
    alerts: number;
  }
) {
  await notificationManager.send({
    userId,
    channels: ["email"],
    priority: "low",
    subject: "Daily Trading Summary",
    title: "Your Daily Trading Summary",
    body: `Here's your trading activity for today:

📊 Total Trades: ${summary.totalTrades}
💰 P&L: ${summary.profitLoss >= 0 ? "+" : ""}$${summary.profitLoss.toLocaleString()}
📈 Top Gainer: ${summary.topGainer.symbol} (+${summary.topGainer.change}%)
📉 Top Loser: ${summary.topLoser.symbol} (${summary.topLoser.change}%)
🔔 Alerts Triggered: ${summary.alerts}

Keep up the great work!`,
    data: {
      alertType: "digest",
      period: "daily",
      ...summary,
      timestamp: new Date().toISOString()
    }
  });
}
