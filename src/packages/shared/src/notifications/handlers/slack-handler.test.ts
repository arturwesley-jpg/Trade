import { describe, it, expect, beforeEach } from "vitest";
import { SlackHandler } from "./slack-handler.js";
import type { NotificationMessage } from "../types.js";

describe("SlackHandler", () => {
  describe("Webhook mode", () => {
    let handler: SlackHandler;

    beforeEach(() => {
      handler = new SlackHandler({
        webhookUrl: "https://hooks.slack.com/services/TEST/WEBHOOK/URL"
      });
    });

    it("should initialize with webhook URL", () => {
      expect(handler).toBeDefined();
    });

    it("should build Slack message with blocks", () => {
      const message: NotificationMessage = {
        recipient: "#alerts",
        subject: "Test Alert",
        message: "Test message",
        priority: "high"
      };

      const slackMessage = (handler as any).buildSlackMessage(message);
      expect(slackMessage).toHaveProperty("text");
      expect(slackMessage).toHaveProperty("blocks");
      expect(slackMessage.blocks).toBeInstanceOf(Array);
      expect(slackMessage.blocks.length).toBeGreaterThan(0);
    });

    it("should include metadata in message", () => {
      const message: NotificationMessage = {
        recipient: "#alerts",
        message: "Test",
        priority: "normal",
        metadata: {
          userId: "user-123",
          action: "trade"
        }
      };

      const slackMessage = (handler as any).buildSlackMessage(message);
      const metadataBlock = slackMessage.blocks.find(
        (block: any) => block.type === "section" && block.fields
      );
      expect(metadataBlock).toBeDefined();
    });
  });

  describe("Bot mode", () => {
    let handler: SlackHandler;

    beforeEach(() => {
      handler = new SlackHandler({
        botToken: "xoxb-test-token",
        defaultChannel: "#general"
      });
    });

    it("should initialize with bot token", () => {
      expect(handler).toBeDefined();
    });
  });

  it("should throw error without webhook or token", () => {
    expect(() => new SlackHandler({})).toThrow();
  });
});
