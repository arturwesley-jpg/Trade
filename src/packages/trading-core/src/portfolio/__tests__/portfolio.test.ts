/**
 * Portfolio Management Tests
 */

import { describe, it, expect } from 'vitest';
import { PortfolioAnalyzer } from '../portfolio-analyzer.js';
import { PortfolioOptimizer } from '../portfolio-optimizer.js';
import { RebalancingEngine } from '../rebalancing-engine.js';
import { PortfolioManager } from '../portfolio-manager.js';
import type { AllocationStrategy, RebalanceConfig } from '../types.js';

describe('PortfolioAnalyzer', () => {
  const analyzer = new PortfolioAnalyzer();

  it('should create portfolio snapshot', () => {
    const positions = [
      { symbol: 'BTC-USDT', quantity: 1, averagePrice: 40000, currentPrice: 45000 },
      { symbol: 'ETH-USDT', quantity: 10, averagePrice: 2000, currentPrice: 2500 },
    ];

    const snapshot = analyzer.createSnapshot(positions, 5000);

    expect(snapshot.totalValue).toBe(75000); // 45000 + 25000 + 5000
    expect(snapshot.assets).toHaveLength(2);
    expect(snapshot.assets[0].weight).toBeCloseTo(60, 1); // 45000/75000 * 100
    expect(snapshot.assets[1].weight).toBeCloseTo(33.33, 1); // 25000/75000 * 100
    expect(snapshot.cash).toBe(5000);
  });

  it('should calculate drift from target allocation', () => {
    const snapshot = analyzer.createSnapshot([
      { symbol: 'BTC-USDT', quantity: 1, averagePrice: 40000, currentPrice: 60000 },
      { symbol: 'ETH-USDT', quantity: 10, averagePrice: 2000, currentPrice: 2000 },
    ], 0);

    const targetAssets = [
      { symbol: 'BTC-USDT', targetWeight: 50, minWeight: 40, maxWeight: 60 },
      { symbol: 'ETH-USDT', targetWeight: 50, minWeight: 40, maxWeight: 60 },
    ];

    const withDrift = analyzer.calculateDrift(snapshot, targetAssets);

    expect(withDrift.assets[0].drift).toBeCloseTo(25, 1); // 75% - 50%
    expect(withDrift.assets[1].drift).toBeCloseTo(-25, 1); // 25% - 50%
  });

  it('should detect when rebalancing is needed', () => {
    const snapshot = {
      totalValue: 100000,
      assets: [
        { symbol: 'BTC-USDT', quantity: 1, value: 70000, weight: 70, targetWeight: 50, drift: 20 },
        { symbol: 'ETH-USDT', quantity: 10, value: 30000, weight: 30, targetWeight: 50, drift: -20 },
      ],
      cash: 0,
      timestamp: new Date(),
    };

    expect(analyzer.needsRebalancing(snapshot, 10)).toBe(true);
    expect(analyzer.needsRebalancing(snapshot, 25)).toBe(false);
  });

  it('should generate rebalancing trades', () => {
    const snapshot = {
      totalValue: 100000,
      assets: [
        { symbol: 'BTC-USDT', quantity: 1, value: 70000, weight: 70, targetWeight: 50, drift: 20 },
        { symbol: 'ETH-USDT', quantity: 10, value: 30000, weight: 30, targetWeight: 50, drift: -20 },
      ],
      cash: 0,
      timestamp: new Date(),
    };

    const targetAssets = [
      { symbol: 'BTC-USDT', targetWeight: 50, minWeight: 40, maxWeight: 60 },
      { symbol: 'ETH-USDT', targetWeight: 50, minWeight: 40, maxWeight: 60 },
    ];

    const trades = analyzer.generateRebalanceTrades(snapshot, targetAssets);

    expect(trades).toHaveLength(2);
    expect(trades[0].symbol).toBe('BTC-USDT');
    expect(trades[0].action).toBe('SELL');
    expect(trades[1].symbol).toBe('ETH-USDT');
    expect(trades[1].action).toBe('BUY');
  });

  it('should calculate portfolio metrics', () => {
    const returns = [0.01, -0.005, 0.02, -0.01, 0.015]; // daily returns

    const metrics = analyzer.calculateMetrics(returns, 0.02);

    expect(metrics.totalReturn).toBeGreaterThan(0);
    expect(metrics.volatility).toBeGreaterThan(0);
    expect(metrics.sharpeRatio).toBeDefined();
    expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it('should calculate concentration risk', () => {
    const equalWeights = [25, 25, 25, 25];
    const concentratedWeights = [70, 10, 10, 10];

    const equalRisk = analyzer.calculateConcentrationRisk(equalWeights);
    const concentratedRisk = analyzer.calculateConcentrationRisk(concentratedWeights);

    expect(concentratedRisk).toBeGreaterThan(equalRisk);
    expect(equalRisk).toBeCloseTo(0.25, 2); // 1/N for equal weights
  });
});

describe('PortfolioOptimizer', () => {
  const optimizer = new PortfolioOptimizer();

  it('should create equal weight allocation', () => {
    const symbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
    const result = optimizer.equalWeight(symbols);

    expect(result.method).toBe('equal-weight');
    expect(result.allocation).toHaveLength(3);
    expect(result.allocation[0].weight).toBeCloseTo(33.33, 1);
    expect(result.allocation[1].weight).toBeCloseTo(33.33, 1);
    expect(result.allocation[2].weight).toBeCloseTo(33.33, 1);
  });

  it('should create minimum variance allocation', () => {
    const symbols = ['BTC-USDT', 'ETH-USDT'];
    const covarianceMatrix = [
      [0.04, 0.02], // BTC variance and covariance
      [0.02, 0.09], // ETH covariance and variance
    ];

    const result = optimizer.minimumVariance(symbols, covarianceMatrix);

    expect(result.method).toBe('min-variance');
    expect(result.allocation).toHaveLength(2);
    expect(result.expectedRisk).toBeGreaterThan(0);

    // BTC should have higher weight (lower variance)
    const btcWeight = result.allocation.find(a => a.symbol === 'BTC-USDT')?.weight ?? 0;
    const ethWeight = result.allocation.find(a => a.symbol === 'ETH-USDT')?.weight ?? 0;
    expect(btcWeight).toBeGreaterThan(ethWeight);
  });

  it('should create maximum Sharpe allocation', () => {
    const symbols = ['BTC-USDT', 'ETH-USDT'];
    const expectedReturns = [0.15, 0.20]; // 15% and 20% annual returns
    const covarianceMatrix = [
      [0.04, 0.02],
      [0.02, 0.09],
    ];

    const result = optimizer.maximumSharpe(symbols, expectedReturns, covarianceMatrix, 0.02);

    expect(result.method).toBe('max-sharpe');
    expect(result.allocation).toHaveLength(2);
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });

  it('should create risk parity allocation', () => {
    const symbols = ['BTC-USDT', 'ETH-USDT'];
    const covarianceMatrix = [
      [0.04, 0.02],
      [0.02, 0.09],
    ];

    const result = optimizer.riskParity(symbols, covarianceMatrix);

    expect(result.method).toBe('risk-parity');
    expect(result.allocation).toHaveLength(2);
    expect(result.diversificationRatio).toBeGreaterThan(0);

    // Weights should sum to 100%
    const totalWeight = result.allocation.reduce((sum, a) => sum + a.weight, 0);
    expect(totalWeight).toBeCloseTo(100, 1);
  });

  it('should apply weight constraints', () => {
    const symbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
    const constraints = {
      minWeight: 20,
      maxWeight: 50,
    };

    const result = optimizer.equalWeight(symbols, constraints);

    result.allocation.forEach(asset => {
      expect(asset.weight).toBeGreaterThanOrEqual(20);
      expect(asset.weight).toBeLessThanOrEqual(50);
    });
  });
});

describe('RebalancingEngine', () => {
  const engine = new RebalancingEngine();

  const strategy: AllocationStrategy = {
    id: 'test-strategy',
    name: 'Test Strategy',
    assets: [
      { symbol: 'BTC-USDT', targetWeight: 60, minWeight: 50, maxWeight: 70 },
      { symbol: 'ETH-USDT', targetWeight: 40, minWeight: 30, maxWeight: 50 },
    ],
    rebalanceThreshold: 10,
    rebalanceFrequency: 'weekly',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should detect when threshold-based rebalancing is needed', () => {
    const snapshot = {
      totalValue: 100000,
      assets: [
        { symbol: 'BTC-USDT', quantity: 1, value: 75000, weight: 75, targetWeight: 60, drift: 15 },
        { symbol: 'ETH-USDT', quantity: 10, value: 25000, weight: 25, targetWeight: 40, drift: -15 },
      ],
      cash: 0,
      timestamp: new Date(),
    };

    const thresholdStrategy = { ...strategy, rebalanceFrequency: 'threshold' as const };
    const result = engine.shouldRebalance(thresholdStrategy, snapshot);

    expect(result.needed).toBe(true);
    expect(result.reason).toContain('drift');
  });

  it('should detect when periodic rebalancing is needed', () => {
    const snapshot = {
      totalValue: 100000,
      assets: [
        { symbol: 'BTC-USDT', quantity: 1, value: 60000, weight: 60 },
        { symbol: 'ETH-USDT', quantity: 10, value: 40000, weight: 40 },
      ],
      cash: 0,
      timestamp: new Date(),
    };

    const lastRebalance = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
    const result = engine.shouldRebalance(strategy, snapshot, lastRebalance);

    expect(result.needed).toBe(true);
    expect(result.reason).toContain('weekly');
  });

  it('should create rebalancing plan', () => {
    const snapshot = {
      totalValue: 100000,
      assets: [
        { symbol: 'BTC-USDT', quantity: 1, value: 75000, weight: 75 },
        { symbol: 'ETH-USDT', quantity: 10, value: 25000, weight: 25 },
      ],
      cash: 0,
      timestamp: new Date(),
    };

    const config: RebalanceConfig = {
      enabled: true,
      frequency: 'weekly',
      thresholdPct: 10,
      minTradeValue: 100,
      maxTurnoverPct: 50,
      considerTaxes: false,
      considerTransactionCosts: true,
      transactionCostPct: 0.1,
    };

    const plan = engine.createRebalancePlan(strategy, snapshot, config);

    expect(plan.strategyId).toBe(strategy.id);
    expect(plan.trades.length).toBeGreaterThan(0);
    expect(plan.estimatedCost).toBeGreaterThan(0);
    expect(plan.status).toBe('PENDING');
  });
});

describe('PortfolioManager', () => {
  const manager = new PortfolioManager();

  it('should get portfolio snapshot', () => {
    const positions = [
      { symbol: 'BTC-USDT', quantity: 1, averagePrice: 40000, currentPrice: 50000 },
      { symbol: 'ETH-USDT', quantity: 10, averagePrice: 2000, currentPrice: 2500 },
    ];

    const snapshot = manager.getPortfolioSnapshot(positions, 10000);

    expect(snapshot.totalValue).toBe(85000);
    expect(snapshot.assets).toHaveLength(2);
  });

  it('should validate allocation strategy', () => {
    const validStrategy: AllocationStrategy = {
      id: 'valid',
      name: 'Valid Strategy',
      assets: [
        { symbol: 'BTC-USDT', targetWeight: 60, minWeight: 50, maxWeight: 70 },
        { symbol: 'ETH-USDT', targetWeight: 40, minWeight: 30, maxWeight: 50 },
      ],
      rebalanceThreshold: 10,
      rebalanceFrequency: 'weekly',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = manager.validateStrategy(validStrategy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid allocation strategy', () => {
    const invalidStrategy: AllocationStrategy = {
      id: 'invalid',
      name: 'Invalid Strategy',
      assets: [
        { symbol: 'BTC-USDT', targetWeight: 70, minWeight: 50, maxWeight: 70 },
        { symbol: 'ETH-USDT', targetWeight: 40, minWeight: 30, maxWeight: 50 },
      ],
      rebalanceThreshold: 10,
      rebalanceFrequency: 'weekly',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = manager.validateStrategy(invalidStrategy);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Total weight');
  });

  it('should optimize allocation', () => {
    const symbols = ['BTC-USDT', 'ETH-USDT'];
    const result = manager.optimizeAllocation('equal-weight', symbols);

    expect(result.allocation).toHaveLength(2);
    expect(result.method).toBe('equal-weight');
  });
});
