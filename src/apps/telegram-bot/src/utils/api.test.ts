/**
 * Unit tests for API Client
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiClient, formatApiError } from "../utils/api.js";

describe("ApiClient", () => {
  let apiClient: ApiClient;
  const baseUrl = "http://localhost:3001";

  beforeEach(() => {
    apiClient = new ApiClient(baseUrl);
    vi.clearAllMocks();
  });

  describe("getHealth", () => {
    it("should fetch health status", async () => {
      const mockResponse = {
        data: {
          status: "ok",
          mode: "paper",
          liveTradingEnabled: false
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await apiClient.getHealth();

      expect(result).toEqual(mockResponse.data);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/health`);
    });

    it("should handle API errors", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error"
      });

      await expect(apiClient.getHealth()).rejects.toThrow(
        "API request failed: 500 Internal Server Error"
      );
    });
  });

  describe("getPositions", () => {
    it("should fetch positions", async () => {
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
          openedAt: "2026-05-03T17:00:00.000Z"
        }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockPositions })
      });

      const result = await apiClient.getPositions();

      expect(result).toEqual(mockPositions);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/positions`);
    });
  });

  describe("getTrades", () => {
    it("should fetch trades", async () => {
      const mockTrades = [
        {
          id: "trade-1",
          symbol: "BTC-USDT",
          side: "LONG",
          entryPrice: 100000,
          exitPrice: 101000,
          pnlUsdt: 100,
          openedAt: "2026-05-03T16:00:00.000Z",
          closedAt: "2026-05-03T17:00:00.000Z"
        }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockTrades })
      });

      const result = await apiClient.getTrades();

      expect(result).toEqual(mockTrades);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/trades`);
    });
  });

  describe("getSignals", () => {
    it("should fetch trading signals", async () => {
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

      const result = await apiClient.getSignals();

      expect(result).toEqual(mockSignals);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/signals`);
    });
  });
});

describe("formatApiError", () => {
  it("should format Error objects", () => {
    const error = new Error("API request failed");
    expect(formatApiError(error)).toBe("Error: API request failed");
  });

  it("should format unknown errors", () => {
    expect(formatApiError("string error")).toBe("Unknown error: string error");
    expect(formatApiError(null)).toBe("Unknown error: null");
  });
});
