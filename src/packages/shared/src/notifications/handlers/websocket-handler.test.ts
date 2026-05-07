import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketHandler } from "./websocket-handler.js";
import type { NotificationMessage, NotificationHandler } from "../types.js";
import { logger } from "../../logger.js";

describe("WebSocketHandler", () => {
  let handler: WebSocketHandler;
  let mockBroadcastFn: ReturnType<typeof vi.fn>;
  let mockCheckClientOnline: ReturnType<typeof vi.fn>;
  let mockFallbackHandler: NotificationHandler;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    mockBroadcastFn = vi.fn();
    mockCheckClientOnline = vi.fn().mockReturnValue(false);
    mockFallbackHandler = {
      send: vi.fn().mockResolvedValue(undefined)
    };

    handler = new WebSocketHandler({
      broadcastFn: mockBroadcastFn as (userId: string, channel: string, data: unknown) => void,
      checkClientOnline: mockCheckClientOnline as (userId: string) => boolean,
      fallbackHandlers: [mockFallbackHandler],
      maxRetries: 2,
      retryDelay: 100
    });
  });

  afterEach(() => {
    handler.cleanup();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("send", () => {
    it("should send notification to online client", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      const message: NotificationMessage = {
        recipient: "user-123",
        message: "Test notification",
        priority: "normal",
        metadata: { type: "TRADE_ALERT" }
      };

      await handler.send(message);

      expect(mockBroadcastFn).toHaveBeenCalledWith(
        "123",
        "notifications",
        expect.objectContaining({
          type: "notification",
          notificationType: "TRADE_ALERT"
        })
      );
    });

    it("should extract userId from recipient", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      const message: NotificationMessage = {
        recipient: "user-456",
        message: "Test",
        priority: "normal"
      };

      await handler.send(message);

      expect(mockBroadcastFn).toHaveBeenCalledWith(
        "456",
        "notifications",
        expect.any(Object)
      );
    });

    it("should handle recipient without user- prefix", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      const message: NotificationMessage = {
        recipient: "789",
        message: "Test",
        priority: "normal"
      };

      await handler.send(message);

      expect(mockBroadcastFn).toHaveBeenCalledWith(
        "789",
        "notifications",
        expect.any(Object)
      );
    });

    it("should determine notification type from metadata", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      const testCases = [
        { type: "TRADE_ALERT", expected: "TRADE_ALERT" },
        { type: "PRICE_ALERT", expected: "PRICE_ALERT" },
        { type: "POSITION_ALERT", expected: "POSITION_ALERT" },
        { type: "SYSTEM_ALERT", expected: "SYSTEM_ALERT" }
      ];

      for (const testCase of testCases) {
        const message: NotificationMessage = {
          recipient: "user-123",
          message: "Test",
          priority: "normal",
          metadata: { type: testCase.type }
        };

        await handler.send(message);

        expect(mockBroadcastFn).toHaveBeenCalledWith(
          "123",
          "notifications",
          expect.objectContaining({
            notificationType: testCase.expected
          })
        );
      }
    });

    it("should infer notification type from content", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      const testCases = [
        { message: "Trade executed", expected: "TRADE_ALERT" },
        { message: "Price alert triggered", expected: "PRICE_ALERT" },
        { message: "Position updated", expected: "POSITION_ALERT" },
        { message: "System maintenance", expected: "SYSTEM_ALERT" }
      ];

      for (const testCase of testCases) {
        const message: NotificationMessage = {
          recipient: "user-123",
          message: testCase.message,
          priority: "normal"
        };

        await handler.send(message);

        expect(mockBroadcastFn).toHaveBeenCalledWith(
          "123",
          "notifications",
          expect.objectContaining({
            notificationType: testCase.expected
          })
        );
      }
    });

    it("should retry when client is offline", async () => {
      mockCheckClientOnline.mockReturnValueOnce(false).mockReturnValueOnce(true);

      const message: NotificationMessage = {
        recipient: "user-123",
        message: "Test",
        priority: "normal"
      };

      await handler.send(message);

      // Wait for retry
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockCheckClientOnline).toHaveBeenCalledTimes(2);
      expect(mockBroadcastFn).toHaveBeenCalledTimes(1);
    });

    it("should use fallback after max retries", async () => {
      mockCheckClientOnline.mockReturnValue(false);

      const message: NotificationMessage = {
        recipient: "user-123",
        message: "Test",
        priority: "high"
      };

      await handler.send(message);

      // Wait for all retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(mockFallbackHandler.send).toHaveBeenCalledWith(message);
    });

    it("should handle broadcast errors with retry", async () => {
      mockCheckClientOnline.mockReturnValue(true);
      mockBroadcastFn.mockImplementationOnce(() => {
        throw new Error("Broadcast failed");
      });
      mockBroadcastFn.mockImplementationOnce(() => {
        // Success on retry
      });

      const message: NotificationMessage = {
        recipient: "user-123",
        message: "Test",
        priority: "normal"
      };

      await handler.send(message);

      // Wait for retry
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockBroadcastFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("delivery tracking", () => {
    it("should track delivery status", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      const message: NotificationMessage = {
        recipient: "user-123",
        message: "Test",
        priority: "normal"
      };

      await handler.send(message);

      const stats = handler.getStats();
      expect(stats.total).toBe(1);
      expect(stats.delivered).toBe(1);
    });

    it("should track failed deliveries", async () => {
      mockCheckClientOnline.mockReturnValue(false);

      const message: NotificationMessage = {
        recipient: "user-123",
        message: "Test",
        priority: "normal"
      };

      await handler.send(message);

      // Wait for all retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      const stats = handler.getStats();
      expect(stats.failed).toBeGreaterThan(0);
    });

    it("should get delivery history for user", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      for (let i = 0; i < 3; i++) {
        await handler.send({
          recipient: "user-123",
          message: `Test ${i}`,
          priority: "normal"
        });
      }

      const history = handler.getDeliveryHistory("123");
      expect(history).toHaveLength(3);
      expect(history[0].userId).toBe("123");
    });

    it("should limit delivery history", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      for (let i = 0; i < 5; i++) {
        await handler.send({
          recipient: "user-123",
          message: `Test ${i}`,
          priority: "normal"
        });
      }

      const history = handler.getDeliveryHistory("123", 3);
      expect(history).toHaveLength(3);
    });
  });

  describe("cleanup", () => {
    it("should clear pending retries", async () => {
      mockCheckClientOnline.mockReturnValue(false);

      await handler.send({
        recipient: "user-123",
        message: "Test",
        priority: "normal"
      });

      const statsBefore = handler.getStats();
      expect(statsBefore.pendingRetries).toBeGreaterThan(0);

      handler.cleanup();

      const statsAfter = handler.getStats();
      expect(statsAfter.pendingRetries).toBe(0);
      expect(statsAfter.total).toBe(0);
    });

    it("should clear old history", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      await handler.send({
        recipient: "user-123",
        message: "Test",
        priority: "normal"
      });

      const cleared = handler.clearHistory(0);
      expect(cleared).toBe(1);

      const stats = handler.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe("notification types", () => {
    it("should support all notification types", async () => {
      mockCheckClientOnline.mockReturnValue(true);

      const types = ["TRADE_ALERT", "PRICE_ALERT", "POSITION_ALERT", "SYSTEM_ALERT"];

      for (const type of types) {
        await handler.send({
          recipient: "user-123",
          message: "Test",
          priority: "normal",
          metadata: { type }
        });

        expect(mockBroadcastFn).toHaveBeenCalledWith(
          "123",
          "notifications",
          expect.objectContaining({
            notificationType: type
          })
        );
      }
    });
  });
});
