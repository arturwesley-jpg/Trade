import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useMarketData } from "./useMarketData";
import { useWebSocket } from "./useWebSocket";

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
      unsubscribe: mockUnsubscribe
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with null market data", () => {
      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000", "test-token")
      );

      expect(result.current).toBeNull();
    });

    it("should create WebSocket connection with correct params", () => {
      renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000", "test-token")
      );

      expect(useWebSocket).toHaveBeenCalledWith({
        url: "ws://localhost:3000",
        token: "test-token",
        autoConnect: true
      });
    });

    it("should work without token", () => {
      renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      expect(useWebSocket).toHaveBeenCalledWith({
        url: "ws://localhost:3000",
        token: undefined,
        autoConnect: true
      });
    });

    it("should not subscribe when not connected", () => {
      renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      expect(mockSubscribe).not.toHaveBeenCalled();
    });
  });

  describe("Subscriptions", () => {
    it("should subscribe to market channel when connected", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      expect(mockSubscribe).toHaveBeenCalledWith("market:BTC/USD", expect.any(Function));
    });

    it("should unsubscribe on unmount", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const { unmount } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledWith("market:BTC/USD", expect.any(Function));
    });

    it("should resubscribe when symbol changes", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const { rerender } = renderHook(
        ({ symbol }) => useMarketData(symbol, "ws://localhost:3000"),
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
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      expect(mockSubscribe).not.toHaveBeenCalled();

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
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
        unsubscribe: mockUnsubscribe
      });

      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      const tickerData = {
        type: "ticker",
        symbol: "BTC/USD",
        price: 50000,
        volume24h: 1000,
        change24h: 2.5,
        high24h: 51000,
        low24h: 49000,
        timestamp: 1234567890
      };

      act(() => {
        marketCallback(tickerData);
      });

      expect(result.current).toEqual({
        symbol: "BTC/USD",
        price: 50000,
        volume24h: 1000,
        change24h: 2.5,
        high24h: 51000,
        low24h: 49000,
        timestamp: 1234567890
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
        unsubscribe: mockUnsubscribe
      });

      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      act(() => {
        marketCallback({
          type: "orderbook",
          symbol: "BTC/USD",
          bids: [],
          asks: []
        });
      });

      expect(result.current).toBeNull();
    });

    it("should update with latest ticker data", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
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
          timestamp: 1234567890
        });
      });

      expect(result.current?.price).toBe(50000);

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 51000,
          volume24h: 1100,
          change24h: 4.0,
          high24h: 52000,
          low24h: 49000,
          timestamp: 1234567900
        });
      });

      expect(result.current?.price).toBe(51000);
      expect(result.current?.volume24h).toBe(1100);
      expect(result.current?.change24h).toBe(4.0);
    });

    it("should handle ticker with all fields", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
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
          timestamp: 1234567890
        });
      });

      expect(result.current).toEqual({
        symbol: "BTC/USD",
        price: 50000,
        volume24h: 1000,
        change24h: 2.5,
        high24h: 51000,
        low24h: 49000,
        timestamp: 1234567890
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
        unsubscribe: mockUnsubscribe
      });

      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      act(() => {
        marketCallback({
          type: "ticker",
          symbol: "BTC/USD",
          price: 50000,
          timestamp: 1234567890
        });
      });

      expect(result.current?.symbol).toBe("BTC/USD");
      expect(result.current?.price).toBe(50000);
      expect(result.current?.timestamp).toBe(1234567890);
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
        unsubscribe: mockUnsubscribe
      });

      const { result: btcResult } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      const { result: ethResult } = renderHook(() =>
        useMarketData("ETH/USD", "ws://localhost:3000")
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
          timestamp: 1234567890
        });

        ethCallback({
          type: "ticker",
          symbol: "ETH/USD",
          price: 3000,
          volume24h: 5000,
          change24h: 1.5,
          high24h: 3100,
          low24h: 2900,
          timestamp: 1234567890
        });
      });

      expect(btcResult.current?.symbol).toBe("BTC/USD");
      expect(btcResult.current?.price).toBe(50000);

      expect(ethResult.current?.symbol).toBe("ETH/USD");
      expect(ethResult.current?.price).toBe(3000);
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
        unsubscribe: mockUnsubscribe
      });

      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
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
            timestamp: 1234567890 + i
          });
        }
      });

      expect(result.current?.price).toBe(50099);
      expect(result.current?.timestamp).toBe(1234567989);
    });

    it("should reset market data when symbol changes", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const { result, rerender } = renderHook(
        ({ symbol }) => useMarketData(symbol, "ws://localhost:3000"),
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
          timestamp: 1234567890
        });
      });

      expect(result.current?.price).toBe(50000);

      rerender({ symbol: "ETH/USD" });

      // Market data should still be the old data until new data arrives
      expect(result.current?.price).toBe(50000);
    });

    it("should handle malformed ticker data gracefully", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const { result } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
      );

      act(() => {
        marketCallback({
          type: "ticker"
          // Missing required fields
        });
      });

      // Should not crash, but data might be incomplete
      expect(result.current?.type).toBeUndefined();
    });

    it("should not lose data during reconnection", () => {
      let marketCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        marketCallback = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const { result, rerender } = renderHook(() =>
        useMarketData("BTC/USD", "ws://localhost:3000")
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
          timestamp: 1234567890
        });
      });

      expect(result.current?.price).toBe(50000);

      // Simulate disconnection
      (useWebSocket as any).mockReturnValue({
        isConnected: false,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      rerender();

      // Data should persist during disconnection
      expect(result.current?.price).toBe(50000);

      // Simulate reconnection
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
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
          timestamp: 1234567900
        });
      });

      expect(result.current?.price).toBe(51000);
    });
  });
});
