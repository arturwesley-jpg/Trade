import type { Candle } from "../intelligence-engines.js";
import type { BacktestMetrics, StrategySignalGenerator } from "./backtest-engine.js";
import { BacktestEngine, type BacktestConfig } from "./backtest-engine.js";
import type { StrategyParameter } from "./strategy-runner.js";

export interface OptimizationConfig {
  parameterRanges: {
    [key: string]: number[];
  };
  optimizationMetric: "totalReturn" | "sharpeRatio" | "winRate" | "profitFactor" | "calmarRatio";
  minTrades?: number;
  maxParameters?: number;
  walkForward?: {
    enabled: boolean;
    trainPeriodPct: number; // e.g., 70 for 70% train, 30% test
    numFolds?: number; // For walk-forward optimization
  };
}

export interface OptimizationResult {
  bestParameters: Record<string, number>;
  bestMetrics: BacktestMetrics;
  confidenceScore: number;
  allResults: Array<{
    parameters: Record<string, number>;
    metrics: BacktestMetrics;
    score: number;
  }>;
  overfittingWarnings: string[];
  walkForwardResults?: WalkForwardResult[];
}

export interface WalkForwardResult {
  fold: number;
  trainPeriod: { start: number; end: number };
  testPeriod: { start: number; end: number };
  trainMetrics: BacktestMetrics;
  testMetrics: BacktestMetrics;
  parameters: Record<string, number>;
  degradation: number; // Performance degradation from train to test
}

export class Optimizer {
  /**
   * Optimize strategy parameters using grid search
   */
  async optimizeParameters(
    candles: Candle[],
    backtestConfig: BacktestConfig,
    signalGeneratorFactory: (params: Record<string, number>) => StrategySignalGenerator,
    optimizationConfig: OptimizationConfig
  ): Promise<OptimizationResult> {
    const warnings: string[] = [];

    // Validate configuration
    const paramCount = Object.keys(optimizationConfig.parameterRanges).length;
    if (optimizationConfig.maxParameters && paramCount > optimizationConfig.maxParameters) {
      warnings.push(
        `Optimizing ${paramCount} parameters may lead to overfitting. Consider reducing to ${optimizationConfig.maxParameters} or fewer.`
      );
    }

    // Generate parameter combinations
    const combinations = this.generateParameterCombinations(optimizationConfig.parameterRanges);
    console.log(`Testing ${combinations.length} parameter combinations...`);

    if (combinations.length > 1000) {
      warnings.push(
        `Large parameter space (${combinations.length} combinations) may take significant time and increase overfitting risk.`
      );
    }

    // Run optimization
    let results: Array<{
      parameters: Record<string, number>;
      metrics: BacktestMetrics;
      score: number;
    }>;

    let walkForwardResults: WalkForwardResult[] | undefined;

    if (optimizationConfig.walkForward?.enabled) {
      // Walk-forward optimization
      const wfResult = await this.walkForwardOptimization(
        candles,
        backtestConfig,
        signalGeneratorFactory,
        optimizationConfig,
        combinations
      );
      results = wfResult.results;
      walkForwardResults = wfResult.walkForwardResults;
    } else {
      // Simple grid search
      results = await this.gridSearch(
        candles,
        backtestConfig,
        signalGeneratorFactory,
        optimizationConfig,
        combinations
      );
    }

    // Filter by minimum trades
    const minTrades = optimizationConfig.minTrades ?? 10;
    const validResults = results.filter(r => r.metrics.totalTrades >= minTrades);

    if (validResults.length === 0) {
      throw new Error(`No parameter combinations produced at least ${minTrades} trades`);
    }

    if (validResults.length < results.length) {
      warnings.push(
        `${results.length - validResults.length} parameter combinations filtered out due to insufficient trades (< ${minTrades})`
      );
    }

    // Sort by score
    validResults.sort((a, b) => b.score - a.score);

    const best = validResults[0];

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(
      best,
      validResults,
      optimizationConfig,
      warnings
    );

    return {
      bestParameters: best.parameters,
      bestMetrics: best.metrics,
      confidenceScore,
      allResults: validResults,
      overfittingWarnings: warnings,
      walkForwardResults
    };
  }

  /**
   * Grid search optimization
   */
  private async gridSearch(
    candles: Candle[],
    backtestConfig: BacktestConfig,
    signalGeneratorFactory: (params: Record<string, number>) => StrategySignalGenerator,
    optimizationConfig: OptimizationConfig,
    combinations: Record<string, number>[]
  ): Promise<Array<{
    parameters: Record<string, number>;
    metrics: BacktestMetrics;
    score: number;
  }>> {
    const results: Array<{
      parameters: Record<string, number>;
      metrics: BacktestMetrics;
      score: number;
    }> = [];

    for (let i = 0; i < combinations.length; i++) {
      const params = combinations[i];

      try {
        const signalGenerator = signalGeneratorFactory(params);
        const engine = new BacktestEngine(backtestConfig);
        const metrics = await engine.run(candles, signalGenerator);

        const score = this.calculateScore(metrics, optimizationConfig.optimizationMetric);

        results.push({ parameters: params, metrics, score });

        if ((i + 1) % 10 === 0) {
          console.log(`Progress: ${i + 1}/${combinations.length}`);
        }
      } catch (error) {
        console.error(`Error testing combination ${i}:`, error);
      }
    }

    return results;
  }

  /**
   * Walk-forward optimization
   */
  private async walkForwardOptimization(
    candles: Candle[],
    backtestConfig: BacktestConfig,
    signalGeneratorFactory: (params: Record<string, number>) => StrategySignalGenerator,
    optimizationConfig: OptimizationConfig,
    combinations: Record<string, number>[]
  ): Promise<{
    results: Array<{
      parameters: Record<string, number>;
      metrics: BacktestMetrics;
      score: number;
    }>;
    walkForwardResults: WalkForwardResult[];
  }> {
    const wfConfig = optimizationConfig.walkForward!;
    const numFolds = wfConfig.numFolds ?? 3;
    const trainPct = wfConfig.trainPeriodPct / 100;

    const foldSize = Math.floor(candles.length / numFolds);
    const walkForwardResults: WalkForwardResult[] = [];
    const aggregatedScores = new Map<string, number[]>();

    console.log(`Running walk-forward optimization with ${numFolds} folds...`);

    for (let fold = 0; fold < numFolds; fold++) {
      const foldStart = fold * foldSize;
      const foldEnd = fold === numFolds - 1 ? candles.length : (fold + 1) * foldSize;
      const foldCandles = candles.slice(foldStart, foldEnd);

      const trainSize = Math.floor(foldCandles.length * trainPct);
      const trainCandles = foldCandles.slice(0, trainSize);
      const testCandles = foldCandles.slice(trainSize);

      console.log(`Fold ${fold + 1}/${numFolds}: Train=${trainCandles.length}, Test=${testCandles.length}`);

      // Optimize on training set
      let bestTrainScore = -Infinity;
      let bestParams: Record<string, number> | null = null;
      let bestTrainMetrics: BacktestMetrics | null = null;

      for (const params of combinations) {
        try {
          const signalGenerator = signalGeneratorFactory(params);
          const engine = new BacktestEngine(backtestConfig);
          const metrics = await engine.run(trainCandles, signalGenerator);

          const score = this.calculateScore(metrics, optimizationConfig.optimizationMetric);

          if (score > bestTrainScore) {
            bestTrainScore = score;
            bestParams = params;
            bestTrainMetrics = metrics;
          }
        } catch (error) {
          // Skip failed combinations
        }
      }

      if (!bestParams || !bestTrainMetrics) {
        console.warn(`Fold ${fold + 1}: No valid parameters found`);
        continue;
      }

      // Test on test set
      const testSignalGenerator = signalGeneratorFactory(bestParams);
      const testEngine = new BacktestEngine(backtestConfig);
      const testMetrics = await testEngine.run(testCandles, testSignalGenerator);
      const testScore = this.calculateScore(testMetrics, optimizationConfig.optimizationMetric);

      // Calculate degradation
      const degradation = ((bestTrainScore - testScore) / Math.abs(bestTrainScore)) * 100;

      walkForwardResults.push({
        fold: fold + 1,
        trainPeriod: {
          start: trainCandles[0].timestamp,
          end: trainCandles[trainCandles.length - 1].timestamp
        },
        testPeriod: {
          start: testCandles[0].timestamp,
          end: testCandles[testCandles.length - 1].timestamp
        },
        trainMetrics: bestTrainMetrics,
        testMetrics,
        parameters: bestParams,
        degradation
      });

      // Aggregate scores for each parameter combination
      const paramKey = JSON.stringify(bestParams);
      if (!aggregatedScores.has(paramKey)) {
        aggregatedScores.set(paramKey, []);
      }
      aggregatedScores.get(paramKey)!.push(testScore);
    }

    // Find best parameters based on average test performance
    let bestAvgScore = -Infinity;
    let bestParams: Record<string, number> | null = null;

    for (const [paramKey, scores] of aggregatedScores.entries()) {
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      if (avgScore > bestAvgScore) {
        bestAvgScore = avgScore;
        bestParams = JSON.parse(paramKey);
      }
    }

    // Run final backtest on full dataset with best parameters
    const finalResults: Array<{
      parameters: Record<string, number>;
      metrics: BacktestMetrics;
      score: number;
    }> = [];

    if (bestParams) {
      const signalGenerator = signalGeneratorFactory(bestParams);
      const engine = new BacktestEngine(backtestConfig);
      const metrics = await engine.run(candles, signalGenerator);
      const score = this.calculateScore(metrics, optimizationConfig.optimizationMetric);

      finalResults.push({ parameters: bestParams, metrics, score });
    }

    return { results: finalResults, walkForwardResults };
  }

  /**
   * Generate all parameter combinations
   */
  private generateParameterCombinations(
    ranges: { [key: string]: number[] }
  ): Record<string, number>[] {
    const keys = Object.keys(ranges);
    const combinations: Record<string, number>[] = [];

    const generate = (index: number, current: Record<string, number>) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      const values = ranges[key];

      for (const value of values) {
        current[key as keyof Record<string, number>] = value as any;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  /**
   * Calculate score based on optimization metric
   */
  private calculateScore(metrics: BacktestMetrics, metric: OptimizationConfig["optimizationMetric"]): number {
    switch (metric) {
      case "totalReturn":
        return metrics.totalReturnPct;
      case "sharpeRatio":
        return metrics.sharpeRatio;
      case "winRate":
        return metrics.winRate;
      case "profitFactor":
        return metrics.profitFactor;
      case "calmarRatio":
        // Calmar Ratio = Annual Return / Max Drawdown
        return metrics.maxDrawdownPct > 0
          ? metrics.totalReturnPct / metrics.maxDrawdownPct
          : 0;
      default:
        return metrics.totalReturnPct;
    }
  }

  /**
   * Calculate confidence score to detect overfitting
   */
  private calculateConfidenceScore(
    best: { parameters: Record<string, number>; metrics: BacktestMetrics; score: number },
    allResults: Array<{ parameters: Record<string, number>; metrics: BacktestMetrics; score: number }>,
    config: OptimizationConfig,
    warnings: string[]
  ): number {
    let confidence = 1.0;

    // Check trade count
    if (best.metrics.totalTrades < 30) {
      confidence *= 0.7;
      warnings.push(`Low trade count (${best.metrics.totalTrades}) reduces confidence in results`);
    }

    // Check parameter count vs trade count
    const paramCount = Object.keys(config.parameterRanges).length;
    const tradesPerParam = best.metrics.totalTrades / paramCount;
    if (tradesPerParam < 5) {
      confidence *= 0.6;
      warnings.push(
        `Low trades per parameter (${tradesPerParam.toFixed(1)}) suggests potential overfitting`
      );
    }

    // Check score distribution (if best is too far from others, might be overfitting)
    const scores = allResults.map(r => r.score);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const stdDev = Math.sqrt(
      scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length
    );

    if (stdDev > 0) {
      const zScore = (best.score - avgScore) / stdDev;
      if (zScore > 3) {
        confidence *= 0.8;
        warnings.push(
          `Best result is unusually far from average (z-score: ${zScore.toFixed(2)}), may indicate overfitting`
        );
      }
    }

    // Check win rate (too high might be suspicious)
    if (best.metrics.winRate > 80) {
      confidence *= 0.85;
      warnings.push(`Very high win rate (${best.metrics.winRate.toFixed(1)}%) may not be sustainable`);
    }

    // Check max drawdown (too low might be unrealistic)
    if (best.metrics.maxDrawdownPct < 5 && best.metrics.totalTrades > 20) {
      confidence *= 0.9;
      warnings.push(`Very low drawdown (${best.metrics.maxDrawdownPct.toFixed(1)}%) may not be realistic`);
    }

    return Math.max(0, Math.min(1, confidence));
  }
}
