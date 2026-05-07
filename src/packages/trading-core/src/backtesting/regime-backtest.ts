import type { Candle } from "../intelligence-engines.js";
import type { BacktestMetrics, StrategySignalGenerator } from "./backtest-engine.js";
import { BacktestEngine, type BacktestConfig } from "./backtest-engine.js";
import { RegimeDetector, type MarketRegime, type RegimeDetectionResult } from "./regime-detector.js";

export interface RegimeBacktestConfig extends BacktestConfig {
  regimeFilter?: MarketRegime[]; // Only trade in these regimes
}

export interface RegimeBacktestResult {
  overall: BacktestMetrics;
  byRegime: Map<MarketRegime, BacktestMetrics>;
  regimeDistribution: Map<MarketRegime, number>; // Percentage of time in each regime
  regimeTransitions: RegimeTransition[];
  bestRegimes: MarketRegime[];
  worstRegimes: MarketRegime[];
}

export interface RegimeTransition {
  fromRegime: MarketRegime;
  toRegime: MarketRegime;
  timestamp: number;
  count: number;
}

export interface CandleWithRegime extends Candle {
  regime: MarketRegime;
  regimeConfidence: number;
}

export class RegimeBacktest {
  private regimeDetector: RegimeDetector;

  constructor() {
    this.regimeDetector = new RegimeDetector();
  }

  /**
   * Run backtest with regime-based analysis
   */
  async run(
    candles: Candle[],
    config: RegimeBacktestConfig,
    signalGenerator: StrategySignalGenerator
  ): Promise<RegimeBacktestResult> {
    // Detect regimes for all candles
    console.log("Detecting market regimes...");
    const regimeResults = this.regimeDetector.detectRegimes(candles);

    // Annotate candles with regime information
    const candlesWithRegime: CandleWithRegime[] = candles.map((candle, i) => ({
      ...candle,
      regime: regimeResults[i].regime,
      regimeConfidence: regimeResults[i].confidence
    }));

    // Calculate regime distribution
    const regimeDistribution = this.calculateRegimeDistribution(candlesWithRegime);

    // Calculate regime transitions
    const regimeTransitions = this.calculateRegimeTransitions(candlesWithRegime);

    // Run overall backtest
    console.log("Running overall backtest...");
    const engine = new BacktestEngine(config);
    const overall = await engine.run(candles, signalGenerator);

    // Run backtest for each regime
    console.log("Running regime-specific backtests...");
    const byRegime = new Map<MarketRegime, BacktestMetrics>();

    const regimes: MarketRegime[] = ["trending_up", "trending_down", "ranging", "volatile"];

    for (const regime of regimes) {
      const regimeCandles = candlesWithRegime.filter(c => c.regime === regime);

      if (regimeCandles.length < 10) {
        console.log(`Skipping regime ${regime}: insufficient data (${regimeCandles.length} candles)`);
        continue;
      }

      console.log(`Testing regime: ${regime} (${regimeCandles.length} candles)`);

      try {
        const regimeEngine = new BacktestEngine(config);
        const metrics = await regimeEngine.run(regimeCandles, signalGenerator);
        byRegime.set(regime, metrics);
      } catch (error) {
        console.error(`Error testing regime ${regime}:`, error);
      }
    }

    // Identify best and worst regimes
    const { bestRegimes, worstRegimes } = this.rankRegimes(byRegime);

    return {
      overall,
      byRegime,
      regimeDistribution,
      regimeTransitions,
      bestRegimes,
      worstRegimes
    };
  }

  /**
   * Run adaptive backtest that only trades in favorable regimes
   */
  async runAdaptive(
    candles: Candle[],
    config: RegimeBacktestConfig,
    signalGenerator: StrategySignalGenerator,
    favorableRegimes: MarketRegime[]
  ): Promise<BacktestMetrics> {
    // Detect regimes
    const regimeResults = this.regimeDetector.detectRegimes(candles);

    // Filter candles to only favorable regimes
    const filteredCandles: Candle[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (favorableRegimes.includes(regimeResults[i].regime)) {
        filteredCandles.push(candles[i]);
      }
    }

    console.log(
      `Adaptive backtest: ${filteredCandles.length}/${candles.length} candles in favorable regimes`
    );

    if (filteredCandles.length < 10) {
      throw new Error("Insufficient candles in favorable regimes for backtesting");
    }

    // Run backtest on filtered candles
    const engine = new BacktestEngine(config);
    return await engine.run(filteredCandles, signalGenerator);
  }

  /**
   * Compare strategy performance across regimes
   */
  compareStrategies(
    strategies: Array<{
      name: string;
      result: RegimeBacktestResult;
    }>
  ): {
    bestStrategyByRegime: Map<MarketRegime, string>;
    overallBest: string;
    regimeSpecialization: Map<string, MarketRegime[]>;
  } {
    const regimes: MarketRegime[] = ["trending_up", "trending_down", "ranging", "volatile"];
    const bestStrategyByRegime = new Map<MarketRegime, string>();

    // Find best strategy for each regime
    for (const regime of regimes) {
      let bestStrategy = "";
      let bestReturn = -Infinity;

      for (const strategy of strategies) {
        const metrics = strategy.result.byRegime.get(regime);
        if (metrics && metrics.totalReturnPct > bestReturn) {
          bestReturn = metrics.totalReturnPct;
          bestStrategy = strategy.name;
        }
      }

      if (bestStrategy) {
        bestStrategyByRegime.set(regime, bestStrategy);
      }
    }

    // Find overall best strategy
    let overallBest = "";
    let bestOverallReturn = -Infinity;

    for (const strategy of strategies) {
      if (strategy.result.overall.totalReturnPct > bestOverallReturn) {
        bestOverallReturn = strategy.result.overall.totalReturnPct;
        overallBest = strategy.name;
      }
    }

    // Identify regime specialization (which regimes each strategy excels in)
    const regimeSpecialization = new Map<string, MarketRegime[]>();

    for (const strategy of strategies) {
      const specializedRegimes: MarketRegime[] = [];

      for (const [regime, bestStrategy] of bestStrategyByRegime.entries()) {
        if (bestStrategy === strategy.name) {
          specializedRegimes.push(regime);
        }
      }

      regimeSpecialization.set(strategy.name, specializedRegimes);
    }

    return {
      bestStrategyByRegime,
      overallBest,
      regimeSpecialization
    };
  }

  /**
   * Calculate regime distribution
   */
  private calculateRegimeDistribution(candles: CandleWithRegime[]): Map<MarketRegime, number> {
    const distribution = new Map<MarketRegime, number>();
    const regimes: MarketRegime[] = ["trending_up", "trending_down", "ranging", "volatile"];

    for (const regime of regimes) {
      const count = candles.filter(c => c.regime === regime).length;
      const percentage = (count / candles.length) * 100;
      distribution.set(regime, percentage);
    }

    return distribution;
  }

  /**
   * Calculate regime transitions
   */
  private calculateRegimeTransitions(candles: CandleWithRegime[]): RegimeTransition[] {
    const transitionMap = new Map<string, RegimeTransition>();

    for (let i = 1; i < candles.length; i++) {
      const prevRegime = candles[i - 1].regime;
      const currentRegime = candles[i].regime;

      if (prevRegime !== currentRegime) {
        const key = `${prevRegime}->${currentRegime}`;

        if (!transitionMap.has(key)) {
          transitionMap.set(key, {
            fromRegime: prevRegime,
            toRegime: currentRegime,
            timestamp: candles[i].timestamp,
            count: 0
          });
        }

        const transition = transitionMap.get(key)!;
        transition.count++;
        transition.timestamp = candles[i].timestamp; // Update to latest transition
      }
    }

    return Array.from(transitionMap.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Rank regimes by performance
   */
  private rankRegimes(byRegime: Map<MarketRegime, BacktestMetrics>): {
    bestRegimes: MarketRegime[];
    worstRegimes: MarketRegime[];
  } {
    const regimeScores: Array<{ regime: MarketRegime; score: number }> = [];

    for (const [regime, metrics] of byRegime.entries()) {
      // Score based on multiple factors
      const returnScore = metrics.totalReturnPct;
      const winRateScore = metrics.winRate;
      const sharpeScore = metrics.sharpeRatio * 10;

      // Weighted average
      const score = returnScore * 0.5 + winRateScore * 0.3 + sharpeScore * 0.2;

      regimeScores.push({ regime, score });
    }

    // Sort by score
    regimeScores.sort((a, b) => b.score - a.score);

    const bestRegimes = regimeScores.slice(0, 2).map(r => r.regime);
    const worstRegimes = regimeScores.slice(-2).map(r => r.regime);

    return { bestRegimes, worstRegimes };
  }

  /**
   * Get regime statistics
   */
  getRegimeStats(candles: Candle[]): {
    regimes: RegimeDetectionResult[];
    distribution: Map<MarketRegime, number>;
    avgConfidence: Map<MarketRegime, number>;
  } {
    const regimes = this.regimeDetector.detectRegimes(candles);

    const distribution = new Map<MarketRegime, number>();
    const confidenceSum = new Map<MarketRegime, number>();
    const confidenceCount = new Map<MarketRegime, number>();

    const allRegimes: MarketRegime[] = ["trending_up", "trending_down", "ranging", "volatile"];

    for (const regime of allRegimes) {
      distribution.set(regime, 0);
      confidenceSum.set(regime, 0);
      confidenceCount.set(regime, 0);
    }

    for (const result of regimes) {
      const current = distribution.get(result.regime) ?? 0;
      distribution.set(result.regime, current + 1);

      const currentSum = confidenceSum.get(result.regime) ?? 0;
      confidenceSum.set(result.regime, currentSum + result.confidence);

      const currentCount = confidenceCount.get(result.regime) ?? 0;
      confidenceCount.set(result.regime, currentCount + 1);
    }

    // Convert to percentages
    for (const [regime, count] of distribution.entries()) {
      distribution.set(regime, (count / regimes.length) * 100);
    }

    // Calculate average confidence
    const avgConfidence = new Map<MarketRegime, number>();
    for (const regime of allRegimes) {
      const sum = confidenceSum.get(regime) ?? 0;
      const count = confidenceCount.get(regime) ?? 0;
      avgConfidence.set(regime, count > 0 ? sum / count : 0);
    }

    return { regimes, distribution, avgConfidence };
  }
}
