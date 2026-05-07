import { DatabaseClient } from '../client';
import { Trade } from '../models';

export interface TradeRepository {
  create(trade: Omit<Trade, 'id'>): Promise<Trade>;
  findByPositionId(positionId: string): Promise<Trade[]>;
  findBySymbol(symbol: string, limit?: number): Promise<Trade[]>;
  findByMode(mode: 'PAPER' | 'LIVE', limit?: number): Promise<Trade[]>;
  findByTimeRange(start: Date, end: Date): Promise<Trade[]>;
}

export class PostgresTradeRepository implements TradeRepository {
  constructor(private db: DatabaseClient) {}

  async create(trade: Omit<Trade, 'id'>): Promise<Trade> {
    const result = await this.db.query<Trade>(
      `INSERT INTO trades (position_id, symbol, side, price, quantity, fee, pnl, mode, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [trade.positionId, trade.symbol, trade.side, trade.price, trade.quantity, trade.fee, trade.pnl, trade.mode, trade.timestamp]
    );
    return result.rows[0];
  }

  async findByPositionId(positionId: string): Promise<Trade[]> {
    const result = await this.db.query<Trade>(
      `SELECT * FROM trades WHERE position_id = $1 ORDER BY timestamp DESC`,
      [positionId]
    );
    return result.rows;
  }

  async findBySymbol(symbol: string, limit: number = 100): Promise<Trade[]> {
    const result = await this.db.query<Trade>(
      `SELECT * FROM trades WHERE symbol = $1 ORDER BY timestamp DESC LIMIT $2`,
      [symbol, limit]
    );
    return result.rows;
  }

  async findByMode(mode: 'PAPER' | 'LIVE', limit: number = 100): Promise<Trade[]> {
    const result = await this.db.query<Trade>(
      `SELECT * FROM trades WHERE mode = $1 ORDER BY timestamp DESC LIMIT $2`,
      [mode, limit]
    );
    return result.rows;
  }

  async findByTimeRange(start: Date, end: Date): Promise<Trade[]> {
    const result = await this.db.query<Trade>(
      `SELECT * FROM trades WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp ASC`,
      [start, end]
    );
    return result.rows;
  }
}
