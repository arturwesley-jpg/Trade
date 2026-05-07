import { describe, it, expect, beforeEach } from "vitest";
import { TelegramHandler } from "./telegram-handler.js";
import type { NotificationMessage } from "../types.js";

describe("TelegramHandler", () => {
  let handler: TelegramHandler;

  beforeEach(() => {
    handler = new TelegramHandler({
      botToken: "test-token"
    });
  });

  it("should initialize with config", () => {
    expect(handler).toBeDefined();
  });

  it("should format message with priority emoji", () => {
    const message: NotificationMessage = {
      recipient: "123456",
      subject: "Test Alert",
      message: "Test message",
      priority: "critical"
    };

    const formatted = (handler as any).formatMessage(message);
    expect(formatted).toContain("🚨");
    expect(formatted).toContain("CRITICAL");
    expect(formatted).toContain("Test Alert");
    expect(formatted).toContain("Test message");
  });

  it("should include metadata in formatted message", () => {
    const message: NotificationMessage = {
      recipient: "123456",
      message: "Test",
      priority: "normal",
      metadata: {
        userId: "user-123",
        action: "trade"
      }
    };

    const formatted = (handler as any).formatMessage(message);
    expect(formatted).toContain("userId");
    expect(formatted).toContain("user-123");
    expect(formatted).toContain("action");
    expect(formatted).toContain("trade");
  });

  it("should escape HTML in messages", () => {
    const text = "<script>alert('xss')</script>";
    const escaped = (handler as any).escapeHtml(text);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });
});
