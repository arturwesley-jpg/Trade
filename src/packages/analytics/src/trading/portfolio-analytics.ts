import type { Pool } from 'pg';
import type {
  PortfolioMetrics,
  AnalyticsQuery,
  DrawdownPeriod,
  PerformanceByAsset,
  TradingFrequency,
  RiskMetrics
} from '../types';

export class PortfolioAnalytics {
  constructor(private db: Pool) {}

  async getPortfolioMetrics(query: AnalyticsQuery): Promise<PortfolioMetrics> {
    const { userId, period, mode = 'all' } = query;

    const positionsQuery = `
      SELECT
        id,
        symbol,
        side,
        entry_price,
        current_price as exit_price,
        quantity,
        leverage,
        realized_pnl,
        opened_at,
        closed_at,
        mode
      FROM positions
      WHERE status = 'CLOSED'
        AND closed_at BETWEEN $1 AND $2
        ${mode !== 'all' ? 'AND mode = $3' : ''}
      ORDER BY closed_at ASC
    `;

    const params = mode !== 'all'
      ? [period.start, period.end, mode.toUpperCase()]
      : [period.start, period.end];

    const { rows: positions } = await this.db.query(positionsQuery, params);

    if (positions.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalTrades = positions.length;
    const winningTrades = positions.filter((p: any) => p.realized_pnl > 0).length;
    const losingTrades = positions.filter((p: any) => p.realized_pnl < 0).length;
    const winRate = (winningTrades / totalTrades) * 100;

    const wins = positions.filter((p: any) => p.realized_pnl > 0).map((p: any) => p.realized_pnl);
    const losses = positions.filter((p: any) => p.realized_pnl < 0).map((p: any) => Math.abs(p.realized_pnl));

    const avgWin = wins.length > 0 ? wins.reduce((a: number, b: number) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a: number, b: number) => a + b, 0) / losses.length : 0;
    const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const largestLoss = losses.length > 0 ? Math.max(...losses) : 0;

    const totalReturn = positions.reduce((sum: number, p: any) => sum + parseFloat(p.realized_pnl), 0);
    const totalFees = await this.calculateTotalFees(positions.map((p: any) => p.id));
    const netProfit = totalReturn - totalFees;

    const grossProfit = wins.reduce((a: number, b: number) => a + b, 0);
    const grossLoss = losses.reduce((a: number, b: number) => a + b, 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    const sharpeRatio = await this.calculateSharpeRatio(positions);
    const sortinoRatio = await this.calculateSortinoRatio(positions);
    const { maxDrawdown, maxDrawdownPct, currentDrawdown } = await this.calculateDrawdown(positions);

    const holdingTimes = positions.map((p: any) => {
      const opened = new Date(p.opened_at).getTime();
      const closed = new Date(p.closed_at).getTime();
      return (closed - opened) / (1000 * 60 * 60);
    });
    const avgHoldingTime = holdingTimes.reduce((a: number, b: number) => a + b, 0) / holdingTimes.length;

    const periodDays = (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24);
    const avgTradesPerDay = totalTrades / periodDays;

    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

    const { consecutiveWins, consecutiveLosses } = this.calculateConsecutiveWinsLosses(positions);
    const recoveryFactor = maxDrawdown > 0 ? netProfit / maxDrawdown : 0;

    const openPositionsQuery = `
      SELECT COUNT(*) as count
      FROM positions
      WHERE status = 'OPEN'
        ${mode !== 'all' ? 'AND mode = $1' : ''}
    `;
    const { rows: [{ count: openPositions }] } = await this.db.query(
      openPositionsQuery,
      mode !== 'all' ? [mode.toUpperCase()] : []
    );

    return {
      totalTrades,
      openPositions: parseInt(openPositions),
      closedPositions: totalTrades,
      winningTrades,
      losingTrades,
      winRate: Math.round(winRate * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPct: 0,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      largestWin: Math.round(largestWin * 100) / 100,
      largestLoss: Math.round(largestLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
      currentDrawdown: Math.round(currentDrawdown * 100) / 100,
      avgHoldingTime: Math.round(avgHoldingTime * 100) / 100,
      avgTradesPerDay: Math.round(avgTradesPerDay * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      consecutiveWins,
      consecutiveLosses,
      recoveryFactor: Math.round(recoveryFactor * 100) / 100
    };
  }

  async getPerformanceByAsset(query: AnalyticsQuery): Promise<PerformanceByAsset[]> {
    const { period, mode = 'all' } = query;

    const assetQuery = `
      SELECT
        symbol,
        COUNT(*) as trades,
        COUNT(*) FILTER (WHERE realized_pnl > 0) as wins,
        SUM(realized_pnl) as total_return,
        AVG(realized_pnl) as avg_return,
        STDDEV(realized_pnl) as std_dev
      FROM positions
      WHERE status = 'CLOSED'
        AND closed_at BETWEEN $1 AND $2
        ${mode !== 'all' ? 'AND mode = $3' : ''}
      GROUP BY symbol
      ORDER BY total_return DESC
    `;

    const params = mode !== 'all'
      ? [period.start, period.end, mode.toUpperCase()]
      : [period.start, period.end];

    const { rows } = await this.db.query(assetQuery, params);

    return Promise.all(rows.map(async (row: any) => {
      const winRate = (parseInt(row.wins) / parseInt(row.trades)) * 100;
      const avgReturn = parseFloat(row.avg_return);
      const stdDev = parseFloat(row.std_dev) || 0;
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

      const symbolPositions = await this.db.query(
        `SELECT realized_pnl FROM positions
         WHERE symbol = $1 AND status = 'CLOSED'
         AND closed_at BETWEEN $2 AND $3
         ORDER BY closed_at ASC`,
        [row.symbol, period.start, period.end]
      );

      const { maxDrawdown } = await this.calculateDrawdown(symbolPositions.rows);

      return {
        symbol: row.symbol,
        trades: parseInt(row.trades),
        winRate: Math.round(winRate * 100) / 100,
        totalReturn: Math.round(parseFloat(row.total_return) * 100) / 100,
        avgReturn: Math.round(avgReturn * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100
      };
    }));
  }

  async getTradingFrequency(query: AnalyticsQuery): Promise<TradingFrequency> {
    const { period, mode = 'all' } = query;

    const frequencyQuery = `
      SELECT
        DATE(closed_at) as trade_date,
        EXTRACT(HOUR FROM closed_at) as hour,
        EXTRACT(DOW FROM closed_at) as day_of_week,
        COUNT(*) as count
      FROM positions
      WHERE status = 'CLOSED'
        AND closed_at BETWEEN $1 AND $2
        ${mode !== 'all' ? 'AND mode = $3' : ''}
      GROUP BY trade_date, hour, day_of_week
    `;

    const params = mode !== 'all'
      ? [period.start, period.end, mode.toUpperCase()]
      : [period.start, period.end];

    const { rows } = await this.db.query(frequencyQuery, params);

    const dailyCounts = new Map<string, number>();
    const hourlyCounts: Record<number, number> = {};
    const dayOfWeekCounts: Record<number, number> = {};

    for (let i = 0; i < 24; i++) hourlyCounts[i] = 0;
    for (let i = 0; i < 7; i++) dayOfWeekCounts[i] = 0;

    rows.forEach((row: any) => {
      const date = row.trade_date;
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + parseInt(row.count));
      hourlyCounts[parseInt(row.hour)] += parseInt(row.count);
      dayOfWeekCounts[parseInt(row.day_of_week)] += parseInt(row.count);
    });

    const dailyValues = Array.from(dailyCounts.values());
    const daily = dailyValues.length > 0
      ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
      : 0;

    const periodDays = (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24);
    const periodWeeks = periodDays / 7;
    const periodMonths = periodDays / 30;

    const totalTrades = dailyValues.reduce((a, b) => a + b, 0);
    const weekly = totalTrades / periodWeeks;
    const monthly = totalTrades / periodMonths;

    return {
      daily: Math.round(daily * 100) / 100,
      weekly: Math.round(weekly * 100) / 100,
      monthly: Math.round(monthly * 100) / 100,
      byHour: hourlyCounts,
      byDayOfWeek: dayOfWeekCounts
    };
  }

  async getDrawdownPeriods(query: AnalyticsQuery): Promise<DrawdownPeriod[]> {
    const { period, mode = 'all' } = query;

    const positionsQuery = `
      SELECT realized_pnl, closed_at
      FROM positions
      WHERE status = 'CLOSED'
        AND closed_at BETWEEN $1 AND $2
        ${mode !== 'all' ? 'AND mode = $3' : ''}
      ORDER BY closed_at ASC
    `;

    const params = mode !== 'all'
      ? [period.start, period.end, mode.toUpperCase()]
      : [period.start, period.end];

    const { rows: positions } = await this.db.query(positionsQuery, params);

    if (positions.length === 0) return [];

    let cumulative = 0;
    const equity: Array<{ date: Date; value: number }> = [];

    positions.forEach((p: any) => {
      cumulative += parseFloat(p.realized_pnl);
      equity.push({
        date: new Date(p.closed_at),
        value: cumulative
      });
    });

    const drawdowns: DrawdownPeriod[] = [];
    let peak = equity[0].value;
    let peakDate = equity[0].date;
    let inDrawdown = false;
    let drawdownStart: Date | null = null;

    for (let i = 1; i < equity.length; i++) {
      const current = equity[i];

      if (current.value > peak) {
        if (inDrawdown && drawdownStart) {
          const trough = Math.min(...equity.slice(equity.findIndex(e => e.date === drawdownStart), i).map(e => e.value));
          const drawdown = peak - trough;
          const drawdownPct = (drawdown / peak) * 100;
          const duration = (current.date.getTime() - drawdownStart.getTime()) / (1000 * 60 * 60 * 24);

          drawdowns.push({
            start: drawdownStart,
            end: equity[i - 1].date,
            peak,
            trough,
            drawdown,
            drawdownPct,
            recovery: current.date,
            duration
          });
        }

        peak = current.value;
        peakDate = current.date;
        inDrawdown = false;
        drawdownStart = null;
      } else if (current.value < peak) {
        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStart = current.date;
        }
      }
    }

    if (inDrawdown && drawdownStart) {
      const trough = Math.min(...equity.slice(equity.findIndex(e => e.date === drawdownStart)).map(e => e.value));
      const drawdown = peak - trough;
      const drawdownPct = (drawdown / peak) * 100;
      const duration = (equity[equity.length - 1].date.getTime() - drawdownStart.getTime()) / (1000 * 60 * 60 * 24);

      drawdowns.push({
        start: drawdownStart,
        end: equity[equity.length - 1].date,
        peak,
        trough,
        drawdown,
        drawdownPct,
        duration
      });
    }

    return drawdowns.sort((a, b) => b.drawdown - a.drawdown);
  }

  async getRiskMetrics(query: AnalyticsQuery): Promise<RiskMetrics> {
    const { period, mode = 'all' } = query;

    const positionsQuery = `
      SELECT realized_pnl
      FROM positions
      WHERE status = 'CLOSED'
        AND closed_at BETWEEN $1 AND $2
        ${mode !== 'all' ? 'AND mode = $3' : ''}
      ORDER BY closed_at ASC
    `;

    const params = mode !== 'all'
      ? [period.start, period.end, mode.toUpperCase()]
      : [period.start, period.end];

    const { rows: positions } = await this.db.query(positionsQuery, params);

    if (positions.length === 0) {
      return {
        valueAtRisk: 0,
        conditionalVaR: 0,
        beta: 0,
        alpha: 0,
        informationRatio: 0,
        calmarRatio: 0,
        sterlingRatio: 0
      };
    }

    const returns = positions.map((p: any) => parseFloat(p.realized_pnl));
    returns.sort((a, b) => a - b);

    const var95Index = Math.floor(returns.length * 0.05);
    const valueAtRisk = Math.abs(returns[var95Index]);

    const tailReturns = returns.slice(0, var95Index + 1);
    const conditionalVaR = Math.abs(tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length);

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const { maxDrawdown } = await this.calculateDrawdown(positions);
    const totalReturn = returns.reduce((a, b) => a + b, 0);

    const calmarRatio = maxDrawdown > 0 ? (avgReturn * 252) / maxDrawdown : 0;

    const avgDrawdown = maxDrawdown * 0.7;
    const sterlingRatio = avgDrawdown > 0 ? (avgReturn * 252) / avgDrawdown : 0;

    const riskFreeRate = 0.04 / 252;
    const excessReturn = avgReturn - riskFreeRate;
