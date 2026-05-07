import { DatabaseClient } from '../client';
import { MarketTick } from '../models';

export interface MarketTickRepository {
  create(tick: Omit<MarketTick, 'id'>): Promise<MarketTick>;
  findBySymbol(symbol: string, limit?: number): Promise<MarketTick[]>;
  findByTimeRange(symbol: string, start: Date, end: Date): Promise<MarketTick[]>;
  getLatest(symbol: string): Promise<MarketTick | null>;
  deleteOlderThan(date: Date): Promise<number>;
}

export class PostgresMarketTickRepository implements MarketTickRepository {
  constructor(private db: DatabaseClient) {}

  async create(tick: Omit<MarketTick, 'id'>): Promise<MarketTick> {
    const result = await this.db.query<MarketTick>(
      `INSERT INTO market_ticks (symbol, price, volume, timestamp, provider, quality_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tick.symbol, tick.price, tick.volume, tick.timestamp, tick.provider, tick.qualityScore]
    );
    return result.rows[0];
  }

  async findBySymbol(symbol: string, limit: number = 100): Promise<MarketTick[]> {
    const result = await this.db.query<MarketTick>(
      `SELECT * FROM market_ticks
       WHERE symbol = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [symbol, limit]
    );
    return result.rows;
  }

  async findByTimeRange(symbol: string, start: Date, end: Date): Promise<MarketTick[]> {
    const result = await this.db.query<MarketTick>(
      `SELECT * FROM market_ticks
       WHERE symbol = $1 AND timestamp >= $2 AND timestamp <= $3
       ORDER BY timestamp ASC`,
      [symbol, start, end]
    );
    return result.rows;
  }

  async getLatest(symbol: string): Promise<MarketTick | null> {
    const result = await this.db.query<MarketTick>(
      `SELECT * FROM market_ticks
       WHERE symbol = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [symbol]
    );
    return result.rows[0] || null;
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM market_ticks WHERE timestamp < $1`,
      [date]
    );
    return result.rowCount || 0;
  }
}
