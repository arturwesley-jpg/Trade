import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MarketStreamService } from "./market-stream";
import { TradingWebSocketServer } from "../websocket";

describe("MarketStreamService", () => {
  let service: MarketStreamService;
  let mockWsServer: any;
  let mockExchange: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockWsServer = {
      broadcastToChannel: vi.fn()
    };

    mockExchange = {
      fetchTicker: vi.fn()
    };

    service = new MarketStreamService(mockWsServer, mockExchange);
  });

  afterEach(() => {
    service.stopAll();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("startStreaming", () => {
    it("should start streaming market data for symbol", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");

      expect(service.getActiveStreams()).toContain("BTC/USD");
    });

    it("should broadcast ticker data at interval", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");

      // Wait for first tick
      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "market:BTC/USD",
        expect.objectContaining({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          volume24h: 1000
        })
      );
    });

    it("should not start duplicate streams for same symbol", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("BTC/USD");

      const activeStreams = service.getActiveStreams();
      expect(activeStreams.filter(s => s === "BTC/USD").length).toBe(1);
    });

    it("should handle multiple symbols independently", async () => {
      mockExchange.fetchTicker
        .mockResolvedValueOnce({
          symbol: "BTC/USD",
          last: 50000,
          volume: 1000,
          percentage: 2.5,
          high: 51000,
          low: 49000,
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          symbol: "ETH/USD",
          last: 3000,
          volume: 5000,
          percentage: 1.5,
          high: 3100,
          low: 2900,
          timestamp: Date.now()
        });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("ETH/USD");

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "market:BTC/USD",
        expect.any(Object)
      );
      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "market:ETH/USD",
        expect.any(Object)
      );
    });

    it("should handle exchange errors gracefully", async () => {
      mockExchange.fetchTicker.mockRejectedValue(new Error("Exchange error"));

      await service.startStreaming("BTC/USD");

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      // Should not crash, stream should continue
      expect(service.getActiveStreams()).toContain("BTC/USD");
    });

    it("should continue streaming after error", async () => {
      mockExchange.fetchTicker
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce({
          symbol: "BTC/USD",
          last: 50000,
          volume: 1000,
          percentage: 2.5,
          high: 51000,
          low: 49000,
          timestamp: Date.now()
        });

      await service.startStreaming("BTC/USD");

      // First tick - error
      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      // Second tick - success
      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "market:BTC/USD",
        expect.objectContaining({
          type: "ticker",
          price: 50000
        })
      );
    });
  });

  describe("stopStreaming", () => {
    it("should stop streaming for specific symbol", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      service.stopStreaming("BTC/USD");

      expect(service.getActiveStreams()).not.toContain("BTC/USD");
    });

    it("should not affect other streams", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("ETH/USD");

      service.stopStreaming("BTC/USD");

      expect(service.getActiveStreams()).not.toContain("BTC/USD");
      expect(service.getActiveStreams()).toContain("ETH/USD");
    });

    it("should handle stopping non-existent stream", () => {
      expect(() => {
        service.stopStreaming("NONEXISTENT/USD");
      }).not.toThrow();
    });

    it("should stop broadcasting after stream stopped", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      const callCountBefore = mockWsServer.broadcastToChannel.mock.calls.length;

      service.stopStreaming("BTC/USD");

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      const callCountAfter = mockWsServer.broadcastToChannel.mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
    });
  });

  describe("stopAll", () => {
    it("should stop all active streams", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("ETH/USD");
      await service.startStreaming("SOL/USD");

      service.stopAll();

      expect(service.getActiveStreams()).toHaveLength(0);
    });

    it("should stop all broadcasting", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("ETH/USD");

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      const callCountBefore = mockWsServer.broadcastToChannel.mock.calls.length;

      service.stopAll();

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      const callCountAfter = mockWsServer.broadcastToChannel.mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
    });
  });

  describe("getActiveStreams", () => {
    it("should return empty array when no streams active", () => {
      expect(service.getActiveStreams()).toEqual([]);
    });

    it("should return all active stream symbols", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("ETH/USD");
      await service.startStreaming("SOL/USD");

      const activeStreams = service.getActiveStreams();

      expect(activeStreams).toHaveLength(3);
      expect(activeStreams).toContain("BTC/USD");
      expect(activeStreams).toContain("ETH/USD");
      expect(activeStreams).toContain("SOL/USD");
    });

    it("should update after stopping streams", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("ETH/USD");

      expect(service.getActiveStreams()).toHaveLength(2);

      service.stopStreaming("BTC/USD");

      expect(service.getActiveStreams()).toHaveLength(1);
      expect(service.getActiveStreams()).toContain("ETH/USD");
    });
  });

  describe("Data transformation", () => {
    it("should transform exchange ticker to WebSocket format", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: 1234567890
      });

      await service.startStreaming("BTC/USD");

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "market:BTC/USD",
        {
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          volume24h: 1000,
          change24h: 2.5,
          high24h: 51000,
          low24h: 49000,
          timestamp: 1234567890
        }
      );
    });

    it("should handle missing optional fields", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "market:BTC/USD",
        expect.objectContaining({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000
        })
      );
    });
  });

  describe("Performance", () => {
    it("should handle high-frequency updates", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");

      // Simulate 10 seconds of updates
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      }

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledTimes(10);
    });

    it("should handle multiple symbols with high frequency", async () => {
      mockExchange.fetchTicker.mockResolvedValue({
        symbol: "BTC/USD",
        last: 50000,
        volume: 1000,
        percentage: 2.5,
        high: 51000,
        low: 49000,
        timestamp: Date.now()
      });

      await service.startStreaming("BTC/USD");
      await service.startStreaming("ETH/USD");
      await service.startStreaming("SOL/USD");

      // Simulate 5 seconds
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      }

      // 3 symbols * 5 ticks = 15 broadcasts
      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledTimes(15);
    });
  });
});
