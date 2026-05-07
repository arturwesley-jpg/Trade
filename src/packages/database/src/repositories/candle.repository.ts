import { DatabaseClient } from '../client';
import { OHLCVCandle } from '../models';

export interface CandleRepository {
  create(candle: Omit<OHLCVCandle, 'id'>): Promise<OHLCVCandle>;
  findBySymbolAndInterval(symbol: string, interval: string, limit?: number): Promise<OHLCVCandle[]>;
  findByTimeRange(symbol: string, interval: string, start: Date, end: Date): Promise<OHLCVCandle[]>;
  getLatest(symbol: string, interval: string): Promise<OHLCVCandle | null>;
  upsert(candle: Omit<OHLCVCandle, 'id'>): Promise<OHLCVCandle>;
}

export class PostgresCandleRepository implements CandleRepository {
  constructor(private db: DatabaseClient) {}

  async create(candle: Omit<OHLCVCandle, 'id'>): Promise<OHLCVCandle> {
    const result = await this.db.query<OHLCVCandle>(
      `INSERT INTO ohlcv_candles (symbol, interval, open, high, low, close, volume, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [candle.symbol, candle.interval, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.timestamp]
    );
    return result.rows[0];
  }

  async findBySymbolAndInterval(symbol: string, interval: string, limit: number = 100): Promise<OHLCVCandle[]> {
    const result = await this.db.query<OHLCVCandle>(
      `SELECT * FROM ohlcv_candles
       WHERE symbol = $1 AND interval = $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [symbol, interval, limit]
    );
    return result.rows;
  }

  async findByTimeRange(symbol: string, interval: string, start: Date, end: Date): Promise<OHLCVCandle[]> {
    const result = await this.db.query<OHLCVCandle>(
      `SELECT * FROM ohlcv_candles
       WHERE symbol = $1 AND interval = $2 AND timestamp >= $3 AND timestamp <= $4
       ORDER BY timestamp ASC`,
      [symbol, interval, start, end]
    );
    return result.rows;
  }

  async getLatest(symbol: string, interval: string): Promise<OHLCVCandle | null> {
    const result = await this.db.query<OHLCVCandle>(
      `SELECT * FROM ohlcv_candles
       WHERE symbol = $1 AND interval = $2
       ORDER BY timestamp DESC
       LIMIT 1`,
      [symbol, interval]
    );
    return result.rows[0] || null;
  }

  async upsert(candle: Omit<OHLCVCandle, 'id'>): Promise<OHLCVCandle> {
    const result = await this.db.query<OHLCVCandle>(
      `INSERT INTO ohlcv_candles (symbol, interval, open, high, low, close, volume, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (symbol, interval, timestamp)
       DO UPDATE SET
         open = EXCLUDED.open,
         high = EXCLUDED.high,
         low = EXCLUDED.low,
         close = EXCLUDED.close,
         volume = EXCLUDED.volume
       RETURNING *`,
      [candle.symbol, candle.interval, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.timestamp]
    );
    return result.rows[0];
  }
}
