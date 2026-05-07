import { describe, it, expect, beforeEach } from "vitest";
import { WebhookHandler } from "./webhook-handler.js";

describe("WebhookHandler", () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    handler = new WebhookHandler({
      url: "https://test.com/webhook",
      method: "POST",
      headers: {
        "X-Custom-Header": "test"
      },
      timeout: 5000,
      retries: 2
    });
  });

  it("should initialize with config", () => {
    expect(handler).toBeDefined();
  });

  it("should use default values", () => {
    const defaultHandler = new WebhookHandler({
      url: "https://test.com/webhook"
    });
    expect(defaultHandler).toBeDefined();
  });

  it("should include custom headers", () => {
    expect((handler as any).headers).toHaveProperty("X-Custom-Header", "test");
    expect((handler as any).headers).toHaveProperty("Content-Type", "application/json");
    expect((handler as any).headers).toHaveProperty("User-Agent");
  });
});
