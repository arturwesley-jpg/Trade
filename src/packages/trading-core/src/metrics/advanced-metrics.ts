/**
 * Advanced Trading Metrics
 *
 * Provides comprehensive trading performance analysis including:
 * - Risk-adjusted returns (Sharpe, Sortino, Calmar ratios)
 * - Drawdown analysis (max drawdown, current drawdown)
 * - Win/loss statistics (win rate, profit factor, expectancy)
 * - Trade quality metrics (average win/loss, largest trades)
 * - Time-based analysis with period filters
 */

import type { Trade } from "@trade/shared";

/**
 * Time period filter for metrics calculation
 */
export type MetricsPeriod = "1d" | "7d" | "30d" | "90d" | "all";

/**
 * Trade metrics extracted from a single trade
 */
export interface TradeMetrics {
  pnl: number;
  pnlPercentage: number;
  openedAt: string;
  closedAt: string;
}

/**
 * Advanced performance metrics for a trading strategy
 */
export interface AdvancedMetrics {
  // Period information
  period: MetricsPeriod;
  startDate: string;
  endDate: string;

  // Returns
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  annualizedReturnPct: number;

  // Risk-adjusted returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;

  // Drawdown analysis
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  currentDrawdownPct: number;

  // Win/Loss statistics
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  averageWinPct: number;
  averageLossPct: number;
  largestWin: number;
  largestLoss: number;

  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  expectancy: number;
  expectancyPct: number;

  // Streaks
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;

  // Time-based
  averageHoldingTimeHours: number;
  tradingDays: number;
}

/**
 * Configuration for advanced metrics calculation
 */
export interface AdvancedMetricsConfig {
  /** Annual risk-free rate for Sharpe ratio (default: 0.02 = 2%) */
  riskFreeRate?: number;
  /** Target return for Sortino ratio (default: 0) */
  targetReturn?: number;
  /** Initial capital for calculations (default: 10000) */
  initialCapital?: number;
}

/**
 * Calculator for advanced trading metrics
 */
export class AdvancedMetricsCalculator {
  private readonly riskFreeRate: number;
  private readonly targetReturn: number;
  private readonly initialCapital: number;

  constructor(config: AdvancedMetricsConfig = {}) {
    this.riskFreeRate = config.riskFreeRate ?? 0.02;
    this.targetReturn = config.targetReturn ?? 0;
    this.initialCapital = config.initialCapital ?? 10_000;
  }

  /**
   * Calculate advanced metrics for a set of trades within a time period
   *
   * @param trades - Array of completed trades
   * @param period - Time period filter (1d, 7d, 30d, 90d, all)
   * @returns Advanced metrics for the specified period
   */
  calculate(trades: Trade[], period: MetricsPeriod = "all"): AdvancedMetrics {
    const filteredTrades = this.filterTradesByPeriod(trades, period);
    const tradeMetrics = this.extractTradeMetrics(filteredTrades);

    if (tradeMetrics.length === 0) {
      return this.emptyMetrics(period);
    }

    const { startDate, endDate } = this.getPeriodDates(tradeMetrics);

    // Calculate returns
    const totalReturn = tradeMetrics.reduce((sum, t) => sum + t.pnl, 0);
    const totalReturnPct = (totalReturn / this.initialCapital) * 100;

    const tradingDays = this.calculateTradingDays(startDate, endDate);
    const annualizedReturn = this.annualizeReturn(totalReturn, tradingDays);
    const annualizedReturnPct = (annualizedReturn / this.initialCapital) * 100;

    // Calculate risk-adjusted returns
    const returns = tradeMetrics.map(t => t.pnlPercentage);
    const sharpeRatio = this.calculateSharpeRatio(returns, tradingDays);
    const sortinoRatio = this.calculateSortinoRatio(returns, tradingDays);

    // Calculate drawdown
    const { maxDrawdown, maxDrawdownPct, currentDrawdown, currentDrawdownPct } =
      this.calculateDrawdown(tradeMetrics);

    const calmarRatio = maxDrawdownPct !== 0
      ? annualizedReturnPct / Math.abs(maxDrawdownPct)
      : 0;

    // Calculate win/loss statistics
    const winningTrades = tradeMetrics.filter(t => t.pnl > 0);
    const losingTrades = tradeMetrics.filter(t => t.pnl < 0);

    const winRate = (winningTrades.length / tradeMetrics.length) * 100;

    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses !== 0 ? totalWins / totalLosses : 0;

    const averageWin = winningTrades.length > 0
      ? totalWins / winningTrades.length
      : 0;
    const averageLoss = losingTrades.length > 0
      ? totalLosses / losingTrades.length
      : 0;

    const averageWinPct = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnlPercentage, 0) / winningTrades.length
      : 0;
    const averageLossPct = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnlPercentage), 0) / losingTrades.length
      : 0;

    const largestWin = winningTrades.length > 0
      ? Math.max(...winningTrades.map(t => t.pnl))
      : 0;
    const largestLoss = losingTrades.length > 0
      ? Math.min(...losingTrades.map(t => t.pnl))
      : 0;

    // Calculate expectancy
    const expectancy = (winRate / 100) * averageWin - ((100 - winRate) / 100) * averageLoss;
    const expectancyPct = (winRate / 100) * averageWinPct - ((100 - winRate) / 100) * averageLossPct;

    // Calculate streaks
    const { currentStreak, longestWinStreak, longestLossStreak } =
      this.calculateStreaks(tradeMetrics);

    // Calculate average holding time
    const averageHoldingTimeHours = this.calculateAverageHoldingTime(tradeMetrics);

    return {
      period,
      startDate,
      endDate,
      totalReturn: this.round(totalReturn, 2),
      totalReturnPct: this.round(totalReturnPct, 2),
      annualizedReturn: this.round(annualizedReturn, 2),
      annualizedReturnPct: this.round(annualizedReturnPct, 2),
      sharpeRatio: this.round(sharpeRatio, 3),
      sortinoRatio: this.round(sortinoRatio, 3),
      calmarRatio: this.round(calmarRatio, 3),
      maxDrawdown: this.round(maxDrawdown, 2),
      maxDrawdownPct: this.round(maxDrawdownPct, 2),
      currentDrawdown: this.round(currentDrawdown, 2),
      currentDrawdownPct: this.round(currentDrawdownPct, 2),
      winRate: this.round(winRate, 2),
      profitFactor: this.round(profitFactor, 2),
      averageWin: this.round(averageWin, 2),
      averageLoss: this.round(averageLoss, 2),
      averageWinPct: this.round(averageWinPct, 2),
      averageLossPct: this.round(averageLossPct, 2),
      largestWin: this.round(largestWin, 2),
      largestLoss: this.round(largestLoss, 2),
      totalTrades: tradeMetrics.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      expectancy: this.round(expectancy, 2),
      expectancyPct: this.round(expectancyPct, 2),
      currentStreak,
      longestWinStreak,
      longestLossStreak,
      averageHoldingTimeHours: this.round(averageHoldingTimeHours, 2),
      tradingDays
    };
  }

  /**
   * Filter trades by time period
   */
  private filterTradesByPeriod(trades: Trade[], period: MetricsPeriod): Trade[] {
    if (period === "all") {
      return trades.filter(t => t.status === "CLOSED" && t.closedAt);
    }

    const now = new Date();
    const periodMs = this.getPeriodMilliseconds(period);
    const cutoffDate = new Date(now.getTime() - periodMs);

    return trades.filter(t => {
      if (t.status !== "CLOSED" || !t.closedAt) return false;
      const closedDate = new Date(t.closedAt);
      return closedDate >= cutoffDate;
    });
  }

  /**
   * Get period in milliseconds
   */
  private getPeriodMilliseconds(period: MetricsPeriod): number {
    const dayMs = 24 * 60 * 60 * 1000;
    switch (period) {
      case "1d": return dayMs;
      case "7d": return 7 * dayMs;
      case "30d": return 30 * dayMs;
      case "90d": return 90 * dayMs;
      default: return 0;
    }
  }

  /**
   * Extract trade metrics from trades
   */
  private extractTradeMetrics(trades: Trade[]): TradeMetrics[] {
    return trades
      .filter(t => t.status === "CLOSED" && t.closedAt && t.pnlUsdt !== undefined)
      .map(t => ({
        pnl: t.pnlUsdt!,
        pnlPercentage: ((t.pnlUsdt! / t.marginUsdt) * 100),
        openedAt: t.openedAt,
        closedAt: t.closedAt!
      }));
  }

  /**
   * Get start and end dates from trade metrics
   */
  private getPeriodDates(tradeMetrics: TradeMetrics[]): { startDate: string; endDate: string } {
    const dates = tradeMetrics.map(t => new Date(t.closedAt).getTime());
    return {
      startDate: new Date(Math.min(...dates)).toISOString(),
      endDate: new Date(Math.max(...dates)).toISOString()
    };
  }

  /**
   * Calculate number of trading days
   */
  private calculateTradingDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, diffMs / (24 * 60 * 60 * 1000));
  }

  /**
   * Annualize return based on trading days
   */
  private annualizeReturn(totalReturn: number, tradingDays: number): number {
    if (tradingDays === 0) return 0;
    return totalReturn * (365 / tradingDays);
  }

  /**
   * Calculate Sharpe Ratio
   * Sharpe = (Mean Return - Risk Free Rate) / Standard Deviation of Returns
   */
  private calculateSharpeRatio(returns: number[], tradingDays: number): number {
    if (returns.length === 0) return 0;

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = this.calculateStdDev(returns);

    if (stdDev === 0) return 0;

    // Annualize
    const annualizedMean = meanReturn * (365 / tradingDays);
    const annualizedStdDev = stdDev * Math.sqrt(365 / tradingDays);

    return (annualizedMean - this.riskFreeRate * 100) / annualizedStdDev;
  }

  /**
   * Calculate Sortino Ratio
   * Sortino = (Mean Return - Target Return) / Downside Deviation
   */
  private calculateSortinoRatio(returns: number[], tradingDays: number): number {
    if (returns.length === 0) return 0;

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < this.targetReturn);
    const downsideStdDev = this.calculateStdDev(downsideReturns);

    if (downsideStdDev === 0) return 0;

    // Annualize
    const annualizedMean = meanReturn * (365 / tradingDays);
    const annualizedDownsideStdDev = downsideStdDev * Math.sqrt(365 / tradingDays);

    return (annualizedMean - this.targetReturn * 100) / annualizedDownsideStdDev;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate drawdown metrics
   */
  private calculateDrawdown(tradeMetrics: TradeMetrics[]): {
    maxDrawdown: number;
    maxDrawdownPct: number;
    currentDrawdown: number;
    currentDrawdownPct: number;
  } {
    let capital = this.initialCapital;
    let peak = capital;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;

    for (const trade of tradeMetrics) {
      capital += trade.pnl;

      if (capital > peak) {
        peak = capital;
      }

      const drawdown = peak - capital;
      const drawdownPct = (drawdown / peak) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPct = drawdownPct;
      }
    }

    const currentDrawdown = peak - capital;
    const currentDrawdownPct = (currentDrawdown / peak) * 100;

    return {
      maxDrawdown,
      maxDrawdownPct,
      currentDrawdown,
      currentDrawdownPct
    };
  }

  /**
   * Calculate win/loss streaks
   */
  private calculateStreaks(tradeMetrics: TradeMetrics[]): {
    currentStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
  } {
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const trade of tradeMetrics) {
      if (trade.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        currentStreak = currentWinStreak;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        currentStreak = -currentLossStreak;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      }
    }

    return {
      currentStreak,
      longestWinStreak,
      longestLossStreak
    };
  }

  /**
   * Calculate average holding time in hours
   */
  private calculateAverageHoldingTime(tradeMetrics: TradeMetrics[]): number {
    if (tradeMetrics.length === 0) return 0;

    const totalHours = tradeMetrics.reduce((sum, trade) => {
      const opened = new Date(trade.openedAt).getTime();
      const closed = new Date(trade.closedAt).getTime();
      const hours = (closed - opened) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    return totalHours / tradeMetrics.length;
  }

  /**
   * Return empty metrics for periods with no trades
   */
  private emptyMetrics(period: MetricsPeriod): AdvancedMetrics {
    const now = new Date().toISOString();
    return {
      period,
      startDate: now,
      endDate: now,
      totalReturn: 0,
      totalReturnPct: 0,
      annualizedReturn: 0,
      annualizedReturnPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      currentDrawdown: 0,
      currentDrawdownPct: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      averageWinPct: 0,
      averageLossPct: 0,
      largestWin: 0,
      largestLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      expectancy: 0,
      expectancyPct: 0,
      currentStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      averageHoldingTimeHours: 0,
      tradingDays: 0
    };
  }

  /**
   * Round number to specified decimal places
   */
  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
