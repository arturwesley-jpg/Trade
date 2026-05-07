/**
 * Performance Analytics
 * Calculate trading performance metrics and statistics
 */

import type { TradeHistory, PerformanceMetrics, DailyMetrics, WeeklyMetrics, MonthlyMetrics } from "./types.js";

export class PerformanceAnalytics {
  /**
   * Calculate comprehensive performance metrics
   */
  calculateMetrics(trades: TradeHistory[], initialBalance: number = 10000): PerformanceMetrics {
    if (trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const { maxDrawdown, maxDrawdownPercentage } = this.calculateMaxDrawdown(trades, initialBalance);
    const sharpeRatio = this.calculateSharpeRatio(trades);
    const averageRiskReward = this.calculateAverageRiskReward(trades);
    const averageTradeDuration = trades.reduce((sum, t) => sum + t.duration, 0) / trades.length;

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      totalPnL,
      totalPnLPercentage: (totalPnL / initialBalance) * 100,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercentage,
      averageRiskReward,
      averageTradeDuration,
      dailyMetrics: this.calculateDailyMetrics(trades),
      weeklyMetrics: this.calculateWeeklyMetrics(trades),
      monthlyMetrics: this.calculateMonthlyMetrics(trades)
    };
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(trades: TradeHistory[], initialBalance: number): { maxDrawdown: number; maxDrawdownPercentage: number } {
    let balance = initialBalance;
    let peak = initialBalance;
    let maxDrawdown = 0;
    let maxDrawdownPercentage = 0;

    for (const trade of trades) {
      balance += trade.pnl;

      if (balance > peak) {
        peak = balance;
      }

      const drawdown = peak - balance;
      const drawdownPercentage = (drawdown / peak) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercentage = drawdownPercentage;
      }
    }

    return { maxDrawdown, maxDrawdownPercentage };
  }

  /**
   * Calculate Sharpe Ratio
   * Assumes risk-free rate of 0 for simplicity
   */
  private calculateSharpeRatio(trades: TradeHistory[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.pnlPercentage);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  /**
   * Calculate average risk/reward ratio
   */
  private calculateAverageRiskReward(trades: TradeHistory[]): number {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    if (losingTrades.length === 0) return 0;

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0;

    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length);

    return avgLoss > 0 ? avgWin / avgLoss : 0;
  }

  /**
   * Calculate daily metrics
   */
  private calculateDailyMetrics(trades: TradeHistory[]): DailyMetrics[] {
    const dailyMap = new Map<string, TradeHistory[]>();

    for (const trade of trades) {
      const date = new Date(trade.closedAt).toISOString().split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, []);
      }
      dailyMap.get(date)!.push(trade);
    }

    return Array.from(dailyMap.entries()).map(([date, dayTrades]) => {
      const pnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
      const wins = dayTrades.filter(t => t.pnl > 0).length;
      const winRate = (wins / dayTrades.length) * 100;

      return {
        date,
        trades: dayTrades.length,
        pnl,
        winRate
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate weekly metrics
   */
  private calculateWeeklyMetrics(trades: TradeHistory[]): WeeklyMetrics[] {
    const weeklyMap = new Map<string, TradeHistory[]>();

    for (const trade of trades) {
      const date = new Date(trade.closedAt);
      const week = this.getWeekString(date);
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, []);
      }
      weeklyMap.get(week)!.push(trade);
    }

    return Array.from(weeklyMap.entries()).map(([week, weekTrades]) => {
      const pnl = weekTrades.reduce((sum, t) => sum + t.pnl, 0);
      const wins = weekTrades.filter(t => t.pnl > 0).length;
      const winRate = (wins / weekTrades.length) * 100;

      return {
        week,
        trades: weekTrades.length,
        pnl,
        winRate
      };
    }).sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   * Calculate monthly metrics
   */
  private calculateMonthlyMetrics(trades: TradeHistory[]): MonthlyMetrics[] {
    const monthlyMap = new Map<string, TradeHistory[]>();

    for (const trade of trades) {
      const date = new Date(trade.closedAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, []);
      }
      monthlyMap.get(month)!.push(trade);
    }

    return Array.from(monthlyMap.entries()).map(([month, monthTrades]) => {
      const pnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
      const wins = monthTrades.filter(t => t.pnl > 0).length;
      const winRate = (wins / monthTrades.length) * 100;

      return {
        month,
        trades: monthTrades.length,
        pnl,
        winRate
      };
    }).sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Get week string (ISO week)
   */
  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      totalPnLPercentage: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercentage: 0,
      averageRiskReward: 0,
      averageTradeDuration: 0,
      dailyMetrics: [],
      weeklyMetrics: [],
      monthlyMetrics: []
    };
  }
}
