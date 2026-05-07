import type { Client } from "pg";
import type { Candle } from "../intelligence-engines.js";
import type { TimeInterval } from "./historical-data-fetcher.js";

export interface StoreCandlesInput {
  symbol: string;
  interval: TimeInterval;
  candles: Candle[];
}

export interface FetchCandlesInput {
  symbol: string;
  interval: TimeInterval;
  startTime: number;
  endTime: number;
}

export interface CandleGap {
  symbol: string;
  interval: TimeInterval;
  gapStart: number;
  gapEnd: number;
  expectedCandles: number;
  missingCandles: number;
}

export class CandleStore {
  constructor(private client: Client) {}

  /**
   * Store OHLCV candles in PostgreSQL
   */
  async storeCandles(input: StoreCandlesInput): Promise<number> {
    if (input.candles.length === 0) return 0;

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const candle of input.candles) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, ` +
        `$${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
      );
      values.push(
        input.symbol,
        input.interval,
        candle.timestamp,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume
      );
      paramIndex += 8;
    }

    const result = await this.client.query(
      `INSERT INTO candles (symbol, interval, timestamp, open, high, low, close, volume)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (symbol, interval, timestamp) DO UPDATE SET
         open = EXCLUDED.open,
         high = EXCLUDED.high,
         low = EXCLUDED.low,
         close = EXCLUDED.close,
         volume = EXCLUDED.volume,
         updated_at = now()`,
      values
    );

    return result.rowCount ?? 0;
  }

  /**
   * Fetch candles by symbol, interval, and time range
   */
  async fetchCandles(input: FetchCandlesInput): Promise<Candle[]> {
    const result = await this.client.query<{
      timestamp: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }>(
      `SELECT timestamp, open, high, low, close, volume
       FROM candles
       WHERE symbol = $1 AND interval = $2
         AND timestamp >= $3 AND timestamp <= $4
       ORDER BY timestamp ASC`,
      [input.symbol, input.interval, input.startTime, input.endTime]
    );

    return result.rows.map(row => ({
      timestamp: parseInt(row.timestamp),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume)
    }));
  }

  /**
   * Detect gaps in candle data
   */
  async detectGaps(
    symbol: string,
    interval: TimeInterval,
    startTime: number,
    endTime: number
  ): Promise<CandleGap[]> {
    const intervalMs = this.getIntervalMs(interval);
    const expectedCandles = Math.floor((endTime - startTime) / intervalMs);

    // Fetch existing candles
    const candles = await this.fetchCandles({ symbol, interval, startTime, endTime });

    if (candles.length === 0) {
      return [{
        symbol,
        interval,
        gapStart: startTime,
        gapEnd: endTime,
        expectedCandles,
        missingCandles: expectedCandles
      }];
    }

    const gaps: CandleGap[] = [];
    let currentTime = startTime;

    for (const candle of candles) {
      // Check if there's a gap before this candle
      if (candle.timestamp - currentTime > intervalMs) {
        const gapCandles = Math.floor((candle.timestamp - currentTime) / intervalMs);
        gaps.push({
          symbol,
          interval,
          gapStart: currentTime,
          gapEnd: candle.timestamp,
          expectedCandles: gapCandles,
          missingCandles: gapCandles
        });
      }
      currentTime = candle.timestamp + intervalMs;
    }

    // Check if there's a gap at the end
    if (endTime - currentTime > intervalMs) {
      const gapCandles = Math.floor((endTime - currentTime) / intervalMs);
      gaps.push({
        symbol,
        interval,
        gapStart: currentTime,
        gapEnd: endTime,
        expectedCandles: gapCandles,
        missingCandles: gapCandles
      });
    }

    return gaps;
  }

  /**
   * Get candle count for a symbol and interval
   */
  async getCandleCount(symbol: string, interval: TimeInterval): Promise<number> {
    const result = await this.client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM candles WHERE symbol = $1 AND interval = $2`,
      [symbol, interval]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get time range for stored candles
   */
  async getTimeRange(
    symbol: string,
    interval: TimeInterval
  ): Promise<{ minTime: number; maxTime: number } | null> {
    const result = await this.client.query<{
      min_timestamp: string;
      max_timestamp: string;
    }>(
      `SELECT MIN(timestamp) as min_timestamp, MAX(timestamp) as max_timestamp
       FROM candles
       WHERE symbol = $1 AND interval = $2`,
      [symbol, interval]
    );

    const row = result.rows[0];
    if (!row.min_timestamp || !row.max_timestamp) {
      return null;
    }

    return {
      minTime: parseInt(row.min_timestamp),
      maxTime: parseInt(row.max_timestamp)
    };
  }

  /**
   * Delete candles for a symbol and interval
   */
  async deleteCandles(symbol: string, interval: TimeInterval): Promise<number> {
    const result = await this.client.query(
      `DELETE FROM candles WHERE symbol = $1 AND interval = $2`,
      [symbol, interval]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Get available symbols
   */
  async getAvailableSymbols(): Promise<string[]> {
    const result = await this.client.query<{ symbol: string }>(
      `SELECT DISTINCT symbol FROM candles ORDER BY symbol`
    );

    return result.rows.map(row => row.symbol);
  }

  /**
   * Get available intervals for a symbol
   */
  async getAvailableIntervals(symbol: string): Promise<TimeInterval[]> {
    const result = await this.client.query<{ interval: TimeInterval }>(
      `SELECT DISTINCT interval FROM candles WHERE symbol = $1 ORDER BY interval`,
      [symbol]
    );

    return result.rows.map(row => row.interval);
  }

  private getIntervalMs(interval: TimeInterval): number {
    const map: Record<TimeInterval, number> = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000
    };
    return map[interval];
  }
}
