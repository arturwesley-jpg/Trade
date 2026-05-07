/**
 * Portfolio Analyzer
 *
 * Analyzes current portfolio state, calculates metrics, and identifies rebalancing needs
 */

import type { PortfolioSnapshot, Asset, PortfolioMetrics, RebalanceTrade } from './types.js';

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
}

export class PortfolioAnalyzer {
  /**
   * Create a portfolio snapshot from current positions
   */
  createSnapshot(positions: Position[], cash: number = 0): PortfolioSnapshot {
    const assets = positions.map(pos => {
      const value = pos.quantity * pos.currentPrice;
      return {
        symbol: pos.symbol,
        quantity: pos.quantity,
        value,
        weight: 0, // calculated below
      };
    });

    const totalValue = assets.reduce((sum, a) => sum + a.value, 0) + cash;

    // Calculate weights
    assets.forEach(asset => {
      asset.weight = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
    });

    return {
      totalValue,
      assets,
      cash,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate drift from target allocation
   */
  calculateDrift(
    snapshot: PortfolioSnapshot,
    targetAssets: Asset[]
  ): PortfolioSnapshot {
    const assetsWithDrift = snapshot.assets.map(asset => {
      const target = targetAssets.find(t => t.symbol === asset.symbol);
      const targetWeight = target?.targetWeight ?? 0;
      const drift = asset.weight - targetWeight;

      return {
        ...asset,
        targetWeight,
        drift,
      };
    });

    // Add missing assets (not currently held but in target)
    targetAssets.forEach(target => {
      if (!assetsWithDrift.find(a => a.symbol === target.symbol)) {
        assetsWithDrift.push({
          symbol: target.symbol,
          quantity: 0,
          value: 0,
          weight: 0,
          targetWeight: target.targetWeight,
          drift: -target.targetWeight,
        });
      }
    });

    return {
      ...snapshot,
      assets: assetsWithDrift,
    };
  }

  /**
   * Check if rebalancing is needed based on drift threshold
   */
  needsRebalancing(
    snapshot: PortfolioSnapshot,
    thresholdPct: number
  ): boolean {
    return snapshot.assets.some(asset =>
      Math.abs(asset.drift ?? 0) > thresholdPct
    );
  }

  /**
   * Generate rebalancing trades to achieve target allocation
   */
  generateRebalanceTrades(
    snapshot: PortfolioSnapshot,
    targetAssets: Asset[],
    minTradeValue: number = 10
  ): RebalanceTrade[] {
    const trades: RebalanceTrade[] = [];
    const totalValue = snapshot.totalValue;

    snapshot.assets.forEach(asset => {
      const target = targetAssets.find(t => t.symbol === asset.symbol);
      if (!target) return;

      const currentWeight = asset.weight;
      const targetWeight = target.targetWeight;
      const drift = currentWeight - targetWeight;

      // Skip if drift is negligible
      if (Math.abs(drift) < 0.1) return;

      const targetValue = (targetWeight / 100) * totalValue;
      const currentValue = asset.value;
      const deltaValue = targetValue - currentValue;

      // Skip if trade value is too small
      if (Math.abs(deltaValue) < minTradeValue) return;

      const currentPrice = currentValue / (asset.quantity || 1);
      const deltaQuantity = deltaValue / currentPrice;

      trades.push({
        symbol: asset.symbol,
        action: deltaQuantity > 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(deltaQuantity),
        estimatedValue: Math.abs(deltaValue),
        currentWeight,
        targetWeight,
        drift,
        priority: Math.abs(drift), // higher drift = higher priority
      });
    });

    // Sort by priority (highest drift first)
    trades.sort((a, b) => b.priority - a.priority);

    return trades;
  }

  /**
   * Calculate portfolio metrics
   */
  calculateMetrics(
    returns: number[], // daily returns
    riskFreeRate: number = 0.02 // 2% annual
  ): Omit<PortfolioMetrics, 'totalValue' | 'timestamp'> {
    if (returns.length === 0) {
      return this.getDefaultMetrics();
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const annualizedReturn = Math.pow(1 + avgReturn, 252) - 1; // 252 trading days

    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 0), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252); // annualized

    const dailyRiskFreeRate = Math.pow(1 + riskFreeRate, 1/252) - 1;
    const excessReturns = returns.map(r => r - dailyRiskFreeRate);
    const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const sharpeRatio = volatility > 0 ? (avgExcessReturn * Math.sqrt(252)) / volatility : 0;

    // Sortino ratio (downside deviation)
    const downsideReturns = returns.filter(r => r < avgReturn);
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / downsideReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
    const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - riskFreeRate) / downsideDeviation : 0;

    // Drawdown calculation
    let peak = 1;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let cumulative = 1;

    returns.forEach(r => {
      cumulative *= (1 + r);
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      currentDrawdown = drawdown;
    });

    // Calmar ratio
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    return {
      totalReturn: cumulative - 1,
      annualizedReturn,
      volatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      currentDrawdown,
      calmarRatio,
      diversificationRatio: 1, // placeholder, needs correlation data
      concentrationRisk: 0, // placeholder, needs position weights
    };
  }

  /**
   * Calculate concentration risk (Herfindahl index)
   */
  calculateConcentrationRisk(weights: number[]): number {
    // Herfindahl index: sum of squared weights
    // 0 = perfectly diversified, 1 = fully concentrated
    return weights.reduce((sum, w) => sum + Math.pow(w / 100, 2), 0);
  }

  /**
   * Calculate diversification ratio
   * Ratio of weighted average volatility to portfolio volatility
   */
  calculateDiversificationRatio(
    weights: number[],
    volatilities: number[],
    portfolioVolatility: number
  ): number {
    const weightedAvgVol = weights.reduce((sum, w, i) =>
      sum + (w / 100) * volatilities[i], 0
    );
    return portfolioVolatility > 0 ? weightedAvgVol / portfolioVolatility : 1;
  }

  private getDefaultMetrics(): Omit<PortfolioMetrics, 'totalValue' | 'timestamp'> {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      calmarRatio: 0,
      diversificationRatio: 1,
      concentrationRisk: 0,
    };
  }
}
