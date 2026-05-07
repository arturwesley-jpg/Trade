import type { TradeMetrics } from "./metrics-calculator.js";

export interface EquityCurvePoint {
  timestamp: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export interface RollingMetrics {
  timestamp: string;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  totalReturn: number;
  totalReturnPct: number;
  tradesInWindow: number;
}

export interface DrawdownPeriod {
  startDate: string;
  endDate: string;
  duration: number; // days
  maxDrawdown: number;
  maxDrawdownPct: number;
  recovered: boolean;
  recoveryDate?: string;
}

export interface PeriodReturns {
  period: string; // "2024-01", "2024-W01", etc
  returns: number;
  returnsPct: number;
  trades: number;
  winRate: number;
}

export interface BenchmarkCorrelation {
  correlation: number;
  beta: number;
  alpha: number;
  trackingError: number;
}

export interface TimeSeriesAnalytics {
  equityCurve: EquityCurvePoint[];
  rollingMetrics: RollingMetrics[];
  drawdownPeriods: DrawdownPeriod[];
  monthlyReturns: PeriodReturns[];
  weeklyReturns: PeriodReturns[];
  benchmarkCorrelation?: BenchmarkCorrelation;
}

export interface TimeSeriesConfig {
  initialCapital?: number;
  rollingWindowDays?: number;
  riskFreeRate?: number;
}

export class TimeSeriesAnalyzer {
  private readonly initialCapital: number;
  private readonly rollingWindowDays: number;
  private readonly riskFreeRate: number;

  constructor(config: TimeSeriesConfig = {}) {
    this.initialCapital = config.initialCapital ?? 10_000;
    this.rollingWindowDays = config.rollingWindowDays ?? 30;
    this.riskFreeRate = config.riskFreeRate ?? 0.02;
  }

  analyze(trades: TradeMetrics[], benchmarkReturns?: number[]): TimeSeriesAnalytics {
    if (trades.length === 0) {
      return {
        equityCurve: [],
        rollingMetrics: [],
        drawdownPeriods: [],
        monthlyReturns: [],
        weeklyReturns: []
      };
    }

    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    const equityCurve = this.generateEquityCurve(sortedTrades);
    const rollingMetrics = this.calculateRollingMetrics(sortedTrades);
    const drawdownPeriods = this.analyzeDrawdownPeriods(equityCurve);
    const monthlyReturns = this.calculatePeriodReturns(sortedTrades, "monthly");
    const weeklyReturns = this.calculatePeriodReturns(sortedTrades, "weekly");

    const analytics: TimeSeriesAnalytics = {
      equityCurve,
      rollingMetrics,
      drawdownPeriods,
      monthlyReturns,
      weeklyReturns
    };

    if (benchmarkReturns && benchmarkReturns.length > 0) {
      analytics.benchmarkCorrelation = this.calculateBenchmarkCorrelation(
        sortedTrades,
        benchmarkReturns
      );
    }

    return analytics;
  }

  private generateEquityCurve(trades: TradeMetrics[]): EquityCurvePoint[] {
    const curve: EquityCurvePoint[] = [];
    let equity = this.initialCapital;
    let peak = this.initialCapital;

    // Initial point
    curve.push({
      timestamp: trades[0].openedAt,
      equity: this.initialCapital,
      drawdown: 0,
      drawdownPct: 0
    });

    for (const trade of trades) {
      equity += trade.pnl;

      if (equity > peak) {
        peak = equity;
      }

      const drawdown = peak - equity;
      const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;

      curve.push({
        timestamp: trade.closedAt,
        equity: this.round(equity, 2),
        drawdown: this.round(drawdown, 2),
        drawdownPct: this.round(drawdownPct, 2)
      });
    }

    return curve;
  }

  private calculateRollingMetrics(trades: TradeMetrics[]): RollingMetrics[] {
    const metrics: RollingMetrics[] = [];
    const windowMs = this.rollingWindowDays * 24 * 60 * 60 * 1000;

    for (let i = 0; i < trades.length; i++) {
      const currentTime = new Date(trades[i].closedAt).getTime();
      const windowStart = currentTime - windowMs;

      // Get trades within the rolling window
      const windowTrades = trades.slice(0, i + 1).filter(t => {
        const tradeTime = new Date(t.closedAt).getTime();
        return tradeTime >= windowStart && tradeTime <= currentTime;
      });

      if (windowTrades.length === 0) continue;

      const returns = windowTrades.map(t => t.pnlPercentage);
      const totalReturn = windowTrades.reduce((sum, t) => sum + t.pnl, 0);
      const totalReturnPct = windowTrades.reduce((sum, t) => sum + t.pnlPercentage, 0);
      const winningTrades = windowTrades.filter(t => t.pnl > 0);
      const winRate = (winningTrades.length / windowTrades.length) * 100;

      const sharpeRatio = this.calculateWindowSharpe(returns);
      const sortinoRatio = this.calculateWindowSortino(returns);

      metrics.push({
        timestamp: trades[i].closedAt,
        sharpeRatio: this.round(sharpeRatio, 3),
        sortinoRatio: this.round(sortinoRatio, 3),
        winRate: this.round(winRate, 2),
        totalReturn: this.round(totalReturn, 2),
        totalReturnPct: this.round(totalReturnPct, 2),
        tradesInWindow: windowTrades.length
      });
    }

    return metrics;
  }

  private calculateWindowSharpe(returns: number[]): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const annualizedAvgReturn = avgReturn * Math.sqrt(252); // Assuming daily-like frequency
    const annualizedStdDev = stdDev * Math.sqrt(252);
    const annualizedRiskFreeRate = this.riskFreeRate * 100;

    return (annualizedAvgReturn - annualizedRiskFreeRate) / annualizedStdDev;
  }

  private calculateWindowSortino(returns: number[]): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);

    if (downsideReturns.length === 0) return 0;

    const downsideVariance = downsideReturns.reduce(
      (sum, r) => sum + Math.pow(r, 2),
      0
    ) / downsideReturns.length;
    const downsideStdDev = Math.sqrt(downsideVariance);

    if (downsideStdDev === 0) return 0;

    const annualizedAvgReturn = avgReturn * Math.sqrt(252);
    const annualizedDownsideStdDev = downsideStdDev * Math.sqrt(252);
    const annualizedRiskFreeRate = this.riskFreeRate * 100;

    return (annualizedAvgReturn - annualizedRiskFreeRate) / annualizedDownsideStdDev;
  }

  private analyzeDrawdownPeriods(equityCurve: EquityCurvePoint[]): DrawdownPeriod[] {
    const periods: DrawdownPeriod[] = [];
    let inDrawdown = false;
    let drawdownStart: EquityCurvePoint | null = null;
    let maxDrawdownInPeriod = 0;
    let maxDrawdownPctInPeriod = 0;

    for (let i = 1; i < equityCurve.length; i++) {
      const point = equityCurve[i];

      if (point.drawdown > 0 && !inDrawdown) {
        // Start of new drawdown period
        inDrawdown = true;
        drawdownStart = equityCurve[i - 1];
        maxDrawdownInPeriod = point.drawdown;
        maxDrawdownPctInPeriod = point.drawdownPct;
      } else if (point.drawdown > 0 && inDrawdown) {
        // Continue drawdown period
        maxDrawdownInPeriod = Math.max(maxDrawdownInPeriod, point.drawdown);
        maxDrawdownPctInPeriod = Math.max(maxDrawdownPctInPeriod, point.drawdownPct);
      } else if (point.drawdown === 0 && inDrawdown) {
        // End of drawdown period (recovered)
        if (drawdownStart) {
          const startTime = new Date(drawdownStart.timestamp).getTime();
          const endTime = new Date(point.timestamp).getTime();
          const duration = (endTime - startTime) / (1000 * 60 * 60 * 24);

          periods.push({
            startDate: drawdownStart.timestamp,
            endDate: point.timestamp,
            duration: this.round(duration, 2),
            maxDrawdown: this.round(maxDrawdownInPeriod, 2),
            maxDrawdownPct: this.round(maxDrawdownPctInPeriod, 2),
            recovered: true,
            recoveryDate: point.timestamp
          });
        }

        inDrawdown = false;
        drawdownStart = null;
        maxDrawdownInPeriod = 0;
        maxDrawdownPctInPeriod = 0;
      }
    }

    // Handle ongoing drawdown
    if (inDrawdown && drawdownStart) {
      const lastPoint = equityCurve[equityCurve.length - 1];
      const startTime = new Date(drawdownStart.timestamp).getTime();
      const endTime = new Date(lastPoint.timestamp).getTime();
      const duration = (endTime - startTime) / (1000 * 60 * 60 * 24);

      periods.push({
        startDate: drawdownStart.timestamp,
        endDate: lastPoint.timestamp,
        duration: this.round(duration, 2),
        maxDrawdown: this.round(maxDrawdownInPeriod, 2),
        maxDrawdownPct: this.round(maxDrawdownPctInPeriod, 2),
        recovered: false
      });
    }

    return periods;
  }

  private calculatePeriodReturns(
    trades: TradeMetrics[],
    period: "monthly" | "weekly"
  ): PeriodReturns[] {
    const periodMap = new Map<string, TradeMetrics[]>();

    for (const trade of trades) {
      const date = new Date(trade.closedAt);
      let key: string;

      if (period === "monthly") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else {
        // Weekly: ISO week number
        const weekNumber = this.getISOWeek(date);
        key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
      }

      if (!periodMap.has(key)) {
        periodMap.set(key, []);
      }
      periodMap.get(key)!.push(trade);
    }

    const returns: PeriodReturns[] = [];

    for (const [periodKey, periodTrades] of periodMap.entries()) {
      const totalReturns = periodTrades.reduce((sum, t) => sum + t.pnl, 0);
      const totalReturnsPct = periodTrades.reduce((sum, t) => sum + t.pnlPercentage, 0);
      const winningTrades = periodTrades.filter(t => t.pnl > 0);
      const winRate = (winningTrades.length / periodTrades.length) * 100;

      returns.push({
        period: periodKey,
        returns: this.round(totalReturns, 2),
        returnsPct: this.round(totalReturnsPct, 2),
        trades: periodTrades.length,
        winRate: this.round(winRate, 2)
      });
    }

    return returns.sort((a, b) => a.period.localeCompare(b.period));
  }

  private calculateBenchmarkCorrelation(
    trades: TradeMetrics[],
    benchmarkReturns: number[]
  ): BenchmarkCorrelation {
    const strategyReturns = trades.map(t => t.pnlPercentage);

    // Align lengths
    const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
    const alignedStrategy = strategyReturns.slice(0, minLength);
    const alignedBenchmark = benchmarkReturns.slice(0, minLength);

    if (alignedStrategy.length === 0) {
      return { correlation: 0, beta: 0, alpha: 0, trackingError: 0 };
    }

    // Calculate correlation
    const correlation = this.calculateCorrelation(alignedStrategy, alignedBenchmark);

    // Calculate beta
    const benchmarkVariance = this.calculateVariance(alignedBenchmark);
    const covariance = this.calculateCovariance(alignedStrategy, alignedBenchmark);
    const beta = benchmarkVariance !== 0 ? covariance / benchmarkVariance : 0;

    // Calculate alpha
    const strategyAvg = alignedStrategy.reduce((sum, r) => sum + r, 0) / alignedStrategy.length;
    const benchmarkAvg = alignedBenchmark.reduce((sum, r) => sum + r, 0) / alignedBenchmark.length;
    const alpha = strategyAvg - beta * benchmarkAvg;

    // Calculate tracking error
    const trackingDifferences = alignedStrategy.map((r, i) => r - alignedBenchmark[i]);
    const trackingError = Math.sqrt(this.calculateVariance(trackingDifferences));

    return {
      correlation: this.round(correlation, 3),
      beta: this.round(beta, 3),
      alpha: this.round(alpha, 3),
      trackingError: this.round(trackingError, 3)
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xDenominator * yDenominator);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return variance;
  }

  private calculateCovariance(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    let covariance = 0;
    for (let i = 0; i < n; i++) {
      covariance += (x[i] - xMean) * (y[i] - yMean);
    }

    return covariance / n;
  }

  private getISOWeek(date: Date): number {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}