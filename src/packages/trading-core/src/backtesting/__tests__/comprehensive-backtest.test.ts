/**
 * Backtesting Tests
 * Tests for the comprehensive backtesting engine
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BacktestEngine } from "../backtest-engine.js";
import { SMACrossoverStrategy } from "../strategies/sma-crossover.js";
import { RSIStrategy } from "../strategies/rsi-strategy.js";
import { MACDStrategy } from "../strategies/macd-strategy.js";
import type { Candle } from "../historical-data-fetcher.js";

describe("Backtesting Engine", () => {
  let candles: Candle[];

  beforeEach(() => {
    // Generate sample candles with uptrend
    candles = [];
    const basePrice = 50000;
    const startTime = Date.now() - 100 * 60 * 60 * 1000; // 100 hours ago

    for (let i = 0; i < 100; i++) {
      const trend = i * 50; // Uptrend
      const volatility = Math.sin(i / 10) * 500;
      const price = basePrice + trend + volatility;

      candles.push({
        timestamp: startTime + i * 60 * 60 * 1000,
        open: price - 100,
        high: price + 200,
        low: price - 200,
        close: price,
        volume: 1000000 + Math.random() * 500000
      });
    }
  });

  describe("SMA Crossover Strategy", () => {
    it("should execute trades on SMA crossovers", async () => {
      const strategy = new SMACrossoverStrategy({
        fastPeriod: 10,
        slowPeriod: 20,
        stopLossPercent: 0.02,
        takeProfitPercent: 0.04
      });

      const engine = new BacktestEngine({
        symbol: "BTC-USDT",
        startDate: new Date(candles[0].timestamp),
        endDate: new Date(candles[candles.length - 1].timestamp),
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        maxLeverage: 1,
        riskPerTrade: 0.02,
        stopLossAtr: 2,
        takeProfitAtr: 3
      });

      const result = await engine.run(candles, strategy);

      expect(result.totalTrades).toBeGreaterThan(0);
      expect(result.finalCapital).toBeGreaterThan(0);
      expect(result.winRate).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeLessThanOrEqual(100);
      expect(result.equityCurve).toHaveLength(candles.length);
    });
  });

  describe("RSI Strategy", () => {
    it("should execute trades on RSI signals", async () => {
      const strategy = new RSIStrategy({
        period: 14,
        oversoldThreshold: 30,
        overboughtThreshold: 70,
        stopLossPercent: 0.03,
        takeProfitPercent: 0.05
      });

      const engine = new BacktestEngine({
        symbol: "BTC-USDT",
        startDate: new Date(candles[0].timestamp),
        endDate: new Date(candles[candles.length - 1].timestamp),
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        maxLeverage: 1,
        riskPerTrade: 0.02,
        stopLossAtr: 2,
        takeProfitAtr: 3
      });

      const result = await engine.run(candles, strategy);

      expect(result).toBeDefined();
      expect(result.totalTrades).toBeGreaterThanOrEqual(0);
      expect(result.profitFactor).toBeGreaterThanOrEqual(0);
    });
  });

  describe("MACD Strategy", () => {
    it("should execute trades on MACD crossovers", async () => {
      const strategy = new MACDStrategy({
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        stopLossPercent: 0.025,
        takeProfitPercent: 0.045
      });

      const engine = new BacktestEngine({
        symbol: "BTC-USDT",
        startDate: new Date(candles[0].timestamp),
        endDate: new Date(candles[candles.length - 1].timestamp),
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        maxLeverage: 1,
        riskPerTrade: 0.02,
        stopLossAtr: 2,
        takeProfitAtr: 3
      });

      const result = await engine.run(candles, strategy);

      expect(result).toBeDefined();
      expect(result.sharpeRatio).toBeDefined();
      expect(result.sortinoRatio).toBeDefined();
      expect(result.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Performance Metrics", () => {
    it("should calculate comprehensive metrics", async () => {
      const strategy = new SMACrossoverStrategy();

      const engine = new BacktestEngine({
        symbol: "BTC-USDT",
        startDate: new Date(candles[0].timestamp),
        endDate: new Date(candles[candles.length - 1].timestamp),
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        maxLeverage: 1,
        riskPerTrade: 0.02,
        stopLossAtr: 2,
        takeProfitAtr: 3
      });

      const result = await engine.run(candles, strategy);

      // Check all required metrics
      expect(result.totalReturn).toBeDefined();
      expect(result.totalReturnPercent).toBeDefined();
      expect(result.winRate).toBeDefined();
      expect(result.profitFactor).toBeDefined();
      expect(result.sharpeRatio).toBeDefined();
      expect(result.sortinoRatio).toBeDefined();
      expect(result.maxDrawdown).toBeDefined();
      expect(result.maxDrawdownPercent).toBeDefined();
      expect(result.avgTradeDuration).toBeDefined();
      expect(result.totalFees).toBeDefined();

      // Check equity curve
      expect(result.equityCurve).toHaveLength(candles.length);
      expect(result.equityCurve[0].equity).toBe(10000);
    });
  });

  describe("Risk Management", () => {
    it("should respect stop loss", async () => {
      // Create candles with sharp drop
      const dropCandles: Candle[] = [];
      const basePrice = 50000;
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        const price = i < 25 ? basePrice : basePrice - (i - 25) * 500; // Sharp drop after 25 candles

        dropCandles.push({
          timestamp: startTime + i * 60 * 60 * 1000,
          open: price,
          high: price + 100,
          low: price - 100,
          close: price,
          volume: 1000000
        });
      }

      const strategy = new SMACrossoverStrategy({
        fastPeriod: 5,
        slowPeriod: 10,
        stopLossPercent: 0.05
      });

      const engine = new BacktestEngine({
        symbol: "BTC-USDT",
        startDate: new Date(dropCandles[0].timestamp),
        endDate: new Date(dropCandles[dropCandles.length - 1].timestamp),
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        maxLeverage: 1,
        riskPerTrade: 0.02,
        stopLossAtr: 2,
        takeProfitAtr: 3
      });

      const result = await engine.run(dropCandles, strategy);

      // Should have some stop loss exits
      const stopLossExits = result.trades.filter(t => t.exitReason === "STOP_LOSS");
      expect(stopLossExits.length).toBeGreaterThan(0);
    });
  });
});
