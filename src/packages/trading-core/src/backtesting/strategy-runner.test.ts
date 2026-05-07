import { describe, it, expect } from "vitest";
import { StrategyRunner, type StrategyConfig } from "./strategy-runner-new.js";
import { HistoricalDataFetcher } from "./historical-data-fetcher.js";
import type { Candle } from "../intelligence-engines.js";

describe("StrategyRunner", () => {
  // Mock historical data fetcher
  class MockHistoricalDataFetcher extends HistoricalDataFetcher {
    async fetchHistoricalCandles(): Promise<Candle[]> {
      const candles: Candle[] = [];
      const basePrice = 40000;
      const baseTime = new Date("2024-01-01").getTime();

      for (let i = 0; i < 100; i++) {
        const price = basePrice + i * 100;
        candles.push({
          timestamp: baseTime + i * 3600000,
          open: price,
          high: price + 200,
          low: price - 200,
          close: price + 50,
          volume: 1000000
        });
      }

      return candles;
    }
  }

  describe("runSingleStrategy", () => {
    it("should run a single strategy and return results", async () => {
      const strategy: StrategyConfig = {
        name: "Test Strategy",
        description: "Test",
        parameters: {
          minConfidence: 0.6,
          maxLeverage: 3,
          riskPerTrade: 2
        }
      };

      const runner = new StrategyRunner({
        symbol: "BTC-USDT",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        strategies: [strategy],
        historicalDataFetcher: new MockHistoricalDataFetcher()
      });

      const result = await runner.runSingleStrategy(strategy);

      expect(result).toBeDefined();
      expect(result.strategyName).toBe("Test Strategy");
      expect(result.metrics).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });
  });

  describe("runMultipleStrategies", () => {
    it("should run multiple strategies and return sorted results", async () => {
      const strategies: StrategyConfig[] = [
        {
          name: "Conservative",
          description: "Low risk",
          parameters: {
            minConfidence: 0.7,
            maxLeverage: 2,
            riskPerTrade: 1
          }
        },
        {
          name: "Aggressive",
          description: "High risk",
          parameters: {
            minConfidence: 0.5,
            maxLeverage: 5,
            riskPerTrade: 3
          }
        }
      ];

      const runner = new StrategyRunner({
        symbol: "BTC-USDT",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        strategies,
        historicalDataFetcher: new MockHistoricalDataFetcher()
      });

      const results = await runner.runMultipleStrategies();

      expect(results).toHaveLength(2);
      expect(results[0].strategyName).toBeDefined();
      expect(results[1].strategyName).toBeDefined();

      // Results should be sorted by total return
      if (results.length > 1) {
        expect(results[0].metrics.totalReturnPct).toBeGreaterThanOrEqual(
          results[1].metrics.totalReturnPct
        );
      }
    });
  });

  describe("runParallel", () => {
    it("should run strategies in parallel", async () => {
      const strategies: StrategyConfig[] = [
        {
          name: "Strategy 1",
          description: "Test 1",
          parameters: { minConfidence: 0.6 }
        },
        {
          name: "Strategy 2",
          description: "Test 2",
          parameters: { minConfidence: 0.7 }
        },
        {
          name: "Strategy 3",
          description: "Test 3",
          parameters: { minConfidence: 0.8 }
        }
      ];

      const runner = new StrategyRunner({
        symbol: "BTC-USDT",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        strategies,
        historicalDataFetcher: new MockHistoricalDataFetcher()
      });

      const startTime = Date.now();
      const results = await runner.runParallel();
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results[0].strategyName).toBeDefined();

      // Parallel execution should be faster than sequential
      // (though this is hard to test reliably in unit tests)
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe("optimizeStrategy", () => {
    it("should optimize strategy parameters", async () => {
      const baseStrategy: StrategyConfig = {
        name: "Base Strategy",
        description: "To be optimized",
        parameters: {
          minConfidence: 0.6,
          maxLeverage: 3,
          riskPerTrade: 2
        }
      };

      const runner = new StrategyRunner({
        symbol: "BTC-USDT",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        strategies: [baseStrategy],
        historicalDataFetcher: new MockHistoricalDataFetcher()
      });

      const optimizationResult = await runner.optimizeStrategy(baseStrategy, {
        parameterRanges: {
          minConfidence: [0.5, 0.6, 0.7],
          maxLeverage: [2, 3],
          riskPerTrade: [1, 2]
        },
        optimizationMetric: "totalReturn"
      });

      expect(optimizationResult).toBeDefined();
      expect(optimizationResult.bestParameters).toBeDefined();
      expect(optimizationResult.bestMetrics).toBeDefined();
      expect(optimizationResult.allResults).toHaveLength(3 * 2 * 2); // 12 combinations

      // Best result should be first
      expect(optimizationResult.bestMetrics.totalReturnPct).toBeGreaterThanOrEqual(
        optimizationResult.allResults[optimizationResult.allResults.length - 1].metrics.totalReturnPct
      );
    });

    it("should optimize for different metrics", async () => {
      const baseStrategy: StrategyConfig = {
        name: "Base Strategy",
        description: "Test",
        parameters: {}
      };

      const runner = new StrategyRunner({
        symbol: "BTC-USDT",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        strategies: [baseStrategy],
        historicalDataFetcher: new MockHistoricalDataFetcher()
      });

      const metrics = ["totalReturn", "sharpeRatio", "winRate", "profitFactor"] as const;

      for (const metric of metrics) {
        const result = await runner.optimizeStrategy(baseStrategy, {
          parameterRanges: {
            minConfidence: [0.5, 0.7]
          },
          optimizationMetric: metric
        });

        expect(result.bestParameters).toBeDefined();
        expect(result.bestMetrics).toBeDefined();
      }
    });
  });
});
