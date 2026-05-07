/**
 * Portfolio Risk Analyzer
 *
 * Comprehensive portfolio risk analysis including:
 * - Diversification metrics
 * - Correlation analysis
 * - Stress testing
 * - Beta calculation
 */

import { CorrelationAnalyzer, type CorrelationMatrix, type DiversificationMetrics } from '../risk/correlation-analyzer.js';
import { VaRCalculator, type VaRConfig } from '../risk/var-calculator.js';
import type { PortfolioRiskAnalysis, StressTestScenario, StressTestResult } from './types.js';

export interface PortfolioPosition {
  symbol: string;
  value: number;
  weight: number;
  returns: number[]; // Historical returns
  sector?: string;
}

export interface BenchmarkData {
  returns: number[];
}

export class PortfolioRiskAnalyzer {
  private correlationAnalyzer: CorrelationAnalyzer;
  private varCalculator: VaRCalculator;

  constructor() {
    this.correlationAnalyzer = new CorrelationAnalyzer();
    this.varCalculator = new VaRCalculator();
  }

  /**
   * Perform comprehensive portfolio risk analysis
   */
  analyzePortfolio(
    positions: PortfolioPosition[],
    portfolioValue: number,
    benchmarkData?: BenchmarkData
  ): PortfolioRiskAnalysis {
    if (positions.length === 0) {
      return this.emptyAnalysis();
    }

    // Calculate correlation matrix
    const correlationMatrix = this.correlationAnalyzer.calculateCorrelationMatrix(
      positions.map(p => ({ symbol: p.symbol, returns: p.returns }))
    );

    // Calculate diversification metrics
    const weights = positions.map(p => p.weight);
    const diversificationMetrics = this.correlationAnalyzer.calculateDiversificationMetrics(
      correlationMatrix,
      weights
    );

    // Calculate portfolio volatility
    const portfolioReturns = this.calculatePortfolioReturns(positions);
    const portfolioVolatility = this.calculateVolatility(portfolioReturns);

    // Calculate beta (if benchmark provided)
    let portfolioBeta = 0;
    if (benchmarkData) {
      const correlation = this.correlationAnalyzer.calculateCorrelation(
        portfolioReturns,
        benchmarkData.returns
      );
      const benchmarkVolatility = this.calculateVolatility(benchmarkData.returns);
      portfolioBeta = benchmarkVolatility !== 0
        ? (correlation * portfolioVolatility) / benchmarkVolatility
        : 0;
    }

    // Calculate VaR metrics
    const varConfig: VaRConfig = {
      confidenceLevel: 0.95,
      timeHorizon: 1,
      portfolioValue
    };

    const var95Result = this.varCalculator.calculateHistoricalVaR(varConfig, portfolioReturns);
    const var99Result = this.varCalculator.calculateHistoricalVaR(
      { ...varConfig, confidenceLevel: 0.99 },
      portfolioReturns
    );

    // Calculate CVaR (95%)
    const sortedReturns = [...portfolioReturns].sort((a, b) => a - b);
    const cvarIndex = Math.floor((1 - 0.95) * sortedReturns.length);
    const tailReturns = sortedReturns.slice(0, cvarIndex + 1);
    const avgTailReturn = tailReturns.length > 0
      ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
      : 0;
    const cvar95 = Math.abs((avgTailReturn / 100) * portfolioValue);

    // Run stress tests
    const stressScenarios = this.runStressTests(positions, portfolioValue);

    // Calculate diversification score (0-100)
    const diversificationScore = this.calculateDiversificationScore(diversificationMetrics);

    return {
      diversificationScore,
      effectiveNumberOfAssets: diversificationMetrics.effectiveNumberOfAssets,
      concentrationRisk: diversificationMetrics.concentrationRisk,
      correlationMatrix: {
        symbols: correlationMatrix.symbols,
        matrix: correlationMatrix.matrix
      },
      averageCorrelation: diversificationMetrics.averageCorrelation,
      highlyCorrelatedPairs: diversificationMetrics.highlyCorrelatedPairs,
      portfolioVolatility: this.round(portfolioVolatility, 2),
      portfolioBeta: this.round(portfolioBeta, 3),
      var95: var95Result.varAmount,
      var99: var99Result.varAmount,
      cvar95: this.round(cvar95, 2),
      stressScenarios,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run stress test scenarios on portfolio
   */
  runStressTests(
    positions: PortfolioPosition[],
    portfolioValue: number
  ): { scenario: string; impact: number; impactPct: number }[] {
    const scenarios: StressTestScenario[] = [
      {
        name: 'Market Crash (-20%)',
        description: 'All positions drop 20%',
        priceChanges: positions.map(p => ({ symbol: p.symbol, changePct: -20 }))
      },
      {
        name: 'Moderate Correction (-10%)',
        description: 'All positions drop 10%',
        priceChanges: positions.map(p => ({ symbol: p.symbol, changePct: -10 }))
      },
      {
        name: 'Flash Crash (-30%)',
        description: 'All positions drop 30%',
        priceChanges: positions.map(p => ({ symbol: p.symbol, changePct: -30 }))
      },
      {
        name: 'Volatility Spike',
        description: 'High volatility with mixed results',
        priceChanges: positions.map((p, i) => ({
          symbol: p.symbol,
          changePct: i % 2 === 0 ? -15 : -5
        }))
      },
      {
        name: 'Sector Rotation',
        description: 'Some sectors up, others down',
        priceChanges: positions.map((p, i) => ({
          symbol: p.symbol,
          changePct: i % 3 === 0 ? 10 : -10
        }))
      }
    ];

    return scenarios.map(scenario => {
      const result = this.calculateStressTestImpact(positions, scenario);
      return {
        scenario: scenario.name,
        impact: result.portfolioChange,
        impactPct: result.portfolioChangePct
      };
    });
  }

  /**
   * Calculate impact of a stress test scenario
   */
  calculateStressTestImpact(
    positions: PortfolioPosition[],
    scenario: StressTestScenario
  ): StressTestResult {
    const currentValue = positions.reduce((sum, p) => sum + p.value, 0);
    let newValue = 0;

    const positionImpacts = positions.map(position => {
      const priceChange = scenario.priceChanges.find(pc => pc.symbol === position.symbol);
      const changePct = priceChange?.changePct || 0;
      const change = position.value * (changePct / 100);
      const positionNewValue = position.value + change;

      newValue += positionNewValue;

      return {
        symbol: position.symbol,
        currentValue: position.value,
        newValue: positionNewValue,
        change,
        changePct
      };
    });

    const portfolioChange = newValue - currentValue;
    const portfolioChangePct = currentValue > 0 ? (portfolioChange / currentValue) * 100 : 0;

    return {
      scenario: scenario.name,
      portfolioValue: this.round(currentValue, 2),
      portfolioChange: this.round(portfolioChange, 2),
      portfolioChangePct: this.round(portfolioChangePct, 2),
      positionImpacts: positionImpacts.map(pi => ({
        ...pi,
        currentValue: this.round(pi.currentValue, 2),
        newValue: this.round(pi.newValue, 2),
        change: this.round(pi.change, 2),
        changePct: this.round(pi.changePct, 2)
      })),
      breachedLimits: []
    };
  }

  /**
   * Calculate portfolio returns from position returns
   */
  private calculatePortfolioReturns(positions: PortfolioPosition[]): number[] {
    if (positions.length === 0) return [];

    // Find the minimum length of returns across all positions
    const minLength = Math.min(...positions.map(p => p.returns.length));
    if (minLength === 0) return [];

    const portfolioReturns: number[] = [];

    for (let i = 0; i < minLength; i++) {
      let weightedReturn = 0;
      for (const position of positions) {
        weightedReturn += position.weight * position.returns[i];
      }
      portfolioReturns.push(weightedReturn);
    }

    return portfolioReturns;
  }

  /**
   * Calculate volatility (standard deviation)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate diversification score (0-100)
   */
  private calculateDiversificationScore(metrics: DiversificationMetrics): number {
    // Score based on:
    // 1. Effective number of assets (40 points)
    // 2. Average correlation (30 points)
    // 3. Concentration risk (30 points)

    // Effective assets score (max 5 assets = 40 points)
    const effectiveAssetsScore = Math.min(metrics.effectiveNumberOfAssets / 5, 1) * 40;

    // Correlation score (lower is better, 0.3 or less = 30 points)
    const correlationScore = Math.max(0, (0.7 - metrics.averageCorrelation) / 0.7) * 30;

    // Concentration risk score
    const concentrationScore = metrics.concentrationRisk === 'low' ? 30
      : metrics.concentrationRisk === 'medium' ? 15
      : 0;

    return this.round(effectiveAssetsScore + correlationScore + concentrationScore, 0);
  }

  private emptyAnalysis(): PortfolioRiskAnalysis {
    return {
      diversificationScore: 0,
      effectiveNumberOfAssets: 0,
      concentrationRisk: 'high',
      correlationMatrix: {
        symbols: [],
        matrix: []
      },
      averageCorrelation: 0,
      highlyCorrelatedPairs: [],
      portfolioVolatility: 0,
      portfolioBeta: 0,
      var95: 0,
      var99: 0,
      cvar95: 0,
      stressScenarios: [],
      timestamp: new Date().toISOString()
    };
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
