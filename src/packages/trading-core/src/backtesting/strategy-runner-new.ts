/**
 * Strategy Runner - New Implementation
 * Runs backtests with multiple strategies and parameter optimization
 */

import type { Candle } from "../intelligence-engines.js";
import { BacktestEngine, type BacktestConfig, type BacktestResult, type StrategySignalGenerator } from "./backtest-engine.js";
import type { HistoricalDataFetcher } from "./historical-data-fetcher.js";

export interface StrategyConfig {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface StrategyRunnerConfig {
  symbol: string;
  startDate: Date;
  endDate: Date;
  interval: string;
  initialCapital: number;
  feeRate: number;
  slippageRate: number;
  strategies: StrategyConfig[];
  historicalDataFetcher: HistoricalDataFetcher;
}

export interface StrategyResult {
  strategyName: string;
  strategyDescription: string;
  parameters: Record<string, any>;
  metrics: BacktestResult;
  executionTimeMs: number;
}

export interface OptimizationOptions {
  parameterRanges: Record<string, any[]>;
  optimizationMetric: "totalReturn" | "sharpeRatio" | "winRate" | "profitFactor";
}

export interface OptimizationResult {
  bestParameters: Record<string, any>;
  bestMetrics: BacktestResult;
  allResults: StrategyResult[];
}

export class StrategyRunner {
  private candles: Candle[] | null = null;

  constructor(private readonly config: StrategyRunnerConfig) {}

  /**
   * Run a single strategy
   */
  async runSingleStrategy(strategy: StrategyConfig): Promise<StrategyResult> {
    const startTime = Date.now();

    // Fetch historical data if not cached
    if (!this.candles) {
      this.candles = await this.config.historicalDataFetcher.fetchHistoricalCandles(
        this.config.symbol,
        this.config.interval,
        this.config.startDate,
        this.config.endDate
      );
    }

    // Create strategy signal generator
    const signalGenerator = this.createSignalGenerator(strategy);

    // Run backtest
    const backtestConfig: BacktestConfig = {
      symbol: this.config.symbol,
      startDate: this.config.startDate,
      endDate: this.config.endDate,
      initialCapital: this.config.initialCapital,
      feeRate: this.config.feeRate,
      slippageRate: this.config.slippageRate,
      maxLeverage: strategy.parameters.maxLeverage || 1,
      riskPerTrade: strategy.parameters.riskPerTrade || 1,
      stopLossAtr: strategy.parameters.stopLossAtr || 2,
      takeProfitAtr: strategy.parameters.takeProfitAtr || 3
    };

    const engine = new BacktestEngine(backtestConfig);
    const metrics = await engine.run(this.candles, signalGenerator);

    const executionTimeMs = Date.now() - startTime;

    return {
      strategyName: strategy.name,
      strategyDescription: strategy.description,
      parameters: strategy.parameters,
      metrics,
      executionTimeMs
    };
  }

  /**
   * Run multiple strategies and return sorted results
   */
  async runMultipleStrategies(): Promise<StrategyResult[]> {
    const results: StrategyResult[] = [];

    for (const strategy of this.config.strategies) {
      const result = await this.runSingleStrategy(strategy);
      results.push(result);
    }

    // Sort by total return descending
    return results.sort((a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct);
  }

  /**
   * Run strategies in parallel
   */
  async runParallel(): Promise<StrategyResult[]> {
    const promises = this.config.strategies.map(strategy =>
      this.runSingleStrategy(strategy)
    );

    const results = await Promise.all(promises);

    // Sort by total return descending
    return results.sort((a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct);
  }

  /**
   * Optimize strategy parameters
   */
  async optimizeStrategy(
    baseStrategy: StrategyConfig,
    options: OptimizationOptions
  ): Promise<OptimizationResult> {
    const { parameterRanges, optimizationMetric } = options;

    // Generate all parameter combinations
    const combinations = this.generateParameterCombinations(parameterRanges);

    // Run backtest for each combination
    const results: StrategyResult[] = [];

    for (const params of combinations) {
      const strategy: StrategyConfig = {
        ...baseStrategy,
        parameters: { ...baseStrategy.parameters, ...params }
      };

      const result = await this.runSingleStrategy(strategy);
      results.push(result);
    }

    // Sort by optimization metric
    const sortedResults = this.sortByMetric(results, optimizationMetric);

    return {
      bestParameters: sortedResults[0].parameters,
      bestMetrics: sortedResults[0].metrics,
      allResults: sortedResults
    };
  }

  /**
   * Create a signal generator from strategy config
   */
  private createSignalGenerator(strategy: StrategyConfig): StrategySignalGenerator {
    const minConfidence = strategy.parameters.minConfidence || 0.6;

    return {
      generateSignal: (candles: Candle[], currentPrice: number) => {
        // Simple moving average crossover strategy
        if (candles.length < 20) {
          return null;
        }

        const shortMA = this.calculateSMA(candles, 10);
        const longMA = this.calculateSMA(candles, 20);
        const prevShortMA = this.calculateSMA(candles.slice(0, -1), 10);
        const prevLongMA = this.calculateSMA(candles.slice(0, -1), 20);

        // Bullish crossover
        if (prevShortMA <= prevLongMA && shortMA > longMA) {
          return {
            signal: "LONG",
            confidence: 0.7,
            shouldExecute: 0.7 >= minConfidence,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 0.98,
            takeProfit: currentPrice * 1.04,
            reasoning: "Bullish MA crossover"
          };
        }

        // Bearish crossover
        if (prevShortMA >= prevLongMA && shortMA < longMA) {
          return {
            signal: "SHORT",
            confidence: 0.7,
            shouldExecute: 0.7 >= minConfidence,
            entryPrice: currentPrice,
            stopLoss: currentPrice * 1.02,
            takeProfit: currentPrice * 0.96,
            reasoning: "Bearish MA crossover"
          };
        }

        return {
          signal: "WAIT",
          confidence: 0,
          shouldExecute: false,
          reasoning: "No clear signal"
        };
      }
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(candles: Candle[], period: number): number {
    if (candles.length < period) {
      return candles[candles.length - 1].close;
    }

    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
    return sum / period;
  }

  /**
   * Generate all parameter combinations
   */
  private generateParameterCombinations(
    ranges: Record<string, any[]>
  ): Array<Record<string, any>> {
    const keys = Object.keys(ranges);
    if (keys.length === 0) return [{}];

    const combinations: Array<Record<string, any>> = [];

    const generate = (index: number, current: Record<string, any>) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      const values = ranges[key];

      for (const value of values) {
        current[key] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  /**
   * Sort results by optimization metric
   */
  private sortByMetric(
    results: StrategyResult[],
    metric: OptimizationOptions["optimizationMetric"]
  ): StrategyResult[] {
    return results.sort((a, b) => {
      switch (metric) {
        case "totalReturn":
          return b.metrics.totalReturnPct - a.metrics.totalReturnPct;
        case "sharpeRatio":
          return b.metrics.sharpeRatio - a.metrics.sharpeRatio;
        case "winRate":
          return b.metrics.winRate - a.metrics.winRate;
        case "profitFactor":
          return b.metrics.profitFactor - a.metrics.profitFactor;
        default:
          return b.metrics.totalReturnPct - a.metrics.totalReturnPct;
      }
    });
  }
}
