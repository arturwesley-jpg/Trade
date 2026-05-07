import type { Trade } from "@trade/shared";

export interface TradeMetrics {
  pnl: number;
  pnlPercentage: number;
  openedAt: string;
  closedAt: string;
}

export interface PerformanceMetrics {
  // Returns
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  annualizedReturnPct: number;

  // Risk-adjusted returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;

  // Drawdown
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

export interface MetricsCalculatorConfig {
  riskFreeRate?: number; // Annual risk-free rate (default: 0.02 = 2%)
  targetReturn?: number; // Target return for Sortino (default: 0)
  initialCapital?: number; // Starting capital (default: 10000)
}

export class MetricsCalculator {
  private readonly riskFreeRate: number;
  private readonly targetReturn: number;
  private readonly initialCapital: number;

  constructor(config: MetricsCalculatorConfig = {}) {
    this.riskFreeRate = config.riskFreeRate ?? 0.02;
    this.targetReturn = config.targetReturn ?? 0;
    this.initialCapital = config.initialCapital ?? 10_000;
  }

  calculate(trades: TradeMetrics[]): PerformanceMetrics {
    if (trades.length === 0) {
      return this.emptyMetrics();
    }

    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    // Basic statistics
    const totalReturn = sortedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalReturnPct = (totalReturn / this.initialCapital) * 100;

    const winningTrades = sortedTrades.filter(t => t.pnl > 0);
    const losingTrades = sortedTrades.filter(t => t.pnl < 0);

    const winRate = (winningTrades.length / sortedTrades.length) * 100;

    // Win/Loss statistics
    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses === 0 ? (totalWins > 0 ? Infinity : 0) : totalWins / totalLosses;

    const averageWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0;
    const averageLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length
      : 0;

    const averageWinPct = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnlPercentage, 0) / winningTrades.length
      : 0;
    const averageLossPct = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + t.pnlPercentage, 0) / losingTrades.length
      : 0;

    const largestWin = winningTrades.length > 0
      ? Math.max(...winningTrades.map(t => t.pnl))
      : 0;
    const largestLoss = losingTrades.length > 0
      ? Math.min(...losingTrades.map(t => t.pnl))
      : 0;

    // Expectancy
    const expectancy = (winRate / 100) * averageWin + ((100 - winRate) / 100) * averageLoss;
    const expectancyPct = (winRate / 100) * averageWinPct + ((100 - winRate) / 100) * averageLossPct;

    // Equity curve and drawdown
    const equityCurve = this.buildEquityCurve(sortedTrades);
    const { maxDrawdown, maxDrawdownPct, currentDrawdown, currentDrawdownPct } =
      this.calculateDrawdown(equityCurve);

    // Time-based metrics
    const tradingDays = this.calculateTradingDays(sortedTrades);
    const annualizedReturn = this.annualizeReturn(totalReturn, tradingDays);
    const annualizedReturnPct = this.annualizeReturn(totalReturnPct, tradingDays);

    // Risk-adjusted returns
    const returns = sortedTrades.map(t => t.pnlPercentage);
    const sharpeRatio = this.calculateSharpeRatio(returns, tradingDays);
    const sortinoRatio = this.calculateSortinoRatio(returns, tradingDays);
    const calmarRatio = maxDrawdownPct !== 0 ? annualizedReturnPct / Math.abs(maxDrawdownPct) : 0;

    // Streaks
    const { currentStreak, longestWinStreak, longestLossStreak } = this.calculateStreaks(sortedTrades);

    // Average holding time
    const averageHoldingTimeHours = this.calculateAverageHoldingTime(sortedTrades);

    return {
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
      totalTrades: sortedTrades.length,
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

  private buildEquityCurve(trades: TradeMetrics[]): number[] {
    const curve: number[] = [this.initialCapital];
    let equity = this.initialCapital;

    for (const trade of trades) {
      equity += trade.pnl;
      curve.push(equity);
    }

    return curve;
  }

  private calculateDrawdown(equityCurve: number[]): {
    maxDrawdown: number;
    maxDrawdownPct: number;
    currentDrawdown: number;
    currentDrawdownPct: number;
  } {
    let maxEquity = equityCurve[0];
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;

    for (const equity of equityCurve) {
      if (equity > maxEquity) {
        maxEquity = equity;
      }

      const drawdown = maxEquity - equity;
      const drawdownPct = maxEquity > 0 ? (drawdown / maxEquity) * 100 : 0;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPct = drawdownPct;
      }
    }

    const currentEquity = equityCurve[equityCurve.length - 1];
    const currentPeak = Math.max(...equityCurve);
    const currentDrawdown = currentPeak - currentEquity;
    const currentDrawdownPct = currentPeak > 0 ? (currentDrawdown / currentPeak) * 100 : 0;

    return { maxDrawdown, maxDrawdownPct, currentDrawdown, currentDrawdownPct };
  }

  private calculateTradingDays(trades: TradeMetrics[]): number {
    if (trades.length === 0) return 0;

    const firstTrade = new Date(trades[0].openedAt).getTime();
    const lastTrade = new Date(trades[trades.length - 1].closedAt).getTime();
    const days = (lastTrade - firstTrade) / (1000 * 60 * 60 * 24);

    return Math.max(1, days);
  }

  private annualizeReturn(returnValue: number, days: number): number {
    if (days === 0) return 0;
    const years = days / 365;
    return years > 0 ? returnValue / years : returnValue;
  }

  private calculateSharpeRatio(returns: number[], tradingDays: number): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualize the Sharpe ratio
    const annualizedAvgReturn = this.annualizeReturn(avgReturn, tradingDays);
    const annualizedStdDev = stdDev * Math.sqrt(365 / tradingDays);
    const annualizedRiskFreeRate = this.riskFreeRate * 100;

    return (annualizedAvgReturn - annualizedRiskFreeRate) / annualizedStdDev;
  }

  private calculateSortinoRatio(returns: number[], tradingDays: number): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < this.targetReturn);

    if (downsideReturns.length === 0) return 0;

    const downsideVariance = downsideReturns.reduce(
      (sum, r) => sum + Math.pow(r - this.targetReturn, 2),
      0
    ) / downsideReturns.length;
    const downsideStdDev = Math.sqrt(downsideVariance);

    if (downsideStdDev === 0) return 0;

    // Annualize the Sortino ratio
    const annualizedAvgReturn = this.annualizeReturn(avgReturn, tradingDays);
    const annualizedDownsideStdDev = downsideStdDev * Math.sqrt(365 / tradingDays);
    const annualizedRiskFreeRate = this.riskFreeRate * 100;

    return (annualizedAvgReturn - annualizedRiskFreeRate) / annualizedDownsideStdDev;
  }

  private calculateStreaks(trades: TradeMetrics[]): {
    currentStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
  } {
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        currentStreak = currentWinStreak;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else if (trade.pnl < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        currentStreak = -currentLossStreak;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      }
    }

    return { currentStreak, longestWinStreak, longestLossStreak };
  }

  private calculateAverageHoldingTime(trades: TradeMetrics[]): number {
    if (trades.length === 0) return 0;

    const totalHours = trades.reduce((sum, trade) => {
      const openTime = new Date(trade.openedAt).getTime();
      const closeTime = new Date(trade.closedAt).getTime();
      const hours = (closeTime - openTime) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    return totalHours / trades.length;
  }

  private emptyMetrics(): PerformanceMetrics {
    return {
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

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
