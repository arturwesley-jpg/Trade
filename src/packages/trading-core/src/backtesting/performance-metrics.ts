/**
 * Performance Metrics Calculator
 * Calculates comprehensive performance metrics for backtest results
 */

import type { BacktestTrade } from "./backtest-engine.js";

export interface PerformanceMetrics {
  // Return metrics
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;

  // Trade metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;

  // Risk metrics
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;

  // Duration metrics
  avgTradeDuration: number; // milliseconds
  avgWinDuration: number;
  avgLossDuration: number;

  // Streak metrics
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  // Monthly/Yearly returns
  monthlyReturns: Array<{ month: string; return: number }>;
  yearlyReturns: Array<{ year: number; return: number }>;

  // Risk/Reward
  avgRiskRewardRatio: number;
  expectancy: number; // Average profit per trade
}

export class PerformanceMetricsCalculator {
  /**
   * Calculate comprehensive performance metrics
   */
  static calculate(
    trades: BacktestTrade[],
    equity: number[],
    timestamps: number[],
    initialCapital: number
  ): PerformanceMetrics {
    const finalCapital = equity[equity.length - 1] || initialCapital;
    const totalReturn = finalCapital - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;

    // Calculate annualized return
    const durationMs = timestamps[timestamps.length - 1] - timestamps[0];
    const durationYears = durationMs / (365.25 * 24 * 60 * 60 * 1000);
    const annualizedReturn = durationYears > 0
      ? (Math.pow(finalCapital / initialCapital, 1 / durationYears) - 1) * 100
      : 0;

    // Trade metrics
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;

    // Risk metrics
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown(equity, initialCapital);
    const sharpeRatio = this.calculateSharpeRatio(equity);
    const sortinoRatio = this.calculateSortinoRatio(equity);
    const calmarRatio = maxDrawdownPercent > 0 ? annualizedReturn / maxDrawdownPercent : 0;

    // Duration metrics
    const avgTradeDuration = trades.length > 0
      ? trades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / trades.length
      : 0;

    const avgWinDuration = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / winningTrades.length
      : 0;

    const avgLossDuration = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / losingTrades.length
      : 0;

    // Streak metrics
    const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateStreaks(trades);

    // Monthly/Yearly returns
    const monthlyReturns = this.calculateMonthlyReturns(equity, timestamps);
    const yearlyReturns = this.calculateYearlyReturns(equity, timestamps);

    // Risk/Reward
    const avgRiskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const expectancy = trades.length > 0 ? totalReturn / trades.length : 0;

    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown,
      maxDrawdownPercent,
      avgTradeDuration,
      avgWinDuration,
      avgLossDuration,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      monthlyReturns,
      yearlyReturns,
      avgRiskRewardRatio,
      expectancy
    };
  }

  private static calculateMaxDrawdown(equity: number[], initialCapital: number): {
    maxDrawdown: number;
    maxDrawdownPercent: number;
  } {
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peak = initialCapital;

    for (const eq of equity) {
      if (eq > peak) {
        peak = eq;
      }
      const drawdown = peak - eq;
      const drawdownPercent = (drawdown / peak) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  private static calculateSharpeRatio(equity: number[]): number {
    if (equity.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  }

  private static calculateSortinoRatio(equity: number[]): number {
    if (equity.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downside = returns.filter(r => r < 0);

    if (downside.length === 0) return avgReturn > 0 ? Infinity : 0;

    const downsideVariance = downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length;
    const downsideStdDev = Math.sqrt(downsideVariance);

    return downsideStdDev > 0 ? (avgReturn / downsideStdDev) * Math.sqrt(252) : 0;
  }

  private static calculateStreaks(trades: BacktestTrade[]): {
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
  } {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
      }
    }

    return { maxConsecutiveWins, maxConsecutiveLosses };
  }

  private static calculateMonthlyReturns(
    equity: number[],
    timestamps: number[]
  ): Array<{ month: string; return: number }> {
    const monthlyData = new Map<string, { start: number; end: number }>();

    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i]);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { start: equity[i], end: equity[i] });
      } else {
        monthlyData.get(monthKey)!.end = equity[i];
      }
    }

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      return: ((data.end - data.start) / data.start) * 100
    }));
  }

  private static calculateYearlyReturns(
    equity: number[],
    timestamps: number[]
  ): Array<{ year: number; return: number }> {
    const yearlyData = new Map<number, { start: number; end: number }>();

    for (let i = 0; i < timestamps.length; i++) {
      const year = new Date(timestamps[i]).getFullYear();

      if (!yearlyData.has(year)) {
        yearlyData.set(year, { start: equity[i], end: equity[i] });
      } else {
        yearlyData.get(year)!.end = equity[i];
      }
    }

    return Array.from(yearlyData.entries()).map(([year, data]) => ({
      year,
      return: ((data.end - data.start) / data.start) * 100
    }));
  }
}
