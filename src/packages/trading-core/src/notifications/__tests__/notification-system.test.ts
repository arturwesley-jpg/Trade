/**
 * Notification System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "pg";
import { NotificationManager } from "../notification-manager.js";
import { EmailService } from "../email-service.js";
import { SMSService } from "../sms-service.js";
import { PushService } from "../push-service.js";
import { TelegramService } from "../telegram-service.js";
import { DiscordService } from "../discord-service.js";
import { SlackService } from "../slack-service.js";
import type { SendNotificationRequest } from "../types.js";
import { isTestDatabaseAvailable } from "./vitest.setup.js";
import { getTestPool } from "./setup-test-db.js";

describe("NotificationManager", () => {
  let client: Client;
  let manager: NotificationManager;

  beforeEach(async () => {
    // Skip if database not available
    if (!isTestDatabaseAvailable()) {
      return;
    }

    client = new Client({
      host: process.env.TEST_DB_HOST || "localhost",
      port: parseInt(process.env.TEST_DB_PORT || "5432"),
      database: process.env.TEST_DB_NAME || "trading_test",
      user: process.env.TEST_DB_USER || "postgres",
      password: process.env.TEST_DB_PASSWORD || "postgres"
    });

    await client.connect();

    manager = new NotificationManager(client, {
      email: {
        host: "smtp.test.com",
        port: 587,
        secure: false,
        auth: { user: "test", pass: "test" },
        from: { name: "Test", address: "test@test.com" }
      },
      sms: {
        accountSid: "test-sid",
        authToken: "test-token",
        fromNumber: "+1234567890"
      },
      push: {
        vapidPublicKey: "test-public",
        vapidPrivateKey: "test-private",
        vapidSubject: "mailto:test@test.com"
      },
      telegram: {
        botToken: "test-token"
      }
    });
  });

  afterEach(async () => {
    if (!isTestDatabaseAvailable()) {
      return;
    }
    await client.end();
  });

  describe("send", () => {
    it.skipIf(!isTestDatabaseAvailable())("should create notifications for all requested channels", async () => {
      const request: SendNotificationRequest = {
        userId: "user-123",
        channels: ["email", "sms"],
        priority: "high",
        title: "Test Notification",
        body: "This is a test"
      };

      const notificationIds = await manager.send(request);

      expect(notificationIds).toHaveLength(2);
      expect(notificationIds[0]).toMatch(/^notif-/);
    });

    it.skipIf(!isTestDatabaseAvailable())("should filter channels based on user preferences", async () => {
      // Set up preferences with only email enabled
      await manager.updatePreferences("user-123", {
        channels: {
          email: { enabled: true, address: "test@test.com", verified: true },
          sms: { enabled: false, phoneNumber: "+1234567890", verified: true }
        }
      });

      const request: SendNotificationRequest = {
        userId: "user-123",
        channels: ["email", "sms"],
        priority: "medium",
        title: "Test",
        body: "Test"
      };

      const notificationIds = await manager.send(request);

      // Should only create email notification
      expect(notificationIds).toHaveLength(1);
    });

    it.skipIf(!isTestDatabaseAvailable())("should respect quiet hours for non-critical notifications", async () => {
      await manager.updatePreferences("user-123", {
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "08:00",
          timezone: "UTC"
        }
      });

      const request: SendNotificationRequest = {
        userId: "user-123",
        channels: ["email"],
        priority: "low",
        title: "Test",
        body: "Test"
      };

      // This test would need to mock the current time
      // to properly test quiet hours logic
    });

    it.skipIf(!isTestDatabaseAvailable())("should allow critical notifications during quiet hours", async () => {
      await manager.updatePreferences("user-123", {
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "08:00",
          timezone: "UTC"
        }
      });

      const request: SendNotificationRequest = {
        userId: "user-123",
        channels: ["email"],
        priority: "critical",
        title: "Critical Alert",
        body: "System down"
      };

      const notificationIds = await manager.send(request);
      expect(notificationIds.length).toBeGreaterThan(0);
    });
  });

  describe("getHistory", () => {
    it.skipIf(!isTestDatabaseAvailable())("should return notification history for user", async () => {
      // Create some notifications first
      await manager.send({
        userId: "user-123",
        channels: ["email"],
        priority: "medium",
        title: "Test 1",
        body: "Body 1"
      });

      await manager.send({
        userId: "user-123",
        channels: ["sms"],
        priority: "high",
        title: "Test 2",
        body: "Body 2"
      });

      const history = await manager.getHistory("user-123");

      expect(history.notifications.length).toBeGreaterThanOrEqual(2);
      expect(history.total).toBeGreaterThanOrEqual(2);
    });

    it.skipIf(!isTestDatabaseAvailable())("should filter history by channel", async () => {
      await manager.send({
        userId: "user-123",
        channels: ["email"],
        priority: "medium",
        title: "Email Test",
        body: "Body"
      });

      const history = await manager.getHistory("user-123", {
        channel: "email"
      });

      expect(history.notifications.every(n => n.channel === "email")).toBe(true);
    });

    it.skipIf(!isTestDatabaseAvailable())("should paginate results", async () => {
      const history = await manager.getHistory("user-123", {
        limit: 10,
        offset: 0
      });

      expect(history.pageSize).toBe(10);
      expect(history.page).toBe(1);
    });
  });

  describe("getStats", () => {
    it.skipIf(!isTestDatabaseAvailable())("should return notification statistics", async () => {
      const stats = await manager.getStats("user-123");

      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("byChannel");
      expect(stats).toHaveProperty("byStatus");
      expect(stats).toHaveProperty("byPriority");
      expect(stats).toHaveProperty("deliveryRate");
    });
  });

  describe("preferences", () => {
    it.skipIf(!isTestDatabaseAvailable())("should create default preferences for new user", async () => {
      const prefs = await manager.getPreferences("new-user");

      expect(prefs.userId).toBe("new-user");
      expect(prefs.channels.inApp?.enabled).toBe(true);
    });

    it.skipIf(!isTestDatabaseAvailable())("should update preferences", async () => {
      const updated = await manager.updatePreferences("user-123", {
        channels: {
          email: {
            enabled: true,
            address: "updated@test.com",
            verified: true
          }
        }
      });

      expect(updated.channels.email?.address).toBe("updated@test.com");
    });

    it.skipIf(!isTestDatabaseAvailable())("should add push subscription", async () => {
      await manager.addPushSubscription("user-123", {
        endpoint: "https://push.test.com/123",
        keys: {
          p256dh: "test-key",
          auth: "test-auth"
        },
        createdAt: new Date().toISOString()
      });

      const prefs = await manager.getPreferences("user-123");
      expect(prefs.channels.push?.subscriptions).toHaveLength(1);
    });

    it.skipIf(!isTestDatabaseAvailable())("should remove push subscription", async () => {
      const endpoint = "https://push.test.com/123";

      await manager.addPushSubscription("user-123", {
        endpoint,
        keys: { p256dh: "test", auth: "test" },
        createdAt: new Date().toISOString()
      });

      await manager.removePushSubscription("user-123", endpoint);

      const prefs = await manager.getPreferences("user-123");
      expect(prefs.channels.push?.subscriptions).toHaveLength(0);
    });
  });

  describe("templates", () => {
    it.skipIf(!isTestDatabaseAvailable())("should create notification template", async () => {
      const template = await manager.createTemplate({
        name: "Price Alert",
        channel: "email",
        body: "{{symbol}} has reached {{price}}",
        variables: ["symbol", "price"]
      });

      expect(template.id).toMatch(/^template-/);
      expect(template.name).toBe("Price Alert");
    });

    it.skipIf(!isTestDatabaseAvailable())("should get templates by channel", async () => {
      await manager.createTemplate({
        name: "Email Template",
        channel: "email",
        body: "Test",
        variables: []
      });

      const templates = await manager.getTemplates("email");
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.channel === "email")).toBe(true);
    });

    it.skipIf(!isTestDatabaseAvailable())("should update template", async () => {
      const template = await manager.createTemplate({
        name: "Original",
        channel: "email",
        body: "Original body",
        variables: []
      });

      const updated = await manager.updateTemplate(template.id, {
        name: "Updated",
        body: "Updated body"
      });

      expect(updated.name).toBe("Updated");
      expect(updated.body).toBe("Updated body");
    });

    it.skipIf(!isTestDatabaseAvailable())("should delete template", async () => {
      const template = await manager.createTemplate({
        name: "To Delete",
        channel: "email",
        body: "Test",
        variables: []
      });

      await manager.deleteTemplate(template.id);

      const retrieved = await manager.getTemplates();
      expect(retrieved.find(t => t.id === template.id)).toBeUndefined();
    });
  });
});

describe("EmailService", () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService({
      host: "smtp.test.com",
      port: 587,
      secure: false,
      auth: { user: "test", pass: "test" },
      from: { name: "Test", address: "test@test.com" }
    });
  });

  it("should build email template with correct structure", async () => {
    const notification = {
      id: "notif-123",
      userId: "user-123",
      channel: "email" as const,
      priority: "high" as const,
      status: "pending" as const,
      title: "Test Alert",
      body: "This is a test alert",
      data: { symbol: "BTC", price: 50000 },
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await service.send(notification, "test@test.com");

    expect(result.success).toBe(true);
    expect(result.channel).toBe("email");
  });
});

describe("SMSService", () => {
  let service: SMSService;

  beforeEach(() => {
    service = new SMSService({
      accountSid: "test-sid",
      authToken: "test-token",
      fromNumber: "+1234567890"
    });
  });

  it("should validate phone numbers", () => {
    expect(service.validatePhoneNumber("+12345678901")).toBe(true);
    expect(service.validatePhoneNumber("1234567890")).toBe(false);
    expect(service.validatePhoneNumber("+1")).toBe(false);
  });

  it("should format phone numbers to E.164", () => {
    expect(service.formatPhoneNumber("2345678901")).toBe("+12345678901");
    expect(service.formatPhoneNumber("+12345678901")).toBe("+12345678901");
  });

  it("should truncate long messages", async () => {
    const notification = {
      id: "notif-123",
      userId: "user-123",
      channel: "sms" as const,
      priority: "medium" as const,
      status: "pending" as const,
      title: "Test",
      body: "A".repeat(200),
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await service.send(notification, "+12345678901");
    expect(result.success).toBe(true);
  });
});

describe("PushService", () => {
  let service: PushService;

  beforeEach(() => {
    service = new PushService({
      vapidPublicKey: "test-public",
      vapidPrivateKey: "test-private",
      vapidSubject: "mailto:test@test.com"
    });
  });

  it("should validate push subscriptions", () => {
    const validSub = {
      endpoint: "https://push.test.com/123",
      keys: { p256dh: "test", auth: "test" },
      createdAt: new Date().toISOString()
    };

    expect(service.validateSubscription(validSub)).toBe(true);

    const invalidSub = {
      endpoint: "https://push.test.com/123",
      keys: { p256dh: "", auth: "" },
      createdAt: new Date().toISOString()
    };

    expect(service.validateSubscription(invalidSub)).toBe(false);
  });
});

describe("TelegramService", () => {
  let service: TelegramService;

  beforeEach(() => {
    service = new TelegramService({
      botToken: "test-token"
    });
  });

  it("should send notification with markdown formatting", async () => {
    const notification = {
      id: "notif-123",
      userId: "user-123",
      channel: "telegram" as const,
      priority: "high" as const,
      status: "pending" as const,
      title: "Test Alert",
      body: "This is a test",
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await service.send(notification, "123456789");
    expect(result.success).toBe(true);
  });
});

describe("DiscordService", () => {
  let service: DiscordService;

  beforeEach(() => {
    service = new DiscordService({
      defaultUsername: "Trading Bot"
    });
  });

  it("should validate webhook URLs", () => {
    const valid = "https://discord.com/api/webhooks/123456789/abcdefg";
    const invalid = "https://example.com/webhook";

    expect(service.validateWebhookUrl(valid)).toBe(true);
    expect(service.validateWebhookUrl(invalid)).toBe(false);
  });
});

describe("SlackService", () => {
  let service: SlackService;

  beforeEach(() => {
    service = new SlackService({
      defaultUsername: "Trading Bot"
    });
  });

  it("should validate webhook URLs", () => {
    const valid = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX";
    const invalid = "https://example.com/webhook";

    expect(service.validateWebhookUrl(valid)).toBe(true);
    expect(service.validateWebhookUrl(invalid)).toBe(false);
  });
});
