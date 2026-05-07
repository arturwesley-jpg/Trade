import type { Client } from "pg";
import type {
  Backtest,
  BacktestMetricsRecord,
  BacktestTrade,
  CreateBacktestRequest,
  BacktestWithMetrics
} from "@trade/shared";
import { randomUUID } from "node:crypto";

export interface CreateBacktestData extends CreateBacktestRequest {
  userId: string;
}

export interface UpdateBacktestStatusData {
  backtestId: string;
  status: "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class BacktestRepository {
  constructor(private client: Client) {}

  async createBacktest(data: CreateBacktestData): Promise<Backtest> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const result = await this.client.query<Backtest>(
      `INSERT INTO backtests (
        id, user_id, name, description, symbol, start_date, end_date, interval,
        initial_capital, fee_rate, slippage_rate, strategy_name, strategy_description,
        strategy_parameters, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING
        id, user_id as "userId", name, description, symbol,
        start_date as "startDate", end_date as "endDate", interval,
        initial_capital as "initialCapital", fee_rate as "feeRate",
        slippage_rate as "slippageRate", strategy_name as "strategyName",
        strategy_description as "strategyDescription",
        strategy_parameters as "strategyParameters", status,
        created_at as "createdAt", started_at as "startedAt",
        completed_at as "completedAt", error_message as "errorMessage"`,
      [
        id, data.userId, data.name, data.description ?? null, data.symbol,
        data.startDate, data.endDate, data.interval, data.initialCapital,
        data.feeRate, data.slippageRate, data.strategyName,
        data.strategyDescription ?? null,
        JSON.stringify(data.strategyParameters ?? {}),
        "pending", now
      ]
    );

    return result.rows[0];
  }

  async updateBacktestStatus(data: UpdateBacktestStatusData): Promise<void> {
    const updates: string[] = ["status = $2"];
    const values: any[] = [data.backtestId, data.status];
    let paramIndex = 3;

    if (data.startedAt) {
      updates.push(`started_at = $${paramIndex}`);
      values.push(data.startedAt.toISOString());
      paramIndex++;
    }

    if (data.completedAt) {
      updates.push(`completed_at = $${paramIndex}`);
      values.push(data.completedAt.toISOString());
      paramIndex++;
    }

    if (data.errorMessage) {
      updates.push(`error_message = $${paramIndex}`);
      values.push(data.errorMessage);
      paramIndex++;
    }

    await this.client.query(
      `UPDATE backtests SET ${updates.join(", ")} WHERE id = $1`,
      values
    );
  }

  async findBacktestById(id: string): Promise<BacktestWithMetrics | null> {
    const result = await this.client.query<Backtest & { metrics?: BacktestMetricsRecord }>(
      `SELECT
        b.id, b.user_id as "userId", b.name, b.description, b.symbol,
        b.start_date as "startDate", b.end_date as "endDate", b.interval,
        b.initial_capital as "initialCapital", b.fee_rate as "feeRate",
        b.slippage_rate as "slippageRate", b.strategy_name as "strategyName",
        b.strategy_description as "strategyDescription",
        b.strategy_parameters as "strategyParameters", b.status,
        b.created_at as "createdAt", b.started_at as "startedAt",
        b.completed_at as "completedAt", b.error_message as "errorMessage",
        row_to_json(m.*) as metrics
      FROM backtests b
      LEFT JOIN backtest_metrics m ON m.backtest_id = b.id
      WHERE b.id = $1`,
      [id]
    );

    return result.rows[0] ?? null;
  }

  async findBacktestsByUserId(
    userId: string,
    options: { page?: number; pageSize?: number; status?: string } = {}
  ): Promise<{ backtests: BacktestWithMetrics[]; total: number }> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE b.user_id = $1";
    const values: any[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      whereClause += ` AND b.status = $${paramIndex}`;
      values.push(options.status);
      paramIndex++;
    }

    const countResult = await this.client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM backtests b ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].count, 10);

    values.push(pageSize, offset);

    const result = await this.client.query<Backtest & { metrics?: BacktestMetricsRecord }>(
      `SELECT
        b.id, b.user_id as "userId", b.name, b.description, b.symbol,
        b.start_date as "startDate", b.end_date as "endDate", b.interval,
        b.initial_capital as "initialCapital", b.fee_rate as "feeRate",
        b.slippage_rate as "slippageRate", b.strategy_name as "strategyName",
        b.strategy_description as "strategyDescription",
        b.strategy_parameters as "strategyParameters", b.status,
        b.created_at as "createdAt", b.started_at as "startedAt",
        b.completed_at as "completedAt", b.error_message as "errorMessage",
        row_to_json(m.*) as metrics
      FROM backtests b
      LEFT JOIN backtest_metrics m ON m.backtest_id = b.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    return {
      backtests: result.rows,
      total
    };
  }

  async saveBacktestMetrics(backtestId: string, metrics: Omit<BacktestMetricsRecord, "backtestId" | "createdAt">): Promise<void> {
    const now = new Date().toISOString();

    await this.client.query(
      `INSERT INTO backtest_metrics (
        backtest_id, total_return, total_return_pct, sharpe_ratio, sortino_ratio,
        calmar_ratio, max_drawdown, max_drawdown_pct, win_rate, profit_factor,
        total_trades, winning_trades, losing_trades, average_win, average_loss,
        largest_win, largest_loss, average_trade_duration_hours, expectancy,
        var_95, cvar_95, ulcer_index, recovery_factor, payoff_ratio,
        risk_reward_ratio, kelly_criterion, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      ON CONFLICT (backtest_id) DO UPDATE SET
        total_return = EXCLUDED.total_return,
        total_return_pct = EXCLUDED.total_return_pct,
        sharpe_ratio = EXCLUDED.sharpe_ratio,
        sortino_ratio = EXCLUDED.sortino_ratio,
        calmar_ratio = EXCLUDED.calmar_ratio,
        max_drawdown = EXCLUDED.max_drawdown,
        max_drawdown_pct = EXCLUDED.max_drawdown_pct,
        win_rate = EXCLUDED.win_rate,
        profit_factor = EXCLUDED.profit_factor,
        total_trades = EXCLUDED.total_trades,
        winning_trades = EXCLUDED.winning_trades,
        losing_trades = EXCLUDED.losing_trades,
        average_win = EXCLUDED.average_win,
        average_loss = EXCLUDED.average_loss,
        largest_win = EXCLUDED.largest_win,
        largest_loss = EXCLUDED.largest_loss,
        average_trade_duration_hours = EXCLUDED.average_trade_duration_hours,
        expectancy = EXCLUDED.expectancy,
        var_95 = EXCLUDED.var_95,
        cvar_95 = EXCLUDED.cvar_95,
        ulcer_index = EXCLUDED.ulcer_index,
        recovery_factor = EXCLUDED.recovery_factor,
        payoff_ratio = EXCLUDED.payoff_ratio,
        risk_reward_ratio = EXCLUDED.risk_reward_ratio,
        kelly_criterion = EXCLUDED.kelly_criterion`,
      [
        backtestId, metrics.totalReturn, metrics.totalReturnPct,
        metrics.sharpeRatio ?? null, metrics.sortinoRatio ?? null,
        metrics.calmarRatio ?? null, metrics.maxDrawdown, metrics.maxDrawdownPct,
        metrics.winRate, metrics.profitFactor ?? null, metrics.totalTrades,
        metrics.winningTrades, metrics.losingTrades, metrics.averageWin ?? null,
        metrics.averageLoss ?? null, metrics.largestWin ?? null,
        metrics.largestLoss ?? null, metrics.averageTradeDurationHours ?? null,
        metrics.expectancy ?? null, metrics.var95 ?? null, metrics.cvar95 ?? null,
        metrics.ulcerIndex ?? null, metrics.recoveryFactor ?? null,
        metrics.payoffRatio ?? null, metrics.riskRewardRatio ?? null,
        metrics.kellyCriterion ?? null, now
      ]
    );
  }

  async saveBacktestTrades(backtestId: string, trades: Omit<BacktestTrade, "id" | "backtestId">[]): Promise<void> {
    if (trades.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const trade of trades) {
      const id = randomUUID();
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, ` +
        `$${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, ` +
        `$${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, ` +
        `$${paramIndex + 12}, $${paramIndex + 13})`
      );
      values.push(
        id, backtestId, trade.symbol, trade.side, trade.entryPrice,
        trade.exitPrice, trade.quantity, trade.pnl, trade.pnlPct,
        trade.openedAt, trade.closedAt, trade.durationHours,
        trade.entryReason ?? null, trade.exitReason ?? null
      );
      paramIndex += 14;
    }

    await this.client.query(
      `INSERT INTO backtest_trades (
        id, backtest_id, symbol, side, entry_price, exit_price, quantity,
        pnl, pnl_pct, opened_at, closed_at, duration_hours, entry_reason, exit_reason
      ) VALUES ${placeholders.join(", ")}`,
      values
    );
  }

  async getBacktestTrades(backtestId: string): Promise<BacktestTrade[]> {
    const result = await this.client.query<BacktestTrade>(
      `SELECT
        id, backtest_id as "backtestId", symbol, side,
        entry_price as "entryPrice", exit_price as "exitPrice", quantity,
        pnl, pnl_pct as "pnlPct", opened_at as "openedAt",
        closed_at as "closedAt", duration_hours as "durationHours",
        entry_reason as "entryReason", exit_reason as "exitReason"
      FROM backtest_trades
      WHERE backtest_id = $1
      ORDER BY opened_at ASC`,
      [backtestId]
    );

    return result.rows;
  }
}
