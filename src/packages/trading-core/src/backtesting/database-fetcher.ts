/**
 * Database Integration for Backtesting
 * Fetches historical candle data from PostgreSQL database
 */

import type { Pool } from "pg";
import type { Candle } from "./historical-data-fetcher.js";

export interface DatabaseBacktestDataFetcher {
  fetchCandles(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<Candle[]>;
}

export class PostgresBacktestDataFetcher implements DatabaseBacktestDataFetcher {
  constructor(private readonly pool: Pool) {}

  async fetchCandles(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<Candle[]> {
    const result = await this.pool.query(
      `SELECT timestamp, open, high, low, close, volume
       FROM ohlcv_candles
       WHERE symbol = $1 AND interval = $2 AND timestamp >= $3 AND timestamp <= $4
       ORDER BY timestamp ASC`,
      [symbol, interval, startDate, endDate]
    );

    return result.rows.map(row => ({
      timestamp: new Date(row.timestamp).getTime(),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume)
    }));
  }

  /**
   * Check if sufficient data exists for backtesting
   */
  async checkDataAvailability(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    available: boolean;
    count: number;
    firstCandle: Date | null;
    lastCandle: Date | null;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as count,
        MIN(timestamp) as first_candle,
        MAX(timestamp) as last_candle
       FROM ohlcv_candles
       WHERE symbol = $1 AND interval = $2 AND timestamp >= $3 AND timestamp <= $4`,
      [symbol, interval, startDate, endDate]
    );

    const row = result.rows[0];
    const count = parseInt(row.count);

    return {
      available: count > 0,
      count,
      firstCandle: row.first_candle ? new Date(row.first_candle) : null,
      lastCandle: row.last_candle ? new Date(row.last_candle) : null
    };
  }

  /**
   * Get available symbols for backtesting
   */
  async getAvailableSymbols(): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT symbol FROM ohlcv_candles ORDER BY symbol`
    );

    return result.rows.map(row => row.symbol);
  }

  /**
   * Get available intervals for a symbol
   */
  async getAvailableIntervals(symbol: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT interval FROM ohlcv_candles WHERE symbol = $1 ORDER BY interval`,
      [symbol]
    );

    return result.rows.map(row => row.interval);
  }
}
