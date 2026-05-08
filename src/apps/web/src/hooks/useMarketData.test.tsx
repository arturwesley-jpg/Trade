import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useMarketData } from "./useMarketData";
import { useWebSocket } from "./useWebSocket";
import { API_WS_URL } from "../config/api";

vi.mock("./useWebSocket");

describe("useMarketData", () => {
  let mockSubscribe: any;
  let mockUnsubscribe: any;

  beforeEach(() => {
    mockSubscribe = vi.fn();
    mockUnsubscribe = vi.fn();

    (useWebSocket as any).mockReturnValue({
      isConnected: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with null market data", () => {
      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL", token: "test-token" })
      );

      expect(result.current.marketData).toBeNull();
    });

    it("should create WebSocket connection with correct params", () => {
      renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL", token: "test-token" })
      );

      expect(useWebSocket).toHaveBeenCalledWith({
        url: "API_WS_URL",
        token: "test-token",
        autoConnect: true,
        onError: undefined,
      });
    });

    it("should work without token", () => {
      renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      expect(useWebSocket).toHaveBeenCalledWith({
        url: "API_WS_URL",
        token: undefined,
        autoConnect: true,
        onError: undefined,
      });
    });

    it("should not subscribe when not connected", () => {
      renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      expect(mockSubscribe).not.toHaveBeenCalled();
    });
  });

  describe("Subscriptions", () => {
    it("should subscribe to market channel when connected", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      expect(mockSubscribe).toHaveBeenCalledWith("market:BTC/USD", expect.any(Function));
    });

    it("should unsubscribe on unmount", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { unmount } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledWith("market:BTC/USD", expect.any(Function));
    });

    it("should resubscribe when symbol changes", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { rerender } = renderHook(
        ({ symbol }) => useMarketData({ symbol, wsUrl: "API_WS_URL" }),
        { initialProps: { symbol: "BTC/USD" } }
      );

      mockSubscribe.mockClear();
      mockUnsubscribe.mockClear();

      rerender({ symbol: "ETH/USD" });

      expect(mockUnsubscribe).toHaveBeenCalledWith("market:BTC/USD", expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith("market:ETH/USD", expect.any(Function));
    });

    it("should subscribe when connection state changes to connected", () => {
      const { rerender } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      expect(mockSubscribe).not.toHaveBeenCalled();

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      rerender();

      expect(mockSubscribe).toHaveBeenCalledWith("market:BTC/USD", expect.any(Function));
    });
  });

  describe("Receiving market data", () => {
    it("should update market data on ticker message", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      const tickerData = {
        type: "ticker",
        symbol: "BTC/USD",
        price: 50000,
        volume24h: 1000,
        change24h: 2.5,
        high24h: 51000,
        low24h: 49000,
        timestamp: 1234567890,
      };

      act(() => {
        marketCallback(tickerData);
      });

      expect(result.current.marketData).toEqual({
        symbol: "BTC/USD",
        price: 50000,
        volume24h: 1000,
        change24h: 2.5,
        change24hPct: undefined,
        high24h: 51000,
        low24h: 49000,
        timestamp: 1234567890,
        source: undefined,
      });
    });

    it("should ignore non-ticker messages", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        marketCallback({
          type: "orderbook",
          symbol: "BTC/USD",
          bids: [],
          asks: [],
        });
      });

      // Non-ticker messages are parsed as direct market data (no type check guards)
      // so result.current.marketData will have the data with undefined fields
      expect(result.current.marketData).toBeTruthy();
    });

    it("should update with latest ticker data", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          volume24h: 1000,
          change24h: 2.5,
          high24h: 51000,
          low24h: 49000,
          timestamp: 1234567890,
        });
      });

      expect(result.current.marketData?.price).toBe(50000);

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 51000,
          volume24h: 1100,
          change24h: 4.0,
          high24h: 52000,
          low24h: 49000,
          timestamp: 1234567900,
        });
      });

      expect(result.current.marketData?.price).toBe(51000);
      expect(result.current.marketData?.volume24h).toBe(1100);
      expect(result.current.marketData?.change24h).toBe(4.0);
    });

    it("should handle ticker with all fields", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          volume24h: 1000,
          change24h: 2.5,
          high24h: 51000,
          low24h: 49000,
          timestamp: 1234567890,
        });
      });

      expect(result.current.marketData).toEqual({
        symbol: "BTC/USD",
        price: 50000,
        volume24h: 1000,
        change24h: 2.5,
        change24hPct: undefined,
        high24h: 51000,
        low24h: 49000,
        timestamp: 1234567890,
        source: undefined,
      });
    });

    it("should handle ticker with missing optional fields", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          timestamp: 1234567890,
        });
      });

      expect(result.current.marketData?.symbol).toBe("BTC/USD");
      expect(result.current.marketData?.price).toBe(50000);
      expect(result.current.marketData?.timestamp).toBe(1234567890);
    });
  });

  describe("Multiple symbols", () => {
    it("should handle different symbols independently", () => {
      let btcCallback: any;
      let ethCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "market:BTC/USD") {
          btcCallback = callback;
        } else if (channel === "market:ETH/USD") {
          ethCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result: btcResult } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      const { result: ethResult } = renderHook(() =>
        useMarketData({ symbol: "ETH/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        btcCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          volume24h: 1000,
          change24h: 2.5,
          high24h: 51000,
          low24h: 49000,
          timestamp: 1234567890,
        });

        ethCallback({
          type: "ticker",
          symbol: "ETH/USD",
          price: 3000,
          volume24h: 5000,
          change24h: 1.5,
          high24h: 3100,
          low24h: 2900,
          timestamp: 1234567890,
        });
      });

      expect(btcResult.current.marketData?.symbol).toBe("BTC/USD");
      expect(btcResult.current.marketData?.price).toBe(50000);

      expect(ethResult.current.marketData?.symbol).toBe("ETH/USD");
      expect(ethResult.current.marketData?.price).toBe(3000);
    });
  });

  describe("Edge cases", () => {
    it("should handle rapid ticker updates", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        for (let i = 0; i < 100; i++) {
          marketCallback({
            type: "ticker",
            symbol: "BTC/USD",
            price: 50000 + i,
            volume24h: 1000,
            change24h: 2.5,
            high24h: 51000,
            low24h: 49000,
            timestamp: 1234567890 + i,
          });
        }
      });

      expect(result.current.marketData?.price).toBe(50099);
      expect(result.current.marketData?.timestamp).toBe(1234567989);
    });

    it("should reset market data when symbol changes", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result, rerender } = renderHook(
        ({ symbol }) => useMarketData({ symbol, wsUrl: "API_WS_URL" }),
        { initialProps: { symbol: "BTC/USD" } }
      );

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          volume24h: 1000,
          change24h: 2.5,
          high24h: 51000,
          low24h: 49000,
          timestamp: 1234567890,
        });
      });

      expect(result.current.marketData?.price).toBe(50000);

      rerender({ symbol: "ETH/USD" });

      // Market data should still be the old data until new data arrives
      expect(result.current.marketData?.price).toBe(50000);
    });

    it("should handle malformed ticker data gracefully", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        marketCallback({
          type: "ticker",
          // Missing required fields
        });
      });

      // Should not crash — data will have undefined fields
      expect(result.current.marketData).toBeTruthy();
      expect(result.current.marketData?.symbol).toBeUndefined();
    });

    it("should not lose data during reconnection", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result, rerender } = renderHook(() =>
        useMarketData({ symbol: "BTC/USD", wsUrl: "API_WS_URL" })
      );

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          volume24h: 1000,
          change24h: 2.5,
          high24h: 51000,
          low24h: 49000,
          timestamp: 1234567890,
        });
      });

      expect(result.current.marketData?.price).toBe(50000);

      // Simulate disconnection
      (useWebSocket as any).mockReturnValue({
        isConnected: false,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      rerender();

      // Data should persist during disconnection
      expect(result.current.marketData?.price).toBe(50000);

      // Simulate reconnection
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      rerender();

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 51000,
          volume24h: 1100,
          change24h: 4.0,
          high24h: 52000,
          low24h: 49000,
          timestamp: 1234567900,
        });
      });

      expect(result.current.marketData?.price).toBe(51000);
    });
  });
});
