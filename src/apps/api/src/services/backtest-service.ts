/**
 * Backtest Service
 * Manages backtest execution and persistence
 */

import {
  BacktestEngine,
  HistoricalDataFetcher,
  PostgresBacktestDataFetcher,
  getStrategy,
  listStrategies,
  type BacktestResult,
  type BacktestTrade,
  type StrategySignalGenerator
} from "@trade/trading-core";
import type { Pool } from "pg";

export interface BacktestRecord {
  id: string;
  userId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  strategy: string;
  parameters: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed";
  result?: BacktestResult;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreateBacktestParams {
  userId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  strategy: string;
  parameters?: Record<string, any>;
  initialCapital?: number;
  commission?: number;
  slippage?: number;
  interval?: string;
}

export class BacktestService {
  private dbFetcher: PostgresBacktestDataFetcher;

  constructor(
    private readonly pool: Pool,
    private readonly dataFetcher: HistoricalDataFetcher
  ) {
    this.dbFetcher = new PostgresBacktestDataFetcher(pool);
  }

  async create(params: CreateBacktestParams): Promise<BacktestRecord> {
    const id = this.generateId();
    const now = new Date();

    // Insert backtest record
    await this.pool.query(
      `INSERT INTO backtests (id, user_id, symbol, start_date, end_date, strategy, parameters, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        params.userId,
        params.symbol,
        params.startDate,
        params.endDate,
        params.strategy,
        JSON.stringify(params.parameters || {}),
        "pending",
        now,
      ]
    );

    // Start backtest execution asynchronously
    this.executeBacktest(id, params).catch(console.error);

    return {
      id,
      userId: params.userId,
      symbol: params.symbol,
      startDate: params.startDate,
      endDate: params.endDate,
      strategy: params.strategy,
      parameters: params.parameters || {},
      status: "pending",
      createdAt: now,
    };
  }

  async list(userId: string): Promise<BacktestRecord[]> {
    const result = await this.pool.query(
      `SELECT id, user_id, symbol, start_date, end_date, strategy, parameters, status, result, error, created_at, completed_at
       FROM backtests
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(this.mapRow);
  }

  async get(userId: string, id: string): Promise<BacktestRecord | null> {
    const result = await this.pool.query(
      `SELECT id, user_id, symbol, start_date, end_date, strategy, parameters, status, result, error, created_at, completed_at
       FROM backtests
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async getTrades(userId: string, id: string): Promise<BacktestTrade[]> {
    const backtest = await this.get(userId, id);
    if (!backtest || !backtest.result) {
      return [];
    }

    return backtest.result.trades;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM backtests WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  private async executeBacktest(id: string, params: CreateBacktestParams): Promise<void> {
    try {
      // Update status to running
      await this.pool.query(
        `UPDATE backtests SET status = $1 WHERE id = $2`,
        ["running", id]
      );

      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);
      const interval = params.interval || "1h";

      // Try to fetch from database first
      let candles = await this.dbFetcher.fetchCandles(
        params.symbol,
        interval,
        startDate,
        endDate
      );

      // Fallback to historical data fetcher if no data in database
      if (candles.length === 0) {
        candles = await this.dataFetcher.fetchHistoricalCandles(
          params.symbol,
          interval,
          startDate,
          endDate
        );
      }

      if (candles.length === 0) {
        throw new Error("No historical data available for the specified period");
      }

      // Get strategy
      const strategy = this.getStrategy(params.strategy, params.parameters);

      // Run backtest
      const engine = new BacktestEngine({
        symbol: params.symbol,
        startDate,
        endDate,
        initialCapital: params.initialCapital || 10000,
        feeRate: params.commission || 0.001,
        slippageRate: params.slippage || 0.0005,
        maxLeverage: 1,
        riskPerTrade: 0.02,
        stopLossAtr: 2,
        takeProfitAtr: 3
      });

      const result = await engine.run(candles, strategy);

      // Save result
      await this.pool.query(
        `UPDATE backtests SET status = $1, result = $2, completed_at = $3 WHERE id = $4`,
        ["completed", JSON.stringify(result), new Date(), id]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.pool.query(
        `UPDATE backtests SET status = $1, error = $2, completed_at = $3 WHERE id = $4`,
        ["failed", errorMessage, new Date(), id]
      );
    }
  }

  private getStrategy(name: string, parameters?: Record<string, any>) {
    // Load strategy from registry
    const strategyFactory = getStrategy(name);

    if (!strategyFactory) {
      // Fallback to simple SMA crossover
      return {
        generateSignal: (candles: any[], currentPrice: number) => {
          if (candles.length < 20) {
            return null;
          }

          const shortPeriod = parameters?.shortPeriod || 10;
          const longPeriod = parameters?.longPeriod || 20;

          const shortMA = this.calculateSMA(candles, shortPeriod);
          const longMA = this.calculateSMA(candles, longPeriod);

          if (shortMA > longMA) {
            return {
              signal: "LONG" as const,
              confidence: 70,
              shouldExecute: true,
              reasoning: "Short MA crossed above long MA",
            };
          } else if (shortMA < longMA) {
            return {
              signal: "SHORT" as const,
              confidence: 70,
              shouldExecute: true,
              reasoning: "Short MA crossed below long MA",
            };
          }

          return {
            signal: "WAIT" as const,
            confidence: 0,
            shouldExecute: false,
            reasoning: "No clear signal",
          };
        },
      };
    }

    return strategyFactory.create(parameters || strategyFactory.defaultParameters);
  }

  async listAvailableStrategies() {
    return listStrategies();
  }

  private calculateSMA(candles: any[], period: number): number {
    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    return sum / slice.length;
  }

  private mapRow(row: any): BacktestRecord {
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      startDate: row.start_date,
      endDate: row.end_date,
      strategy: row.strategy,
      parameters: row.parameters,
      status: row.status,
      result: row.result,
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  private generateId(): string {
    return `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
