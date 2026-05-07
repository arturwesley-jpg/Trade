import { describe, it, expect, beforeEach } from "vitest";
import { BacktestEngine, type BacktestConfig, type StrategySignalGenerator } from "./backtest-engine.js";
import type { Candle } from "../intelligence-engines.js";
import type { Signal } from "../signal-generator.js";

describe("BacktestEngine", () => {
  let config: BacktestConfig;
  let mockCandles: Candle[];

  beforeEach(() => {
    config = {
      symbol: "BTC-USDT",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      initialCapital: 10000,
      feeRate: 0.001,
      slippageRate: 0.0005,
      maxLeverage: 3,
      riskPerTrade: 2,
      stopLossAtr: 1.5,
      takeProfitAtr: 2.5
    };

    // Generate mock candles (100 candles with uptrend)
    mockCandles = [];
    const basePrice = 40000;
    const baseTime = new Date("2024-01-01").getTime();

    for (let i = 0; i < 100; i++) {
      const price = basePrice + i * 100; // Uptrend
      const volatility = 200;

      mockCandles.push({
        timestamp: baseTime + i * 3600000, // 1 hour intervals
        open: price,
        high: price + volatility,
        low: price - volatility,
        close: price + 50,
        volume: 1000000
      });
    }
  });

  describe("run", () => {
    it("should execute backtest and return metrics", async () => {
      const engine = new BacktestEngine(config);

      // Simple signal generator that buys on every 10th candle
      const signalGenerator: StrategySignalGenerator = {
        generateSignal: (candles: Candle[], currentPrice: number) => {
          const shouldBuy = candles.length % 10 === 0;

          if (!shouldBuy) {
            return {
              signal: "WAIT",
              confidence: 0,
              shouldExecute: false,
              reasoning: "Waiting"
            };
          }

          return {
            signal: "LONG",
            confidence: 0.7,
            shouldExecute: true,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 0.95,
            takeProfit: currentPrice * 1.10,
            reasoning: "Test signal"
          };
        }
      };

      const metrics = await engine.run(mockCandles, signalGenerator);

      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBeGreaterThan(0);
      expect(metrics.finalCapital).toBeGreaterThan(0);
      expect(metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeLessThanOrEqual(100);
      expect(metrics.totalReturnPct).toBeDefined();
      expect(metrics.maxDrawdownPct).toBeGreaterThanOrEqual(0);
      expect(metrics.trades).toHaveLength(metrics.totalTrades);
    });

    it("should apply fees correctly", async () => {
      const engine = new BacktestEngine(config);

      const signalGenerator: StrategySignalGenerator = {
        generateSignal: (candles: Candle[], currentPrice: number) => {
          if (candles.length !== 60) return null;

          return {
            signal: "LONG",
            confidence: 0.7,
            shouldExecute: true,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 0.95,
            takeProfit: currentPrice * 1.05,
            reasoning: "Test"
          };
        }
      };

      const metrics = await engine.run(mockCandles, signalGenerator);

      expect(metrics.totalFees).toBeGreaterThan(0);
      expect(metrics.trades.every(t => t.fees > 0)).toBe(true);
    });

    it("should handle stop loss correctly", async () => {
      // Create candles with downtrend
      const downCandles: Candle[] = [];
      const basePrice = 40000;
      const baseTime = new Date("2024-01-01").getTime();

      for (let i = 0; i < 100; i++) {
        const price = basePrice - i * 50; // Gradual downtrend

        downCandles.push({
          timestamp: baseTime + i * 3600000,
          open: price,
          high: price + 50,
          low: price - 200, // Lower lows to trigger stop loss
          close: price - 100,
          volume: 1000000
        });
      }

      const engine = new BacktestEngine(config);

      const signalGenerator: StrategySignalGenerator = {
        generateSignal: (candles: Candle[], currentPrice: number) => {
          // Only generate signal once at candle 60
          if (candles.length !== 60) return null;

          return {
            signal: "LONG",
            confidence: 0.7,
            shouldExecute: true,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 0.97, // 3% stop loss - will be hit
            takeProfit: currentPrice * 1.10,
            reasoning: "Test"
          };
        }
      };

      const metrics = await engine.run(downCandles, signalGenerator);

      expect(metrics.totalTrades).toBeGreaterThan(0);

      // In a downtrend with tight stop loss, we should hit stop loss
      if (metrics.totalTrades > 0) {
        const stopLossTrades = metrics.trades.filter(t => t.exitReason === "STOP_LOSS");
        expect(stopLossTrades.length).toBeGreaterThan(0);
      }
    });

    it("should handle SHORT positions", async () => {
      const engine = new BacktestEngine(config);

      const signalGenerator: StrategySignalGenerator = {
        generateSignal: (candles: Candle[], currentPrice: number) => {
          if (candles.length !== 60) return null;

          return {
            signal: "SHORT",
            confidence: 0.7,
            shouldExecute: true,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 1.05,
            takeProfit: currentPrice * 0.95,
            reasoning: "Test short"
          };
        }
      };

      const metrics = await engine.run(mockCandles, signalGenerator);

      expect(metrics.totalTrades).toBeGreaterThan(0);
      const shortTrades = metrics.trades.filter(t => t.side === "SHORT");
      expect(shortTrades.length).toBeGreaterThan(0);
    });

    it("should track drawdown correctly", async () => {
      const engine = new BacktestEngine(config);

      const signalGenerator: StrategySignalGenerator = {
        generateSignal: (candles: Candle[], currentPrice: number) => {
          if (candles.length % 10 !== 0) return null;

          return {
            signal: "LONG",
            confidence: 0.6,
            shouldExecute: true,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 0.90,
            takeProfit: currentPrice * 1.10,
            reasoning: "Test"
          };
        }
      };

      const metrics = await engine.run(mockCandles, signalGenerator);

      expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(metrics.maxDrawdownPct).toBeGreaterThanOrEqual(0);
      expect(metrics.maxDrawdownPct).toBeLessThanOrEqual(100);
    });

    it("should calculate Sharpe ratio", async () => {
      const engine = new BacktestEngine(config);

      const signalGenerator: StrategySignalGenerator = {
        generateSignal: (candles: Candle[], currentPrice: number) => {
          if (candles.length % 10 !== 0) return null;

          return {
            signal: "LONG",
            confidence: 0.7,
            shouldExecute: true,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 0.95,
            takeProfit: currentPrice * 1.05,
            reasoning: "Test"
          };
        }
      };

      const metrics = await engine.run(mockCandles, signalGenerator);

      expect(metrics.sharpeRatio).toBeDefined();
      expect(typeof metrics.sharpeRatio).toBe("number");
      expect(isFinite(metrics.sharpeRatio)).toBe(true);
    });
  });
});
