import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { TradingProvider, useTrading } from "./TradingContext.js";
import * as api from "../api.js";

// Mock API functions
vi.mock("../api.js", () => ({
  getMetrics: vi.fn(),
  getBacktests: vi.fn(),
  createBacktest: vi.fn()
}));

describe("TradingContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide initial state", () => {
    const { result } = renderHook(() => useTrading(), {
      wrapper: TradingProvider
    });

    expect(result.current.candles).toEqual([]);
    expect(result.current.metrics).toBeNull();
    expect(result.current.backtests).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should load metrics successfully", async () => {
    const mockMetrics = {
      totalReturn: 1500,
      winRate: 0.65,
      sharpeRatio: 1.8,
      maxDrawdown: -0.15,
      totalTrades: 100,
      profitFactor: 2.5,
      avgWin: 150,
      avgLoss: -80,
      largestWin: 500,
      largestLoss: -200
    };

    vi.mocked(api.getMetrics).mockResolvedValue(mockMetrics);

    const { result } = renderHook(() => useTrading(), {
      wrapper: TradingProvider
    });

    await act(async () => {
      await result.current.refreshMetrics();
    });

    await waitFor(() => {
      expect(result.current.metrics).toEqual(mockMetrics);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it("should handle metrics loading error", async () => {
    const errorMessage = "Failed to fetch metrics";
    vi.mocked(api.getMetrics).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTrading(), {
      wrapper: TradingProvider
    });

    await act(async () => {
      await result.current.refreshMetrics();
    });

    await waitFor(() => {
      expect(result.current.metrics).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  it("should load backtests successfully", async () => {
    const mockBacktests = [
      {
        id: 1,
        name: "Test Backtest",
        description: "Test description",
        symbol: "BTCUSDT",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        status: "completed",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        userId: 1
      }
    ];

    vi.mocked(api.getBacktests).mockResolvedValue(mockBacktests);

    const { result } = renderHook(() => useTrading(), {
      wrapper: TradingProvider
    });

    await act(async () => {
      await result.current.loadBacktests();
    });

    await waitFor(() => {
      expect(result.current.backtests).toEqual(mockBacktests);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it("should create backtest successfully", async () => {
    const newBacktest = {
      id: 2,
      name: "New Backtest",
      description: "New test",
      symbol: "ETHUSDT",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      interval: "4h",
      initialCapital: 5000,
      feeRate: 0.001,
      slippageRate: 0.0005,
      status: "pending",
      createdAt: "2024-01-02T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
      userId: 1
    };

    const params = {
      name: "New Backtest",
      description: "New test",
      symbol: "ETHUSDT",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      interval: "4h",
      initialCapital: 5000,
      feeRate: 0.001,
      slippageRate: 0.0005,
      strategyName: "RSI Strategy",
      strategyDescription: "",
      strategyParameters: {}
    };

    vi.mocked(api.createBacktest).mockResolvedValue(newBacktest);
    vi.mocked(api.getBacktests).mockResolvedValue([newBacktest]);

    const { result } = renderHook(() => useTrading(), {
      wrapper: TradingProvider
    });

    await act(async () => {
      await result.current.createBacktest(params);
    });

    await waitFor(() => {
      expect(result.current.backtests).toContainEqual(newBacktest);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it("should add candle to state", () => {
    const { result } = renderHook(() => useTrading(), {
      wrapper: TradingProvider
    });

    const candle = {
      symbol: "BTCUSDT",
      interval: "1h",
      timestamp: "2024-01-01T00:00:00Z",
      open: 50000,
      high: 51000,
      low: 49000,
      close: 50500,
      volume: 1000
    };

    act(() => {
      result.current.addCandle(candle);
    });

    expect(result.current.candles).toHaveLength(1);
    expect(result.current.candles[0]).toEqual(candle);
  });

  it("should limit candles to 1000", () => {
    const { result } = renderHook(() => useTrading(), {
      wrapper: TradingProvider
    });

    // Add 1100 candles
    act(() => {
      for (let i = 0; i < 1100; i++) {
        result.current.addCandle({
          symbol: "BTCUSDT",
          interval: "1h",
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          open: 50000,
          high: 51000,
          low: 49000,
          close: 50500,
          volume: 1000
        });
      }
    });

    // Should only keep the last 1000
    expect(result.current.candles).toHaveLength(1000);
  });

  it("should throw error when useTrading is used outside provider", () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTrading());
    }).toThrow("useTrading must be used within a TradingProvider");

    consoleError.mockRestore();
  });
});
