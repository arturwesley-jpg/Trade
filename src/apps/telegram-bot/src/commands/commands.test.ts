/**
 * Integration tests for Telegram bot commands
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStatus } from "../commands/status.js";
import { handlePositions } from "../commands/positions.js";
import { handleTrades } from "../commands/trades.js";
import { handleSignals } from "../commands/signals.js";
import { ApiClient } from "../utils/api.js";

// Mock Telegraf context
const createMockContext = () => ({
  reply: vi.fn().mockResolvedValue({}),
  replyWithMarkdown: vi.fn().mockResolvedValue({}),
  from: { id: 123456789, username: "testuser" },
  chat: { id: 123456789 },
  message: { message_id: 1, text: "/test" }
});

describe("Command Handlers", () => {
  let mockContext: any;
  let apiClient: ApiClient;

  beforeEach(() => {
    mockContext = createMockContext();
    apiClient = new ApiClient("http://localhost:3001");
    vi.clearAllMocks();
  });

  describe("handleStatus", () => {
    it("should display system status", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              status: "ok",
              mode: "paper",
              liveTradingEnabled: false
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              metrics: { totalTrades: 10, winRate: 60 },
              openPositions: 2
            }
          })
        });

      await handleStatus(mockContext, apiClient);

      expect(mockContext.reply).toHaveBeenCalled();
      const message = mockContext.reply.mock.calls[0][0];
      expect(message).toContain("System Status");
      expect(message).toContain("ok");
      expect(message).toContain("paper");
    });

    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await handleStatus(mockContext, apiClient);

      expect(mockContext.reply).toHaveBeenCalled();
      const message = mockContext.reply.mock.calls[0][0];
      expect(message).toContain("❌");
      expect(message).toContain("Error");
    });
  });

  describe("handlePositions", () => {
    it("should display open positions", async () => {
      const mockPositions = [
        {
          id: "pos-1",
          symbol: "BTC-USDT",
          side: "LONG",
          status: "OPEN",
          entryPrice: 100000,
          leverage: 10,
          marginUsdt: 1000,
          pnlUsdt: 50,
          openedAt: "2026-05-03T17:00:00.000Z",
          mode: "paper"
        }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockPositions })
      });

      await handlePositions(mockContext, apiClient);

      expect(mockContext.reply).toHaveBeenCalled();
      const message = mockContext.reply.mock.calls[0][0];
      expect(message).toContain("Open Positions");
      expect(message).toContain("BTC-USDT");
      expect(message).toContain("LONG");
    });

    it("should handle no positions", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      await handlePositions(mockContext, apiClient);

      expect(mockContext.reply).toHaveBeenCalled();
      const message = mockContext.reply.mock.calls[0][0];
      expect(message).toContain("No open positions");
    });
  });

  describe("handleTrades", () => {
    it("should display trade history", async () => {
      const mockTrades = [
        {
          id: "trade-1",
          symbol: "BTC-USDT",
          side: "LONG",
          entryPrice: 100000,
          exitPrice: 101000,
          pnlUsdt: 100,
          openedAt: "2026-05-03T16:00:00.000Z",
          closedAt: "2026-05-03T17:00:00.000Z",
          mode: "paper",
          leverage: 10,
          marginUsdt: 1000
        }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockTrades })
      });

      await handleTrades(mockContext, apiClient);

      expect(mockContext.reply).toHaveBeenCalled();
      const message = mockContext.reply.mock.calls[0][0];
      expect(message).toContain("Trade History");
      expect(message).toContain("BTC-USDT");
    });

    it("should handle no trades", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      await handleTrades(mockContext, apiClient);

      expect(mockContext.reply).toHaveBeenCalled();
      const message = mockContext.reply.mock.calls[0][0];
      expect(message).toContain("No closed trades");
    });
  });

  describe("handleSignals", () => {
    it("should display trading signals", async () => {
      const mockSignals = [
        {
          symbol: "BTC-USDT",
          direction: "LONG",
          confidence: "high",
          priceChangePct: 2.5,
          rationale: "Strong bullish momentum"
        }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockSignals })
      });

      await handleSignals(mockContext, apiClient);

      expect(mockContext.reply).toHaveBeenCalled();
      const message = mockContext.reply.mock.calls[0][0];
      expect(message).toContain("Trading Signals");
      expect(message).toContain("BTC-USDT");
      expect(message).toContain("LONG");
    });
  });
});
