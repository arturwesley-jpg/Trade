import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailHandler } from "./email-handler.js";
import type { NotificationMessage } from "../types.js";

describe("EmailHandler", () => {
  let handler: EmailHandler;

  beforeEach(() => {
    handler = new EmailHandler({
      host: "smtp.test.com",
      port: 587,
      secure: false,
      auth: {
        user: "test@test.com",
        pass: "password"
      },
      from: "Test <test@test.com>"
    });
  });

  it("should initialize with config", () => {
    expect(handler).toBeDefined();
  });

  it("should format HTML message with priority", () => {
    const message: NotificationMessage = {
      recipient: "user@test.com",
      subject: "Test",
      message: "Test message",
      priority: "high"
    };

    // Access private method via any cast for testing
    const html = (handler as any).formatHtml(message.message, message.priority);
    expect(html).toContain("Test message");
    expect(html).toContain("high");
  });

  it("should escape HTML in messages", () => {
    const text = "<script>alert('xss')</script>";
    const escaped = (handler as any).escapeHtml(text);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });

  it("should map priority correctly", () => {
    expect((handler as any).mapPriority("critical")).toBe("high");
    expect((handler as any).mapPriority("high")).toBe("high");
    expect((handler as any).mapPriority("normal")).toBe("normal");
    expect((handler as any).mapPriority("low")).toBe("low");
  });
});
