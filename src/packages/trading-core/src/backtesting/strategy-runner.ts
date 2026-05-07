/**
 * Strategy Runner
 * Runs backtests with parameter optimization
 */

import type { Candle } from "./historical-data-fetcher.js";
import { BacktestEngine, type BacktestConfig, type BacktestResult, type StrategyFunction } from "./backtest-engine.js";

export interface StrategyParameter {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface OptimizationResult {
  parameters: Record<string, number>;
  result: BacktestResult;
  score: number;
}

export type OptimizationObjective = "totalReturn" | "sharpeRatio" | "sortinoRatio" | "profitFactor" | "winRate";

export class StrategyRunner {
  constructor(private readonly config: BacktestConfig) {}

  /**
   * Run a single backtest
   */
  async runBacktest(
    candles: Candle[],
    strategy: StrategyFunction
  ): Promise<BacktestResult> {
    const engine = new BacktestEngine(this.config);
    return engine.run(candles, strategy);
  }

  /**
   * Optimize strategy parameters using grid search
   */
  async optimizeParameters(
    candles: Candle[],
    strategyFactory: (params: Record<string, number>) => StrategyFunction,
    parameters: StrategyParameter[],
    objective: OptimizationObjective = "sharpeRatio"
  ): Promise<OptimizationResult[]> {
    const parameterCombinations = this.generateParameterCombinations(parameters);
    const results: OptimizationResult[] = [];

    for (const params of parameterCombinations) {
      const strategy = strategyFactory(params);
      const result = await this.runBacktest(candles, strategy);
      const score = this.calculateScore(result, objective);

      results.push({
        parameters: params,
        result,
        score
      });
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Walk-forward analysis
   * Splits data into training and testing periods
   */
  async walkForwardAnalysis(
    candles: Candle[],
    strategyFactory: (params: Record<string, number>) => StrategyFunction,
    parameters: StrategyParameter[],
    options: {
      trainingPeriods: number;
      testingPeriods: number;
      objective?: OptimizationObjective;
    }
  ): Promise<{
    results: BacktestResult[];
    avgReturn: number;
    avgSharpe: number;
    consistency: number;
  }> {
    const { trainingPeriods, testingPeriods, objective = "sharpeRatio" } = options;
    const totalPeriods = trainingPeriods + testingPeriods;
    const periodSize = Math.floor(candles.length / totalPeriods);
    const results: BacktestResult[] = [];

    let currentIndex = 0;
    while (currentIndex + totalPeriods * periodSize <= candles.length) {
      // Training period
      const trainingStart = currentIndex;
      const trainingEnd = currentIndex + trainingPeriods * periodSize;
      const trainingCandles = candles.slice(trainingStart, trainingEnd);

      // Optimize on training data
      const optimizationResults = await this.optimizeParameters(
        trainingCandles,
        strategyFactory,
        parameters,
        objective
      );

      if (optimizationResults.length === 0) break;

      // Get best parameters
      const bestParams = optimizationResults[0].parameters;

      // Test period
      const testingStart = trainingEnd;
      const testingEnd = testingStart + testingPeriods * periodSize;
      const testingCandles = candles.slice(testingStart, testingEnd);

      // Test on out-of-sample data
      const strategy = strategyFactory(bestParams);
      const testResult = await this.runBacktest(testingCandles, strategy);
      results.push(testResult);

      currentIndex = testingEnd;
    }

    // Calculate aggregate metrics
    const avgReturn = results.reduce((sum, r) => sum + r.totalReturnPercent, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
    
    // Consistency: percentage of profitable periods
    const profitablePeriods = results.filter(r => r.totalReturn > 0).length;
    const consistency = (profitablePeriods / results.length) * 100;

    return {
      results,
      avgReturn,
      avgSharpe,
      consistency
    };
  }

  /**
   * Monte Carlo simulation
   * Randomly shuffles trade order to assess robustness
   */
  async monteCarloSimulation(
    result: BacktestResult,
    iterations: number = 1000
  ): Promise<{
    simulations: Array<{ finalCapital: number; maxDrawdown: number }>;
    avgFinalCapital: number;
    worstCase: number;
    bestCase: number;
    confidenceInterval95: [number, number];
  }> {
    const simulations: Array<{ finalCapital: number; maxDrawdown: number }> = [];

    for (let i = 0; i < iterations; i++) {
      const shuffledTrades = this.shuffleArray([...result.trades]);
      let capital = this.config.initialCapital;
      let peak = capital;
      let maxDrawdown = 0;

      for (const trade of shuffledTrades) {
        capital += trade.pnl;
        if (capital > peak) peak = capital;
        const drawdown = peak - capital;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      simulations.push({ finalCapital: capital, maxDrawdown });
    }

    simulations.sort((a, b) => a.finalCapital - b.finalCapital);

    const avgFinalCapital = simulations.reduce((sum, s) => sum + s.finalCapital, 0) / simulations.length;
    const worstCase = simulations[0].finalCapital;
    const bestCase = simulations[simulations.length - 1].finalCapital;
    
    const lowerIndex = Math.floor(iterations * 0.025);
    const upperIndex = Math.floor(iterations * 0.975);
    const confidenceInterval95: [number, number] = [
      simulations[lowerIndex].finalCapital,
      simulations[upperIndex].finalCapital
    ];

    return {
      simulations,
      avgFinalCapital,
      worstCase,
      bestCase,
      confidenceInterval95
    };
  }

  private generateParameterCombinations(parameters: StrategyParameter[]): Array<Record<string, number>> {
    if (parameters.length === 0) return [{}];

    const combinations: Array<Record<string, number>> = [];
    
    const generate = (index: number, current: Record<string, number>) => {
      if (index === parameters.length) {
        combinations.push({ ...current });
        return;
      }

      const param = parameters[index];
      for (let value = param.min; value <= param.max; value += param.step) {
        current[param.name] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  private calculateScore(result: BacktestResult, objective: OptimizationObjective): number {
    switch (objective) {
      case "totalReturn":
        return result.totalReturnPercent;
      case "sharpeRatio":
        return result.sharpeRatio;
      case "sortinoRatio":
        return result.sortinoRatio;
      case "profitFactor":
        return result.profitFactor;
      case "winRate":
        return result.winRate;
      default:
        return result.sharpeRatio;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

/**
 * Example strategy: Simple Moving Average Crossover
 */
export function createSMACrossoverStrategy(params: { fastPeriod: number; slowPeriod: number }): StrategyFunction {
  return (candles: Candle[], index: number) => {
    if (index < params.slowPeriod) return null;

    const fastSMA = calculateSMA(candles, index, params.fastPeriod);
    const slowSMA = calculateSMA(candles, index, params.slowPeriod);
    const prevFastSMA = calculateSMA(candles, index - 1, params.fastPeriod);
    const prevSlowSMA = calculateSMA(candles, index - 1, params.slowPeriod);

    // Bullish crossover
    if (prevFastSMA <= prevSlowSMA && fastSMA > slowSMA) {
      return {
        timestamp: candles[index].timestamp,
        action: "buy",
        price: candles[index].close,
        stopLoss: candles[index].close * 0.98,
        takeProfit: candles[index].close * 1.04
      };
    }

    // Bearish crossover
    if (prevFastSMA >= prevSlowSMA && fastSMA < slowSMA) {
      return {
        timestamp: candles[index].timestamp,
        action: "close",
        price: candles[index].close
      };
    }

    return null;
  };
}

/**
 * Example strategy: RSI Mean Reversion
 */
export function createRSIStrategy(params: { period: number; oversold: number; overbought: number }): StrategyFunction {
  return (candles: Candle[], index: number) => {
    if (index < params.period + 1) return null;

    const rsi = calculateRSI(candles, index, params.period);

    // Oversold - buy signal
    if (rsi < params.oversold) {
      return {
        timestamp: candles[index].timestamp,
        action: "buy",
        price: candles[index].close,
        stopLoss: candles[index].close * 0.97,
        takeProfit: candles[index].close * 1.05
      };
    }

    // Overbought - sell signal
    if (rsi > params.overbought) {
      return {
        timestamp: candles[index].timestamp,
        action: "close",
        price: candles[index].close
      };
    }

    return null;
  };
}

function calculateSMA(candles: Candle[], index: number, period: number): number {
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[index - i].close;
  }
  return sum / period;
}

function calculateRSI(candles: Candle[], index: number, period: number): number {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[index - i + 1].close - candles[index - i].close;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
