/**
 * Rebalancing Engine
 *
 * Manages portfolio rebalancing logic:
 * - Periodic rebalancing (daily, weekly, monthly)
 * - Threshold-based rebalancing
 * - Volatility-based rebalancing
 * - Tax-loss harvesting
 */

import type {
  AllocationStrategy,
  PortfolioSnapshot,
  RebalancePlan,
  RebalanceTrade,
  RebalanceConfig,
  TaxLotInfo,
  TaxHarvestingOpportunity,
  VolatilityTarget,
} from './types.js';
import { PortfolioAnalyzer } from './portfolio-analyzer.js';

export class RebalancingEngine {
  private analyzer: PortfolioAnalyzer;

  constructor() {
    this.analyzer = new PortfolioAnalyzer();
  }

  /**
   * Check if rebalancing is needed based on strategy
   */
  shouldRebalance(
    strategy: AllocationStrategy,
    snapshot: PortfolioSnapshot,
    lastRebalanceDate?: Date
  ): { needed: boolean; reason: string } {
    const snapshotWithDrift = this.analyzer.calculateDrift(snapshot, strategy.assets);

    // Threshold-based check
    if (strategy.rebalanceFrequency === 'threshold') {
      const needsRebalancing = this.analyzer.needsRebalancing(
        snapshotWithDrift,
        strategy.rebalanceThreshold
      );

      if (needsRebalancing) {
        const maxDrift = Math.max(...snapshotWithDrift.assets.map(a => Math.abs(a.drift ?? 0)));
        return {
          needed: true,
          reason: `Maximum drift of ${maxDrift.toFixed(2)}% exceeds threshold of ${strategy.rebalanceThreshold}%`,
        };
      }

      return { needed: false, reason: 'Drift within threshold' };
    }

    // Periodic check
    if (!lastRebalanceDate) {
      return { needed: true, reason: 'Initial rebalancing' };
    }

    const daysSinceRebalance = Math.floor(
      (Date.now() - lastRebalanceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const frequencyDays = {
      daily: 1,
      weekly: 7,
      monthly: 30,
    };

    const requiredDays = frequencyDays[strategy.rebalanceFrequency];

    if (daysSinceRebalance >= requiredDays) {
      return {
        needed: true,
        reason: `${strategy.rebalanceFrequency} rebalancing due (${daysSinceRebalance} days since last rebalance)`,
      };
    }

    return {
      needed: false,
      reason: `Next rebalance in ${requiredDays - daysSinceRebalance} days`,
    };
  }

  /**
   * Create a rebalancing plan
   */
  createRebalancePlan(
    strategy: AllocationStrategy,
    snapshot: PortfolioSnapshot,
    config: RebalanceConfig
  ): RebalancePlan {
    const snapshotWithDrift = this.analyzer.calculateDrift(snapshot, strategy.assets);

    const trades = this.analyzer.generateRebalanceTrades(
      snapshotWithDrift,
      strategy.assets,
      config.minTradeValue
    );

    // Filter trades by max turnover
    const filteredTrades = this.filterByMaxTurnover(
      trades,
      snapshot.totalValue,
      config.maxTurnoverPct
    );

    // Calculate costs
    const estimatedCost = config.considerTransactionCosts
      ? this.calculateTransactionCosts(filteredTrades, config.transactionCostPct)
      : 0;

    const estimatedTaxImpact = config.considerTaxes && config.taxRate
      ? this.estimateTaxImpact(filteredTrades, config.taxRate)
      : undefined;

    const totalTurnover = this.calculateTurnover(filteredTrades, snapshot.totalValue);

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      currentSnapshot: snapshotWithDrift,
      trades: filteredTrades,
      estimatedCost,
      estimatedTaxImpact,
      totalTurnover,
      reason: 'Rebalancing to target allocation',
      createdAt: new Date(),
      status: 'PENDING',
    };
  }

  /**
   * Volatility-based rebalancing
   * Adjusts allocation based on realized volatility
   */
  volatilityBasedRebalance(
    snapshot: PortfolioSnapshot,
    target: VolatilityTarget,
    realizedVolatility: number
  ): RebalancePlan {
    // Calculate target equity weight based on volatility
    const volatilityRatio = target.targetVolatility / realizedVolatility;
    let targetEquityWeight = Math.min(
      target.maxEquityWeight,
      Math.max(target.minEquityWeight, volatilityRatio * 100)
    );

    // Clamp to bounds
    targetEquityWeight = Math.max(
      target.minEquityWeight,
      Math.min(target.maxEquityWeight, targetEquityWeight)
    );

    const targetCashWeight = 100 - targetEquityWeight;

    // Create synthetic strategy
    const strategy: AllocationStrategy = {
      id: 'volatility-target',
      name: 'Volatility Targeting',
      assets: [
        {
          symbol: 'EQUITY',
          targetWeight: targetEquityWeight,
          minWeight: target.minEquityWeight,
          maxWeight: target.maxEquityWeight,
        },
        {
          symbol: 'CASH',
          targetWeight: targetCashWeight,
          minWeight: 0,
          maxWeight: 100 - target.minEquityWeight,
        },
      ],
      rebalanceThreshold: 5,
      rebalanceFrequency: target.rebalanceFrequency,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const snapshotWithDrift = this.analyzer.calculateDrift(snapshot, strategy.assets);
    const trades = this.analyzer.generateRebalanceTrades(snapshotWithDrift, strategy.assets);

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      currentSnapshot: snapshotWithDrift,
      trades,
      estimatedCost: 0,
      totalTurnover: this.calculateTurnover(trades, snapshot.totalValue),
      reason: `Volatility targeting: realized vol ${(realizedVolatility * 100).toFixed(2)}%, target ${(target.targetVolatility * 100).toFixed(2)}%`,
      createdAt: new Date(),
      status: 'PENDING',
    };
  }

  /**
   * Identify tax-loss harvesting opportunities
   */
  identifyTaxHarvestingOpportunities(
    taxLots: TaxLotInfo[],
    minLoss: number = 1000,
    taxRate: number = 0.25
  ): TaxHarvestingOpportunity[] {
    const opportunities: TaxHarvestingOpportunity[] = [];

    taxLots.forEach(lot => {
      if (lot.unrealizedGainLoss < -minLoss) {
        const taxSavings = Math.abs(lot.unrealizedGainLoss) * taxRate;

        // Check for wash sale risk (purchased within last 30 days)
        const washSaleRisk = lot.holdingPeriod < 30;

        opportunities.push({
          symbol: lot.symbol,
          quantity: lot.quantity,
          unrealizedLoss: Math.abs(lot.unrealizedGainLoss),
          taxSavings,
          washSaleRisk,
        });
      }
    });

    // Sort by tax savings (highest first)
    opportunities.sort((a, b) => b.taxSavings - a.taxSavings);

    return opportunities;
  }

  /**
   * Calculate transaction costs
   */
  private calculateTransactionCosts(
    trades: RebalanceTrade[],
    costPct: number
  ): number {
    return trades.reduce((sum, trade) =>
      sum + trade.estimatedValue * (costPct / 100), 0
    );
  }

  /**
   * Estimate tax impact (simplified)
   */
  private estimateTaxImpact(
    trades: RebalanceTrade[],
    taxRate: number
  ): number {
    // Simplified: assume all sells realize gains at average tax rate
    const sellValue = trades
      .filter(t => t.action === 'SELL')
      .reduce((sum, t) => sum + t.estimatedValue, 0);

    // Assume 20% average gain on sells
    return sellValue * 0.2 * taxRate;
  }

  /**
   * Calculate portfolio turnover
   */
  private calculateTurnover(
    trades: RebalanceTrade[],
    totalValue: number
  ): number {
    const tradedValue = trades.reduce((sum, t) => sum + t.estimatedValue, 0);
    return totalValue > 0 ? (tradedValue / totalValue) * 100 : 0;
  }

  /**
   * Filter trades by maximum turnover constraint
   */
  private filterByMaxTurnover(
    trades: RebalanceTrade[],
    totalValue: number,
    maxTurnoverPct: number
  ): RebalanceTrade[] {
    // Sort by priority
    const sortedTrades = [...trades].sort((a, b) => b.priority - a.priority);

    const filtered: RebalanceTrade[] = [];
    let currentTurnover = 0;

    for (const trade of sortedTrades) {
      const tradeImpact = (trade.estimatedValue / totalValue) * 100;
      if (currentTurnover + tradeImpact <= maxTurnoverPct) {
        filtered.push(trade);
        currentTurnover += tradeImpact;
      }
    }

    return filtered;
  }
}
