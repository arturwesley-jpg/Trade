/**
 * Leaderboard Ranking Algorithm
 * Calculates trader scores based on multiple performance metrics
 */

import type { TraderStats, LeaderboardFilters } from '../types.js';

export interface RankingWeights {
  returns: number;
  consistency: number;
  riskAdjusted: number;
  winRate: number;
  activity: number;
  social: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  returns: 0.30,      // 30% weight on total returns
  consistency: 0.25,  // 25% weight on consistency
  riskAdjusted: 0.20, // 20% weight on risk-adjusted returns (Sharpe)
  winRate: 0.10,      // 10% weight on win rate
  activity: 0.10,     // 10% weight on trading activity
  social: 0.05,       // 5% weight on social metrics
};

export class RankingAlgorithm {
  private weights: RankingWeights;

  constructor(weights: RankingWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.validateWeights();
  }

  /**
   * Calculate overall score for a trader
   */
  calculateScore(stats: TraderStats): number {
    const returnScore = this.calculateReturnScore(stats.totalReturnPercent);
    const consistencyScore = stats.consistencyScore / 100;
    const riskAdjustedScore = this.calculateRiskAdjustedScore(stats.sharpeRatio);
    const winRateScore = stats.winRate / 100;
    const activityScore = this.calculateActivityScore(stats.totalTrades);
    const socialScore = this.calculateSocialScore(stats.followers, stats.copiers);

    const score =
      returnScore * this.weights.returns +
      consistencyScore * this.weights.consistency +
      riskAdjustedScore * this.weights.riskAdjusted +
      winRateScore * this.weights.winRate +
      activityScore * this.weights.activity +
      socialScore * this.weights.social;

    return Math.max(0, Math.min(100, score * 100));
  }

  /**
   * Calculate return score (normalized)
   */
  private calculateReturnScore(returnPercent: number): number {
    // Normalize returns to 0-1 scale
    // Using sigmoid-like function to handle extreme values
    // 100% return = ~0.88 score, 200% = ~0.95, 50% = ~0.73
    return 1 / (1 + Math.exp(-returnPercent / 50));
  }

  /**
   * Calculate risk-adjusted score based on Sharpe ratio
   */
  private calculateRiskAdjustedScore(sharpeRatio: number): number {
    // Sharpe ratio normalization
    // 0 = 0.5, 1 = 0.73, 2 = 0.88, 3 = 0.95
    if (sharpeRatio < 0) return 0;
    return 1 / (1 + Math.exp(-sharpeRatio));
  }

  /**
   * Calculate activity score based on number of trades
   */
  private calculateActivityScore(totalTrades: number): number {
    // Reward active traders but with diminishing returns
    // 10 trades = 0.5, 50 = 0.8, 100 = 0.9, 200+ = ~1.0
    if (totalTrades < 10) return totalTrades / 20; // Penalty for very low activity
    return Math.min(1, Math.log10(totalTrades) / 2.5);
  }

  /**
   * Calculate social score based on followers and copiers
   */
  private calculateSocialScore(followers: number, copiers: number): number {
    // Copiers are weighted more than followers (2x)
    const socialMetric = followers + (copiers * 2);

    // Logarithmic scale to prevent dominance by mega-influencers
    if (socialMetric === 0) return 0;
    return Math.min(1, Math.log10(socialMetric + 1) / 3);
  }

  /**
   * Calculate consistency score based on performance metrics
   */
  calculateConsistencyScore(
    dailyReturns: number[],
    maxDrawdown: number,
    profitFactor: number
  ): number {
    if (dailyReturns.length === 0) return 0;

    // Calculate standard deviation of returns
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);

    // Lower volatility = higher consistency
    const volatilityScore = Math.max(0, 1 - (stdDev / 10));

    // Lower drawdown = higher consistency
    const drawdownScore = Math.max(0, 1 - (Math.abs(maxDrawdown) / 50));

    // Higher profit factor = higher consistency
    const profitFactorScore = Math.min(1, profitFactor / 3);

    // Weighted average
    return (volatilityScore * 0.4 + drawdownScore * 0.4 + profitFactorScore * 0.2) * 100;
  }

  /**
   * Calculate risk score (0-100, higher = riskier)
   */
  calculateRiskScore(
    maxDrawdown: number,
    averageLeverage: number,
    volatility: number
  ): number {
    // Drawdown component (0-40 points)
    const drawdownRisk = Math.min(40, Math.abs(maxDrawdown) * 0.8);

    // Leverage component (0-30 points)
    const leverageRisk = Math.min(30, averageLeverage * 3);

    // Volatility component (0-30 points)
    const volatilityRisk = Math.min(30, volatility * 3);

    return Math.min(100, drawdownRisk + leverageRisk + volatilityRisk);
  }

  /**
   * Filter traders based on criteria
   */
  applyFilters(
    stats: TraderStats,
    filters: LeaderboardFilters
  ): boolean {
    // Min trades filter
    if (filters.minTrades && stats.totalTrades < filters.minTrades) {
      return false;
    }

    // Min followers filter
    if (filters.minFollowers && stats.followers < filters.minFollowers) {
      return false;
    }

    return true;
  }

  /**
   * Validate that weights sum to 1.0
   */
  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(`Ranking weights must sum to 1.0, got ${sum}`);
    }
  }

  /**
   * Update weights
   */
  setWeights(weights: Partial<RankingWeights>): void {
    this.weights = { ...this.weights, ...weights };
    this.validateWeights();
  }

  /**
   * Get current weights
   */
  getWeights(): RankingWeights {
    return { ...this.weights };
  }
}
