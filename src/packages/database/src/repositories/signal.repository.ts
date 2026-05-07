import { DatabaseClient } from '../client';
import { Signal } from '../models';

export interface SignalRepository {
  create(signal: Omit<Signal, 'id'>): Promise<Signal>;
  findBySymbol(symbol: string, limit?: number): Promise<Signal[]>;
  findByType(type: 'BUY' | 'SELL' | 'NEUTRAL', limit?: number): Promise<Signal[]>;
  findExecutable(minConfidence?: number): Promise<Signal[]>;
  findByTimeRange(start: Date, end: Date): Promise<Signal[]>;
  findById(id: string): Promise<Signal | null>;
  findActive(symbol?: string): Promise<Signal[]>;
  update(id: string, data: Partial<Signal>): Promise<Signal>;
  findByDateRange(symbol: string, start: Date, end: Date): Promise<Signal[]>;
}

export class PostgresSignalRepository implements SignalRepository {
  constructor(private db: DatabaseClient) {}

  async create(signal: Omit<Signal, 'id'>): Promise<Signal> {
    const result = await this.db.query<Signal>(
      `INSERT INTO signals (symbol, type, confidence, score, rationale, indicators, sentiment_score, whale_impact, should_execute, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        signal.symbol,
        signal.type,
        signal.confidence,
        signal.score,
        JSON.stringify(signal.rationale),
        JSON.stringify(signal.indicators),
        signal.sentimentScore,
        signal.whaleImpact,
        signal.shouldExecute,
        signal.timestamp
      ]
    );
    return result.rows[0];
  }

  async findBySymbol(symbol: string, limit: number = 50): Promise<Signal[]> {
    const result = await this.db.query<Signal>(
      `SELECT * FROM signals
       WHERE symbol = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [symbol, limit]
    );
    return result.rows;
  }

  async findByType(type: 'BUY' | 'SELL' | 'NEUTRAL', limit: number = 50): Promise<Signal[]> {
    const result = await this.db.query<Signal>(
      `SELECT * FROM signals
       WHERE type = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [type, limit]
    );
    return result.rows;
  }

  async findExecutable(minConfidence: number = 0.7): Promise<Signal[]> {
    const result = await this.db.query<Signal>(
      `SELECT * FROM signals
       WHERE should_execute = true AND confidence >= $1
       ORDER BY confidence DESC, timestamp DESC`,
      [minConfidence]
    );
    return result.rows;
  }

  async findByTimeRange(start: Date, end: Date): Promise<Signal[]> {
    const result = await this.db.query<Signal>(
      `SELECT * FROM signals
       WHERE timestamp >= $1 AND timestamp <= $2
       ORDER BY timestamp ASC`,
      [start, end]
    );
    return result.rows;
  }

  async findById(id: string): Promise<Signal | null> {
    const result = await this.db.query<Signal>(
      `SELECT * FROM signals WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findActive(symbol?: string): Promise<Signal[]> {
    const query = symbol
      ? `SELECT * FROM signals WHERE symbol = $1 AND should_execute = true ORDER BY timestamp DESC`
      : `SELECT * FROM signals WHERE should_execute = true ORDER BY timestamp DESC`;
    const params = symbol ? [symbol] : [];
    const result = await this.db.query<Signal>(query, params);
    return result.rows;
  }

  async update(id: string, data: Partial<Signal>): Promise<Signal> {
    const fields = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = Object.values(data);
    const result = await this.db.query<Signal>(
      `UPDATE signals SET ${fields} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  async findByDateRange(symbol: string, start: Date, end: Date): Promise<Signal[]> {
    const result = await this.db.query<Signal>(
      `SELECT * FROM signals
       WHERE symbol = $1 AND timestamp >= $2 AND timestamp <= $3
       ORDER BY timestamp ASC`,
      [symbol, start, end]
    );
    return result.rows;
  }
}
