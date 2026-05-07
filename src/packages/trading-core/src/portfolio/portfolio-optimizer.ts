/**
 * Portfolio Optimizer
 *
 * Implements various portfolio optimization strategies:
 * - Modern Portfolio Theory (MPT)
 * - Risk Parity
 * - Maximum Sharpe Ratio
 * - Minimum Variance
 * - Equal Weight
 */

import type {
  OptimizationResult,
  OptimizationConstraints,
  MPTConfig,
  RiskParityConfig,
} from './types.js';

export class PortfolioOptimizer {
  /**
   * Equal weight allocation (1/N strategy)
   */
  equalWeight(
    symbols: string[],
    constraints?: Partial<OptimizationConstraints>
  ): OptimizationResult {
    const n = symbols.length;
    const weight = 100 / n;

    const allocation = symbols.map(symbol => ({
      symbol,
      weight,
    }));

    return {
      method: 'equal-weight',
      allocation,
      expectedReturn: 0,
      expectedRisk: 0,
      sharpeRatio: 0,
      constraints: this.getDefaultConstraints(constraints),
      timestamp: new Date(),
    };
  }

  /**
   * Minimum variance portfolio
   * Finds allocation that minimizes portfolio variance
   */
  minimumVariance(
    symbols: string[],
    covarianceMatrix: number[][],
    constraints?: Partial<OptimizationConstraints>
  ): OptimizationResult {
    const n = symbols.length;
    const finalConstraints = this.getDefaultConstraints(constraints);

    // Simple heuristic: inverse volatility weighting
    const volatilities = covarianceMatrix.map((row, i) => Math.sqrt(row[i]));
    const invVols = volatilities.map(v => 1 / v);
    const sumInvVols = invVols.reduce((sum, iv) => sum + iv, 0);

    let weights = invVols.map(iv => (iv / sumInvVols) * 100);

    // Apply constraints
    weights = this.applyConstraints(weights, finalConstraints);

    const allocation = symbols.map((symbol, i) => ({
      symbol,
      weight: weights[i],
    }));

    const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
    const expectedRisk = Math.sqrt(portfolioVariance);

    return {
      method: 'min-variance',
      allocation,
      expectedReturn: 0,
      expectedRisk,
      sharpeRatio: 0,
      constraints: finalConstraints,
      timestamp: new Date(),
    };
  }

  /**
   * Maximum Sharpe ratio portfolio
   * Finds allocation that maximizes risk-adjusted returns
   */
  maximumSharpe(
    symbols: string[],
    expectedReturns: number[],
    covarianceMatrix: number[][],
    riskFreeRate: number = 0.02,
    constraints?: Partial<OptimizationConstraints>
  ): OptimizationResult {
    const n = symbols.length;
    const finalConstraints = this.getDefaultConstraints(constraints);

    // Simplified approach: weight by excess return / volatility
    const volatilities = covarianceMatrix.map((row, i) => Math.sqrt(row[i]));
    const excessReturns = expectedReturns.map(r => r - riskFreeRate);
    const sharpeRatios = excessReturns.map((er, i) =>
      volatilities[i] > 0 ? er / volatilities[i] : 0
    );

    // Normalize positive Sharpe ratios to weights
    const positiveSharpes = sharpeRatios.map(s => Math.max(0, s));
    const sumSharpes = positiveSharpes.reduce((sum, s) => sum + s, 0);

    let weights = sumSharpes > 0
      ? positiveSharpes.map(s => (s / sumSharpes) * 100)
      : new Array(n).fill(100 / n);

    // Apply constraints
    weights = this.applyConstraints(weights, finalConstraints);

    const allocation = symbols.map((symbol, i) => ({
      symbol,
      weight: weights[i],
    }));

    const expectedReturn = this.calculatePortfolioReturn(weights, expectedReturns);
    const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
    const expectedRisk = Math.sqrt(portfolioVariance);
    const sharpeRatio = expectedRisk > 0 ? (expectedReturn - riskFreeRate) / expectedRisk : 0;

    return {
      method: 'max-sharpe',
      allocation,
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      constraints: finalConstraints,
      timestamp: new Date(),
    };
  }

  /**
   * Risk Parity allocation
   * Each asset contributes equally to portfolio risk
   */
  riskParity(
    symbols: string[],
    covarianceMatrix: number[][],
    constraints?: Partial<OptimizationConstraints>
  ): OptimizationResult {
    const n = symbols.length;
    const finalConstraints = this.getDefaultConstraints(constraints);

    // Simplified risk parity: inverse volatility with iterative adjustment
    const volatilities = covarianceMatrix.map((row, i) => Math.sqrt(row[i]));
    const invVols = volatilities.map(v => 1 / v);
    const sumInvVols = invVols.reduce((sum, iv) => sum + iv, 0);

    let weights = invVols.map(iv => (iv / sumInvVols) * 100);

    // Iterative adjustment for risk contribution equality
    for (let iter = 0; iter < 10; iter++) {
      const riskContributions = this.calculateRiskContributions(weights, covarianceMatrix);
      const avgRiskContrib = riskContributions.reduce((sum, rc) => sum + rc, 0) / n;

      // Adjust weights based on risk contribution deviation
      weights = weights.map((w, i) => {
        const adjustment = avgRiskContrib / (riskContributions[i] || 1);
        return w * adjustment;
      });

      // Normalize to 100%
      const sumWeights = weights.reduce((sum, w) => sum + w, 0);
      weights = weights.map(w => (w / sumWeights) * 100);
    }

    // Apply constraints
    weights = this.applyConstraints(weights, finalConstraints);

    const allocation = symbols.map((symbol, i) => ({
      symbol,
      weight: weights[i],
    }));

    const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
    const expectedRisk = Math.sqrt(portfolioVariance);

    return {
      method: 'risk-parity',
      allocation,
      expectedReturn: 0,
      expectedRisk,
      sharpeRatio: 0,
      diversificationRatio: this.calculateDiversificationRatio(weights, volatilities, expectedRisk),
      constraints: finalConstraints,
      timestamp: new Date(),
    };
  }

  /**
   * Mean-Variance Optimization (MPT)
   * Finds efficient frontier allocation for target return or risk
   */
  meanVarianceOptimization(config: MPTConfig): OptimizationResult {
    const { assets, expectedReturns, covarianceMatrix, riskFreeRate, constraints } = config;

    // For simplicity, use max Sharpe as the efficient portfolio
    return this.maximumSharpe(
      assets,
      expectedReturns,
      covarianceMatrix,
      riskFreeRate,
      constraints
    );
  }

  /**
   * Calculate portfolio expected return
   */
  private calculatePortfolioReturn(weights: number[], expectedReturns: number[]): number {
    return weights.reduce((sum, w, i) => sum + (w / 100) * expectedReturns[i], 0);
  }

  /**
   * Calculate portfolio variance
   */
  private calculatePortfolioVariance(weights: number[], covarianceMatrix: number[][]): number {
    const n = weights.length;
    let variance = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += (weights[i] / 100) * (weights[j] / 100) * covarianceMatrix[i][j];
      }
    }

    return variance;
  }

  /**
   * Calculate risk contributions for each asset
   */
  private calculateRiskContributions(weights: number[], covarianceMatrix: number[][]): number[] {
    const n = weights.length;
    const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
    const portfolioStdDev = Math.sqrt(portfolioVariance);

    if (portfolioStdDev === 0) {
      return new Array(n).fill(0);
    }

    const riskContributions: number[] = [];

    for (let i = 0; i < n; i++) {
      let marginalContribution = 0;
      for (let j = 0; j < n; j++) {
        marginalContribution += (weights[j] / 100) * covarianceMatrix[i][j];
      }
      const riskContribution = (weights[i] / 100) * marginalContribution / portfolioStdDev;
      riskContributions.push(riskContribution);
    }

    return riskContributions;
  }

  /**
   * Calculate diversification ratio
   */
  private calculateDiversificationRatio(
    weights: number[],
    volatilities: number[],
    portfolioVolatility: number
  ): number {
    const weightedAvgVol = weights.reduce((sum, w, i) =>
      sum + (w / 100) * volatilities[i], 0
    );
    return portfolioVolatility > 0 ? weightedAvgVol / portfolioVolatility : 1;
  }

  /**
   * Apply weight constraints
   */
  private applyConstraints(
    weights: number[],
    constraints: OptimizationConstraints
  ): number[] {
    const { minWeight, maxWeight } = constraints;

    // Clamp weights to min/max
    let adjustedWeights = weights.map(w =>
      Math.max(minWeight, Math.min(maxWeight, w))
    );

    // Normalize to 100%
    const sum = adjustedWeights.reduce((s, w) => s + w, 0);
    if (sum > 0) {
      adjustedWeights = adjustedWeights.map(w => (w / sum) * 100);
    }

    return adjustedWeights;
  }

  /**
   * Get default constraints
   */
  private getDefaultConstraints(
    partial?: Partial<OptimizationConstraints>
  ): OptimizationConstraints {
    return {
      minWeight: 0,
      maxWeight: 100,
      allowShortSelling: false,
      riskFreeRate: 0.02,
      ...partial,
    };
  }
}
