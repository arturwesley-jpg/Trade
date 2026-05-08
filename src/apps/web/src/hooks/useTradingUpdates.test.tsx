import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTradingUpdates } from "./useTradingUpdates";
import { useWebSocket } from "./useWebSocket";
import { API_WS_URL } from "../config/api";

vi.mock("./useWebSocket");

describe("useTradingUpdates", () => {
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
    it("should initialize with empty updates", () => {
      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      expect(result.current.updates).toEqual([]);
    });

    it("should create WebSocket connection with correct params", () => {
      renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      expect(useWebSocket).toHaveBeenCalledWith({
        url: "API_WS_URL",
        token: "test-token",
        autoConnect: true,
        onError: undefined,
      });
    });

    it("should not subscribe when not connected", () => {
      renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      expect(mockSubscribe).not.toHaveBeenCalled();
    });
  });

  describe("Subscriptions", () => {
    it("should subscribe to all trading channels when connected", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      expect(mockSubscribe).toHaveBeenCalledWith("trades:user123", expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith("positions:user123", expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith("portfolio:user123", expect.any(Function));
    });

    it("should unsubscribe from all channels on unmount", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { unmount } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledWith("trades:user123", expect.any(Function));
      expect(mockUnsubscribe).toHaveBeenCalledWith("positions:user123", expect.any(Function));
      expect(mockUnsubscribe).toHaveBeenCalledWith("portfolio:user123", expect.any(Function));
    });

    it("should resubscribe when userId changes", () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { rerender } = renderHook(
        ({ userId }) => useTradingUpdates({ userId, wsUrl: "API_WS_URL", token: "test-token" }),
        { initialProps: { userId: "user123" } }
      );

      mockSubscribe.mockClear();
      mockUnsubscribe.mockClear();

      rerender({ userId: "user456" });

      expect(mockUnsubscribe).toHaveBeenCalledWith("trades:user123", expect.any(Function));
      expect(mockUnsubscribe).toHaveBeenCalledWith("positions:user123", expect.any(Function));
      expect(mockUnsubscribe).toHaveBeenCalledWith("portfolio:user123", expect.any(Function));

      expect(mockSubscribe).toHaveBeenCalledWith("trades:user456", expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith("positions:user456", expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith("portfolio:user456", expect.any(Function));
    });

    it("should subscribe when connection state changes to connected", () => {
      const { rerender } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      expect(mockSubscribe).not.toHaveBeenCalled();

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      rerender();

      expect(mockSubscribe).toHaveBeenCalledWith("trades:user123", expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith("positions:user123", expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith("portfolio:user123", expect.any(Function));
    });
  });

  describe("Receiving updates", () => {
    it("should add trade executed update", () => {
      let tradeCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "trades:user123") {
          tradeCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      const tradeUpdate = {
        type: "trade_executed",
        data: {
          trade: {
            id: "trade-1",
            symbol: "BTC/USD",
            side: "buy",
            price: 50000,
            quantity: 0.5,
          },
        },
      };

      act(() => {
        tradeCallback(tradeUpdate);
      });

      expect(result.current.updates).toHaveLength(1);
      expect(result.current.updates[0].type).toBe("trade_executed");
    });

    it("should add position opened update", () => {
      let positionCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "positions:user123") {
          positionCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      const positionUpdate = {
        type: "position_update",
        data: {
          status: "OPEN",
          position: {
            id: "pos-1",
            symbol: "BTC/USD",
            side: "long",
            entryPrice: 50000,
            quantity: 0.5,
          },
        },
      };

      act(() => {
        positionCallback(positionUpdate);
      });

      expect(result.current.updates).toHaveLength(1);
      expect(result.current.updates[0].type).toBe("position_opened");
    });

    it("should add portfolio update", () => {
      let portfolioCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "portfolio:user123") {
          portfolioCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      const portfolioUpdate = {
        type: "portfolio_updated",
        data: {
          portfolio: {
            totalValue: 100000,
            availableBalance: 50000,
            totalUnrealizedPnl: 1000,
          },
        },
      };

      act(() => {
        portfolioCallback(portfolioUpdate);
      });

      expect(result.current.updates).toHaveLength(1);
      expect(result.current.updates[0].type).toBe("portfolio_updated");
    });

    it("should accumulate multiple updates", () => {
      let tradeCallback: any;
      let positionCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "trades:user123") {
          tradeCallback = callback;
        } else if (channel === "positions:user123") {
          positionCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      act(() => {
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-1" } } });
        positionCallback({ type: "position_update", data: { status: "OPEN", position: { id: "pos-1" } } });
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-2" } } });
      });

      expect(result.current.updates).toHaveLength(3);
      expect(result.current.updates[0].type).toBe("trade_executed");
      expect(result.current.updates[1].type).toBe("position_opened");
      expect(result.current.updates[2].type).toBe("trade_executed");
    });

    it("should maintain update order", () => {
      let callbacks: any = {};

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        callbacks[channel] = callback;
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      act(() => {
        callbacks["trades:user123"]({ type: "trade_executed", data: { trade: { id: "1" } } });
        callbacks["positions:user123"]({ type: "position_update", data: { status: "OPEN", position: { id: "2" } } });
        callbacks["portfolio:user123"]({ type: "portfolio_updated", data: { portfolio: { id: "3" } } });
        callbacks["trades:user123"]({ type: "trade_executed", data: { trade: { id: "4" } } });
      });

      expect(result.current.updates[0].trade?.id).toBe("1");
      expect(result.current.updates[1].position?.id).toBe("2");
      expect(result.current.updates[2].portfolio?.id).toBe("3");
      expect(result.current.updates[3].trade?.id).toBe("4");
    });
  });

  describe("clearUpdates", () => {
    it("should clear all updates", () => {
      let tradeCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "trades:user123") {
          tradeCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      act(() => {
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-1" } } });
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-2" } } });
      });

      expect(result.current.updates).toHaveLength(2);

      act(() => {
        result.current.clearUpdates();
      });

      expect(result.current.updates).toHaveLength(0);
    });

    it("should allow new updates after clearing", () => {
      let tradeCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "trades:user123") {
          tradeCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      act(() => {
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-1" } } });
        result.current.clearUpdates();
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-2" } } });
      });

      expect(result.current.updates).toHaveLength(1);
      expect(result.current.updates[0].trade?.id).toBe("trade-2");
    });
  });

  describe("Edge cases", () => {
    it("should handle updates with missing optional fields", () => {
      let tradeCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "trades:user123") {
          tradeCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      act(() => {
        tradeCallback({ type: "trade_executed", data: {} });
      });

      expect(result.current.updates).toHaveLength(1);
      expect(result.current.updates[0].type).toBe("trade_executed");
    });

    it("should handle rapid updates", () => {
      let tradeCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "trades:user123") {
          tradeCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      act(() => {
        for (let i = 0; i < 100; i++) {
          tradeCallback({ type: "trade_executed", data: { trade: { id: `trade-${i}` } } });
        }
      });

      expect(result.current.updates).toHaveLength(100);
    });

    it("should not lose updates during reconnection", () => {
      let tradeCallback: any;

      mockSubscribe.mockImplementation((channel: string, callback: any) => {
        if (channel === "trades:user123") {
          tradeCallback = callback;
        }
      });

      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      const { result, rerender } = renderHook(() =>
        useTradingUpdates({ userId: "user123", wsUrl: "API_WS_URL", token: "test-token" })
      );

      act(() => {
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-1" } } });
      });

      // Simulate disconnection
      (useWebSocket as any).mockReturnValue({
        isConnected: false,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      rerender();

      // Simulate reconnection
      (useWebSocket as any).mockReturnValue({
        isConnected: true,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        error: null,
      });

      rerender();

      act(() => {
        tradeCallback({ type: "trade_executed", data: { trade: { id: "trade-2" } } });
      });

      expect(result.current.updates).toHaveLength(2);
      expect(result.current.updates[0].trade?.id).toBe("trade-1");
      expect(result.current.updates[1].trade?.id).toBe("trade-2");
    });
  });
});
