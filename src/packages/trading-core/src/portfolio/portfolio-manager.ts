/**
 * Portfolio Manager
 *
 * Main orchestrator for portfolio management operations
 */

import type {
  AllocationStrategy,
  PortfolioSnapshot,
  RebalancePlan,
  OptimizationResult,
  BacktestResult,
  PortfolioMetrics,
  RebalanceConfig,
  TaxLotInfo,
  TaxHarvestingOpportunity,
} from './types.js';
import { PortfolioAnalyzer, type Position } from './portfolio-analyzer.js';
import { PortfolioOptimizer } from './portfolio-optimizer.js';
import { RebalancingEngine } from './rebalancing-engine.js';
import { PortfolioBacktester, type HistoricalPrice } from './portfolio-backtester.js';

export class PortfolioManager {
  private analyzer: PortfolioAnalyzer;
  private optimizer: PortfolioOptimizer;
  private rebalancer: RebalancingEngine;
  private backtester: PortfolioBacktester;

  constructor() {
    this.analyzer = new PortfolioAnalyzer();
    this.optimizer = new PortfolioOptimizer();
    this.rebalancer = new RebalancingEngine();
    this.backtester = new PortfolioBacktester();
  }

  /**
   * Get current portfolio snapshot
   */
  getPortfolioSnapshot(positions: Position[], cash: number = 0): PortfolioSnapshot {
    return this.analyzer.createSnapshot(positions, cash);
  }

  /**
   * Calculate portfolio metrics
   */
  calculatePortfolioMetrics(
    snapshot: PortfolioSnapshot,
    historicalReturns: number[],
    riskFreeRate: number = 0.02
  ): PortfolioMetrics {
    const baseMetrics = this.analyzer.calculateMetrics(historicalReturns, riskFreeRate);

    const weights = snapshot.assets.map(a => a.weight);
    const concentrationRisk = this.analyzer.calculateConcentrationRisk(weights);

    return {
      totalValue: snapshot.totalValue,
      ...baseMetrics,
      concentrationRisk,
      timestamp: new Date(),
    };
  }

  /**
   * Check if rebalancing is needed
   */
  shouldRebalance(
    strategy: AllocationStrategy,
    snapshot: PortfolioSnapshot,
    lastRebalanceDate?: Date
  ): { needed: boolean; reason: string } {
    return this.rebalancer.shouldRebalance(strategy, snapshot, lastRebalanceDate);
  }

  /**
   * Generate rebalancing suggestions
   */
  generateRebalanceSuggestions(
    strategy: AllocationStrategy,
    snapshot: PortfolioSnapshot,
    config: RebalanceConfig
  ): RebalancePlan {
    return this.rebalancer.createRebalancePlan(strategy, snapshot, config);
  }

  /**
   * Optimize portfolio allocation
   */
  optimizeAllocation(
    method: 'equal-weight' | 'min-variance' | 'max-sharpe' | 'risk-parity',
    symbols: string[],
    options: {
      expectedReturns?: number[];
      covarianceMatrix?: number[][];
      riskFreeRate?: number;
      constraints?: any;
    } = {}
  ): OptimizationResult {
    const { expectedReturns, covarianceMatrix, riskFreeRate, constraints } = options;

    switch (method) {
      case 'equal-weight':
        return this.optimizer.equalWeight(symbols, constraints);

      case 'min-variance':
        if (!covarianceMatrix) {
          throw new Error('Covariance matrix required for minimum variance optimization');
        }
        return this.optimizer.minimumVariance(symbols, covarianceMatrix, constraints);

      case 'max-sharpe':
        if (!expectedReturns || !covarianceMatrix) {
          throw new Error('Expected returns and covariance matrix required for max Sharpe optimization');
        }
        return this.optimizer.maximumSharpe(
          symbols,
          expectedReturns,
          covarianceMatrix,
          riskFreeRate ?? 0.02,
          constraints
        );

      case 'risk-parity':
        if (!covarianceMatrix) {
          throw new Error('Covariance matrix required for risk parity optimization');
        }
        return this.optimizer.riskParity(symbols, covarianceMatrix, constraints);

      default:
        throw new Error(`Unknown optimization method: ${method}`);
    }
  }

  /**
   * Backtest allocation strategy
   */
  async backtestStrategy(
    strategy: AllocationStrategy,
    config: any,
    historicalPrices: HistoricalPrice[]
  ): Promise<BacktestResult> {
    return this.backtester.backtest(strategy, config, historicalPrices);
  }

  /**
   * Compare multiple strategies
   */
  async compareStrategies(
    strategies: AllocationStrategy[],
    config: any,
    historicalPrices: HistoricalPrice[]
  ): Promise<Map<string, BacktestResult>> {
    return this.backtester.compareStrategies(strategies, config, historicalPrices);
  }

  /**
   * Identify tax-loss harvesting opportunities
   */
  identifyTaxHarvestingOpportunities(
    taxLots: TaxLotInfo[],
    minLoss: number = 1000,
    taxRate: number = 0.25
  ): TaxHarvestingOpportunity[] {
    return this.rebalancer.identifyTaxHarvestingOpportunities(taxLots, minLoss, taxRate);
  }

  /**
   * Create allocation strategy from optimization result
   */
  createStrategyFromOptimization(
    name: string,
    optimization: OptimizationResult,
    rebalanceConfig: {
      threshold: number;
      frequency: 'daily' | 'weekly' | 'monthly';
    }
  ): AllocationStrategy {
    return {
      id: `strategy-${Date.now()}`,
      name,
      description: `${optimization.method} optimization`,
      assets: optimization.allocation.map(a => ({
        symbol: a.symbol,
        targetWeight: a.weight,
        minWeight: optimization.constraints.minWeight,
        maxWeight: optimization.constraints.maxWeight,
      })),
      rebalanceThreshold: rebalanceConfig.threshold,
      rebalanceFrequency: rebalanceConfig.frequency,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Validate allocation strategy
   */
  validateStrategy(strategy: AllocationStrategy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check total weight
    const totalWeight = strategy.assets.reduce((sum, a) => sum + a.targetWeight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      errors.push(`Total weight must equal 100%, got ${totalWeight.toFixed(2)}%`);
    }

    // Check individual asset constraints
    strategy.assets.forEach(asset => {
      if (asset.targetWeight < asset.minWeight) {
        errors.push(`${asset.symbol}: target weight ${asset.targetWeight}% below minimum ${asset.minWeight}%`);
      }
      if (asset.targetWeight > asset.maxWeight) {
        errors.push(`${asset.symbol}: target weight ${asset.targetWeight}% above maximum ${asset.maxWeight}%`);
      }
      if (asset.minWeight < 0 || asset.maxWeight > 100) {
        errors.push(`${asset.symbol}: invalid weight constraints`);
      }
    });

    // Check rebalance threshold
    if (strategy.rebalanceThreshold < 0 || strategy.rebalanceThreshold > 100) {
      errors.push('Rebalance threshold must be between 0% and 100%');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
