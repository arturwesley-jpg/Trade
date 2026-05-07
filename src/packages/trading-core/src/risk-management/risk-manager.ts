/**
 * Unified Risk Manager
 *
 * Central risk management system that coordinates:
 * - Position sizing
 * - Risk limits enforcement
 * - Drawdown monitoring
 * - Portfolio risk analysis
 */

import { PositionSizer, type PositionSizingConfig, type PositionSizeInput } from '../risk/position-sizer.js';
import { VaRCalculator, type VaRConfig } from '../risk/var-calculator.js';
import { DrawdownMonitor, type DrawdownConfig } from '../risk/drawdown-monitor.js';
import { RiskLimitsEnforcer, type RiskLimitsConfig, type Position as RiskPosition } from '../risk/risk-limits.js';
import type {
  RiskMetricsSnapshot,
  RiskLimitsConfiguration,
  TradeRiskCheck,
  PositionSizingRecommendation,
  RiskAlert
} from './types.js';

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  value: number;
  stopLoss?: number;
  leverage: number;
  pnl: number;
  pnlPct: number;
  sector?: string;
}

export interface TradeRequest {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  quantity?: number; // Optional, can be calculated
  leverage?: number;
  sector?: string;
}

export interface RiskManagerConfig {
  accountBalance: number;
  positionSizing: PositionSizingConfig;
  riskLimits: RiskLimitsConfig;
  drawdown: DrawdownConfig;
}

export class RiskManager {
  private accountBalance: number;
  private positionSizer: PositionSizer;
  private varCalculator: VaRCalculator;
  private drawdownMonitor: DrawdownMonitor;
  private limitsEnforcer: RiskLimitsEnforcer;
  private alerts: RiskAlert[] = [];

  constructor(config: RiskManagerConfig) {
    this.accountBalance = config.accountBalance;
    this.positionSizer = new PositionSizer();
    this.varCalculator = new VaRCalculator();
    this.drawdownMonitor = new DrawdownMonitor(config.drawdown, config.accountBalance);
    this.limitsEnforcer = new RiskLimitsEnforcer(config.riskLimits, config.accountBalance);
  }

  /**
   * Get current risk metrics snapshot
   */
  getRiskMetrics(
    positions: Position[],
    historicalReturns: number[]
  ): RiskMetricsSnapshot {
    // Calculate portfolio metrics
    const portfolioMetrics = this.limitsEnforcer.calculatePortfolioMetrics(
      this.convertToRiskPositions(positions)
    );

    // Calculate VaR
    const varConfig: VaRConfig = {
      confidenceLevel: 0.95,
      timeHorizon: 1,
      portfolioValue: this.accountBalance
    };
    const varResult = this.varCalculator.calculateHistoricalVaR(varConfig, historicalReturns);

    // Calculate CVaR
    const cvarConfig: VaRConfig = {
      confidenceLevel: 0.95,
      timeHorizon: 1,
      portfolioValue: this.accountBalance
    };
    const sortedReturns = [...historicalReturns].sort((a, b) => a - b);
    const cvarIndex = Math.floor((1 - 0.95) * sortedReturns.length);
    const tailReturns = sortedReturns.slice(0, cvarIndex + 1);
    const avgTailReturn = tailReturns.length > 0
      ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
      : 0;
    const cvar = Math.abs((avgTailReturn / 100) * this.accountBalance);

    // Calculate Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(historicalReturns);

    // Get drawdown info
    const drawdownState = this.drawdownMonitor.getState();

    // Calculate max drawdown from history
    const maxDrawdownStats = this.drawdownMonitor.calculateMaxDrawdown(30);

    return {
      portfolioValue: this.accountBalance,
      totalExposure: portfolioMetrics.totalValue,
      leverage: portfolioMetrics.totalLeverage,
      var: varResult.varAmount,
      cvar: this.round(cvar, 2),
      sharpeRatio,
      maxDrawdown: maxDrawdownStats.maxDrawdownPct,
      currentDrawdown: drawdownState.currentDrawdownPct,
      riskPerTrade: portfolioMetrics.totalRisk / Math.max(positions.length, 1),
      portfolioHeat: portfolioMetrics.portfolioHeat,
      dailyPnL: portfolioMetrics.dailyPnL,
      dailyPnLPct: portfolioMetrics.dailyPnLPct,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current risk limits configuration
   */
  getRiskLimits(): RiskLimitsConfiguration {
    const config = (this.limitsEnforcer as any).config as RiskLimitsConfig;
    const drawdownConfig = (this.drawdownMonitor as any).config as DrawdownConfig;

    return {
      maxRiskPerTrade: config.maxRiskPerTrade,
      maxPositionSize: config.maxPositionSize,
      maxDailyLoss: config.maxDailyLoss,
      maxDailyLossPct: config.maxDailyLossPct,
      maxDailyTrades: config.maxDailyTrades,
      maxPortfolioHeat: config.maxPortfolioHeat,
      maxLeverage: config.maxLeverage,
      maxDrawdown: drawdownConfig.maxDrawdown,
      maxAssetExposure: config.maxAssetExposure,
      maxSectorExposure: config.maxSectorExposure,
      maxCorrelatedExposure: config.maxCorrelatedExposure,
      warningDrawdown: drawdownConfig.warningDrawdown,
      positionReductionStart: drawdownConfig.positionReductionStart,
      positionReductionRate: drawdownConfig.positionReductionRate
    };
  }

  /**
   * Update risk limits configuration
   */
  updateRiskLimits(limits: Partial<RiskLimitsConfiguration>): void {
    const config = (this.limitsEnforcer as any).config as RiskLimitsConfig;
    const drawdownConfig = (this.drawdownMonitor as any).config as DrawdownConfig;

    // Update limits enforcer config
    if (limits.maxRiskPerTrade !== undefined) config.maxRiskPerTrade = limits.maxRiskPerTrade;
    if (limits.maxPositionSize !== undefined) config.maxPositionSize = limits.maxPositionSize;
    if (limits.maxDailyLoss !== undefined) config.maxDailyLoss = limits.maxDailyLoss;
    if (limits.maxDailyLossPct !== undefined) config.maxDailyLossPct = limits.maxDailyLossPct;
    if (limits.maxDailyTrades !== undefined) config.maxDailyTrades = limits.maxDailyTrades;
    if (limits.maxPortfolioHeat !== undefined) config.maxPortfolioHeat = limits.maxPortfolioHeat;
    if (limits.maxLeverage !== undefined) config.maxLeverage = limits.maxLeverage;
    if (limits.maxAssetExposure !== undefined) config.maxAssetExposure = limits.maxAssetExposure;
    if (limits.maxSectorExposure !== undefined) config.maxSectorExposure = limits.maxSectorExposure;
    if (limits.maxCorrelatedExposure !== undefined) config.maxCorrelatedExposure = limits.maxCorrelatedExposure;

    // Update drawdown config
    if (limits.maxDrawdown !== undefined) drawdownConfig.maxDrawdown = limits.maxDrawdown;
    if (limits.warningDrawdown !== undefined) drawdownConfig.warningDrawdown = limits.warningDrawdown;
    if (limits.positionReductionStart !== undefined) drawdownConfig.positionReductionStart = limits.positionReductionStart;
    if (limits.positionReductionRate !== undefined) drawdownConfig.positionReductionRate = limits.positionReductionRate;
  }

  /**
   * Check if a trade passes all risk rules
   */
  checkTradeRisk(
    trade: TradeRequest,
    currentPositions: Position[]
  ): TradeRiskCheck {
    // Check if trading is paused due to drawdown
    if (this.drawdownMonitor.isTradingPaused()) {
      return {
        approved: false,
        symbol: trade.symbol,
        side: trade.side,
        positionSize: 0,
        riskAmount: 0,
        riskPercentage: 0,
        checks: [],
        violations: ['Trading paused due to excessive drawdown'],
        warnings: []
      };
    }

    // Calculate position size if not provided
    let quantity = trade.quantity;
    if (!quantity) {
      const sizingInput: PositionSizeInput = {
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        side: trade.side
      };

      const positionSizingConfig: PositionSizingConfig = {
        accountBalance: this.accountBalance,
        riskPerTrade: (this.limitsEnforcer as any).config.maxRiskPerTrade,
        maxPositionSize: (this.limitsEnforcer as any).config.maxPositionSize,
        minPositionSize: 10 // $10 minimum
      };

      const sizeResult = this.positionSizer.calculateFixedFractional(positionSizingConfig, sizingInput);
      quantity = sizeResult.quantity;
    }

    const positionSize = quantity * trade.entryPrice;
    const riskPerUnit = Math.abs(trade.entryPrice - trade.stopLoss);
    const riskAmount = quantity * riskPerUnit;
    const riskPercentage = (riskAmount / this.accountBalance) * 100;

    // Run risk checks
    const tradeForCheck = {
      symbol: trade.symbol,
      side: trade.side,
      quantity,
      price: trade.entryPrice,
      stopLoss: trade.stopLoss,
      timestamp: new Date()
    };

    const checks = this.limitsEnforcer.checkTradeRiskLimits(
      tradeForCheck,
      this.convertToRiskPositions(currentPositions)
    );

    const violations = checks
      .filter(c => !c.passed && c.severity === 'critical')
      .map(c => c.message);

    const warnings = checks
      .filter(c => !c.passed && c.severity === 'warning')
      .map(c => c.message);

    const approved = violations.length === 0;

    // Generate alerts for violations
    if (!approved) {
      this.generateRiskAlert({
        type: 'LIMIT_BREACH',
        severity: 'critical',
        title: 'Trade Risk Check Failed',
        message: `Trade rejected: ${violations.join(', ')}`,
        data: { trade, checks }
      });
    }

    return {
      approved,
      symbol: trade.symbol,
      side: trade.side,
      positionSize: this.round(positionSize, 2),
      riskAmount: this.round(riskAmount, 2),
      riskPercentage: this.round(riskPercentage, 2),
      checks: checks.map(c => ({
        limit: c.limit,
        passed: c.passed,
        current: c.current,
        maximum: c.maximum,
        severity: c.severity,
        message: c.message
      })),
      violations,
      warnings
    };
  }

  /**
   * Get position sizing recommendations
   */
  getPositionSizingRecommendation(
    trade: TradeRequest,
    historicalData?: {
      winRate?: number;
      avgWin?: number;
      avgLoss?: number;
      volatility?: number;
    }
  ): PositionSizingRecommendation {
    const positionSizingConfig: PositionSizingConfig = {
      accountBalance: this.accountBalance,
      riskPerTrade: (this.limitsEnforcer as any).config.maxRiskPerTrade,
      maxPositionSize: (this.limitsEnforcer as any).config.maxPositionSize,
      minPositionSize: 10
    };

    const sizingInput: PositionSizeInput = {
      symbol: trade.symbol,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      side: trade.side,
      ...historicalData
    };

    // Calculate using all available methods
    const results = this.positionSizer.calculateAllMethods(positionSizingConfig, sizingInput);

    if (results.length === 0) {
      return {
        symbol: trade.symbol,
        method: 'none',
        recommendedSize: 0,
        recommendedQuantity: 0,
        leverage: 0,
        riskAmount: 0,
        riskPercentage: 0,
        reasoning: 'No valid position sizing method available',
        alternatives: []
      };
    }

    // Use fixed fractional as primary recommendation
    const primary = results[0];
    const alternatives = results.slice(1).map(r => ({
      method: r.method,
      size: r.positionSize,
      quantity: r.quantity,
      reasoning: r.reasoning
    }));

    return {
      symbol: trade.symbol,
      method: primary.method,
      recommendedSize: primary.positionSize,
      recommendedQuantity: primary.quantity,
      leverage: primary.leverage,
      riskAmount: primary.riskAmount,
      riskPercentage: primary.riskPercentage,
      reasoning: primary.reasoning,
      alternatives
    };
  }

  /**
   * Update account balance and check drawdown
   */
  updateAccountBalance(newBalance: number): void {
    this.accountBalance = newBalance;
    this.limitsEnforcer.updateAccountBalance(newBalance);

    const drawdownState = this.drawdownMonitor.updateBalance(newBalance);

    // Generate alerts based on drawdown state
    if (drawdownState.status === 'warning') {
      this.generateRiskAlert({
        type: 'DRAWDOWN_WARNING',
        severity: 'medium',
        title: 'Drawdown Warning',
        message: `Portfolio drawdown at ${this.round(drawdownState.currentDrawdownPct, 2)}%`,
        data: { drawdownState }
      });
    } else if (drawdownState.status === 'paused') {
      this.generateRiskAlert({
        type: 'DRAWDOWN_WARNING',
        severity: 'critical',
        title: 'Trading Paused',
        message: `Trading paused due to ${this.round(drawdownState.currentDrawdownPct, 2)}% drawdown`,
        data: { drawdownState }
      });
    }
  }

  /**
   * Record a completed trade
   */
  recordTrade(trade: TradeRequest): void {
    const tradeRecord = {
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity || 0,
      price: trade.entryPrice,
      stopLoss: trade.stopLoss,
      timestamp: new Date()
    };

    this.limitsEnforcer.recordTrade(tradeRecord);
  }

  /**
   * Reset daily counters (call at start of trading day)
   */
  resetDailyCounters(): void {
    this.limitsEnforcer.resetDailyCounters();
  }

  /**
   * Get recent risk alerts
   */
  getAlerts(limit: number = 10): RiskAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): RiskAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Check if trading is currently allowed
   */
  isTradingAllowed(): boolean {
    return !this.drawdownMonitor.isTradingPaused();
  }

  /**
   * Get drawdown state
   */
  getDrawdownState() {
    return this.drawdownMonitor.getState();
  }

  /**
   * Get position reduction factor (for drawdown protection)
   */
  getPositionReductionFactor(): number {
    return this.drawdownMonitor.getPositionReductionFactor();
  }

  private generateRiskAlert(alert: Omit<RiskAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const newAlert: RiskAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alert
    };

    this.alerts.push(newAlert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  private convertToRiskPositions(positions: Position[]): RiskPosition[] {
    return positions.map(p => ({
      symbol: p.symbol,
      value: p.value,
      entryPrice: p.entryPrice,
      currentPrice: p.currentPrice,
      stopLoss: p.stopLoss || p.entryPrice * (p.side === 'LONG' ? 0.95 : 1.05),
      quantity: p.quantity,
      side: p.side,
      leverage: p.leverage,
      sector: p.sector
    }));
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualize (assuming daily returns)
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);

    return (annualizedReturn - riskFreeRate) / annualizedStdDev;
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
