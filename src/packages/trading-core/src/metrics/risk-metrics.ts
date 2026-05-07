import type { TradeMetrics } from "./metrics-calculator.js";

export interface RiskMetrics {
  // Value at Risk
  var95: number; // 95% confidence VaR
  var99: number; // 99% confidence VaR
  cvar95: number; // Conditional VaR (Expected Shortfall) at 95%
  cvar99: number; // Conditional VaR at 99%

  // Volatility
  volatility: number; // Standard deviation of returns
  annualizedVolatility: number;
  downsideVolatility: number;
  annualizedDownsideVolatility: number;

  // Market risk
  beta: number; // Sensitivity to market
  correlation: number; // Correlation with benchmark

  // Exposure
  averageExposure: number; // Average capital at risk
  maxExposure: number; // Maximum capital at risk
  currentExposure: number; // Current capital at risk

  // Position sizing
  kellyFraction: number; // Optimal position size (Kelly Criterion)
  recommendedPositionSize: number; // Conservative position size
  maxPositionSize: number; // Maximum recommended position size
}

export interface RiskAnalysisConfig {
  initialCapital?: number;
  riskFreeRate?: number;
  confidenceLevel95?: number;
  confidenceLevel99?: number;
  kellyFractionMultiplier?: number; // Conservative multiplier (default: 0.25)
}

export class RiskAnalyzer {
  private readonly initialCapital: number;
  private readonly riskFreeRate: number;
  private readonly confidenceLevel95: number;
  private readonly confidenceLevel99: number;
  private readonly kellyFractionMultiplier: number;

  constructor(config: RiskAnalysisConfig = {}) {
    this.initialCapital = config.initialCapital ?? 10_000;
    this.riskFreeRate = config.riskFreeRate ?? 0.02;
    this.confidenceLevel95 = config.confidenceLevel95 ?? 0.95;
    this.confidenceLevel99 = config.confidenceLevel99 ?? 0.99;
    this.kellyFractionMultiplier = config.kellyFractionMultiplier ?? 0.25;
  }

  analyze(
    trades: TradeMetrics[],
    benchmarkReturns?: number[],
    currentOpenPositions?: { marginUsdt: number }[]
  ): RiskMetrics {
    if (trades.length === 0) {
      return this.emptyMetrics();
    }

    const returns = trades.map(t => t.pnlPercentage);
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Value at Risk
    const var95 = this.calculateVaR(sortedReturns, this.confidenceLevel95);
    const var99 = this.calculateVaR(sortedReturns, this.confidenceLevel99);

    // Conditional VaR (CVaR)
    const cvar95 = this.calculateCVaR(sortedReturns, this.confidenceLevel95);
    const cvar99 = this.calculateCVaR(sortedReturns, this.confidenceLevel99);

    // Volatility
    const volatility = this.calculateVolatility(returns);
    const annualizedVolatility = volatility * Math.sqrt(252);

    const downsideReturns = returns.filter(r => r < 0);
    const downsideVolatility = this.calculateVolatility(downsideReturns);
    const annualizedDownsideVolatility = downsideVolatility * Math.sqrt(252);

    // Market risk (beta and correlation)
    let beta = 0;
    let correlation = 0;
    if (benchmarkReturns && benchmarkReturns.length > 0) {
      const minLength = Math.min(returns.length, benchmarkReturns.length);
      const alignedReturns = returns.slice(0, minLength);
      const alignedBenchmark = benchmarkReturns.slice(0, minLength);

      correlation = this.calculateCorrelation(alignedReturns, alignedBenchmark);
      const benchmarkVolatility = this.calculateVolatility(alignedBenchmark);
      beta = benchmarkVolatility !== 0 ? (correlation * volatility) / benchmarkVolatility : 0;
    }

    // Exposure analysis
    const exposures = trades.map(t => Math.abs(t.pnl / (t.pnlPercentage / 100)));
    const averageExposure = exposures.reduce((sum, e) => sum + e, 0) / exposures.length;
    const maxExposure = Math.max(...exposures);
    const currentExposure = currentOpenPositions
      ? currentOpenPositions.reduce((sum, p) => sum + p.marginUsdt, 0)
      : 0;

    // Position sizing
    const kellyFraction = this.calculateKellyFraction(trades);
    const recommendedPositionSize = this.calculateRecommendedPositionSize(
      kellyFraction,
      volatility
    );
    const maxPositionSize = this.initialCapital * 0.1; // Max 10% of capital per position

    return {
      var95: this.round(var95, 2),
      var99: this.round(var99, 2),
      cvar95: this.round(cvar95, 2),
      cvar99: this.round(cvar99, 2),
      volatility: this.round(volatility, 2),
      annualizedVolatility: this.round(annualizedVolatility, 2),
      downsideVolatility: this.round(downsideVolatility, 2),
      annualizedDownsideVolatility: this.round(annualizedDownsideVolatility, 2),
      beta: this.round(beta, 3),
      correlation: this.round(correlation, 3),
      averageExposure: this.round(averageExposure, 2),
      maxExposure: this.round(maxExposure, 2),
      currentExposure: this.round(currentExposure, 2),
      kellyFraction: this.round(kellyFraction, 3),
      recommendedPositionSize: this.round(recommendedPositionSize, 2),
      maxPositionSize: this.round(maxPositionSize, 2)
    };
  }

  /**
   * Calculate Value at Risk (VaR) using historical simulation method
   * VaR represents the maximum expected loss at a given confidence level
   */
  private calculateVaR(sortedReturns: number[], confidenceLevel: number): number {
    if (sortedReturns.length === 0) return 0;

    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    const varPercentage = sortedReturns[index];

    // Convert percentage to dollar amount
    return (varPercentage / 100) * this.initialCapital;
  }

  /**
   * Calculate Conditional Value at Risk (CVaR) / Expected Shortfall
   * CVaR is the expected loss given that the loss exceeds VaR
   */
  private calculateCVaR(sortedReturns: number[], confidenceLevel: number): number {
    if (sortedReturns.length === 0) return 0;

    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    const tailReturns = sortedReturns.slice(0, index + 1);

    if (tailReturns.length === 0) return 0;

    const averageTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;

    // Convert percentage to dollar amount
    return (averageTailReturn / 100) * this.initialCapital;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate correlation between two return series
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xDenominator * yDenominator);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate Kelly Fraction for optimal position sizing
   * Formula: f = (p * b - q) / b
   * where p = win probability, q = loss probability, b = win/loss ratio
   */
  private calculateKellyFraction(trades: TradeMetrics[]): number {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    if (losingTrades.length === 0 || winningTrades.length === 0) return 0;

    const winProbability = winningTrades.length / trades.length;
    const lossProbability = 1 - winProbability;

    const averageWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
    const averageLoss = Math.abs(
      losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length
    );

    const winLossRatio = averageWin / averageLoss;

    const kellyFraction = (winProbability * winLossRatio - lossProbability) / winLossRatio;

    // Return conservative Kelly (typically 25% of full Kelly)
    return Math.max(0, kellyFraction * this.kellyFractionMultiplier);
  }

  /**
   * Calculate recommended position size based on Kelly Fraction and volatility
   */
  private calculateRecommendedPositionSize(kellyFraction: number, volatility: number): number {
    // Base position size from Kelly
    let positionSize = this.initialCapital * kellyFraction;

    // Adjust for volatility (reduce size if volatility is high)
    const volatilityAdjustment = Math.max(0.5, 1 - volatility / 10);
    positionSize *= volatilityAdjustment;

    // Cap at 10% of capital
    return Math.min(positionSize, this.initialCapital * 0.1);
  }

  private emptyMetrics(): RiskMetrics {
    return {
      var95: 0,
      var99: 0,
      cvar95: 0,
      cvar99: 0,
      volatility: 0,
      annualizedVolatility: 0,
      downsideVolatility: 0,
      annualizedDownsideVolatility: 0,
      beta: 0,
      correlation: 0,
      averageExposure: 0,
      maxExposure: 0,
      currentExposure: 0,
      kellyFraction: 0,
      recommendedPositionSize: 0,
      maxPositionSize: 0
    };
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
