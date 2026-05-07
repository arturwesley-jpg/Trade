import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotificationService } from "./notification-service.js";
import type { NotificationChannel, NotificationPriority } from "./types.js";

describe("NotificationService", () => {
  let service: NotificationService;
  let mockHandlers: Map<NotificationChannel, any>;

  beforeEach(() => {
    mockHandlers = new Map();
    service = new NotificationService();
  });

  describe("Channel Registration", () => {
    it("should register notification handlers", () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);
      expect(service.hasHandler("email")).toBe(true);
    });

    it("should unregister notification handlers", () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);
      service.unregisterHandler("email");
      expect(service.hasHandler("email")).toBe(false);
    });
  });

  describe("Notification Sending", () => {
    it("should send notification to single channel", async () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);

      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Test",
        message: "Test message",
        priority: "normal"
      });

      expect(handler.send).toHaveBeenCalledWith({
        recipient: "user@example.com",
        subject: "Test",
        message: "Test message",
        priority: "normal",
        metadata: undefined
      });
    });

    it("should send notification to multiple channels", async () => {
      const emailHandler = {
        send: vi.fn().mockResolvedValue(undefined)
      };
      const smsHandler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", emailHandler);
      service.registerHandler("sms", smsHandler);

      await service.sendMulti({
        channels: ["email", "sms"],
        recipient: "user@example.com",
        subject: "Test",
        message: "Test message",
        priority: "high"
      });

      expect(emailHandler.send).toHaveBeenCalled();
      expect(smsHandler.send).toHaveBeenCalled();
    });

    it("should handle missing handler gracefully", async () => {
      await expect(
        service.send({
          channel: "email",
          recipient: "user@example.com",
          subject: "Test",
          message: "Test message",
          priority: "normal"
        })
      ).resolves.not.toThrow();
    });

    it("should handle handler errors gracefully", async () => {
      const handler = {
        send: vi.fn().mockRejectedValue(new Error("Send failed"))
      };

      service.registerHandler("email", handler);

      await expect(
        service.send({
          channel: "email",
          recipient: "user@example.com",
          subject: "Test",
          message: "Test message",
          priority: "normal"
        })
      ).resolves.not.toThrow();
    });
  });

  describe("Priority Handling", () => {
    it("should send critical notifications immediately", async () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);

      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Critical Alert",
        message: "System down",
        priority: "critical"
      });

      expect(handler.send).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "critical"
        })
      );
    });

    it("should batch low priority notifications", async () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);
      service.enableBatching("email", { interval: 100, maxSize: 10 });

      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Info",
        message: "Low priority message",
        priority: "low"
      });

      // Should not send immediately
      expect(handler.send).not.toHaveBeenCalled();

      // Wait for batch interval
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(handler.send).toHaveBeenCalled();
    });
  });

  describe("Template Support", () => {
    it("should render notification templates", async () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);
      service.registerTemplate("welcome", {
        subject: "Welcome {{name}}!",
        body: "Hello {{name}}, welcome to our platform."
      });

      await service.sendFromTemplate({
        channel: "email",
        recipient: "user@example.com",
        template: "welcome",
        data: { name: "John" },
        priority: "normal"
      });

      expect(handler.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Welcome John!",
          message: "Hello John, welcome to our platform."
        })
      );
    });
  });

  describe("Notification History", () => {
    it("should track sent notifications", async () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);

      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Test",
        message: "Test message",
        priority: "normal"
      });

      const history = service.getHistory({ limit: 10 });
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        channel: "email",
        recipient: "user@example.com",
        subject: "Test",
        status: "sent"
      });
    });

    it("should track failed notifications", async () => {
      const handler = {
        send: vi.fn().mockRejectedValue(new Error("Send failed"))
      };

      service.registerHandler("email", handler);

      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Test",
        message: "Test message",
        priority: "normal"
      });

      const history = service.getHistory({ limit: 10 });
      expect(history[0].status).toBe("failed");
      expect(history[0].error).toBe("Send failed");
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limits", async () => {
      const handler = {
        send: vi.fn().mockResolvedValue(undefined)
      };

      service.registerHandler("email", handler);
      service.setRateLimit("email", { maxPerMinute: 2 });

      // Send 3 notifications
      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Test 1",
        message: "Message 1",
        priority: "normal"
      });

      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Test 2",
        message: "Message 2",
        priority: "normal"
      });

      await service.send({
        channel: "email",
        recipient: "user@example.com",
        subject: "Test 3",
        message: "Message 3",
        priority: "normal"
      });

      // Only 2 should be sent immediately
      expect(handler.send).toHaveBeenCalledTimes(2);
    });
  });
});
