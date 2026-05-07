import { DatabaseClient } from '../client';
import { WhaleEvent } from '../models';

export interface WhaleEventRepository {
  create(event: Omit<WhaleEvent, 'id'>): Promise<WhaleEvent>;
  findBySymbol(symbol: string, limit?: number): Promise<WhaleEvent[]>;
  findBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', limit?: number): Promise<WhaleEvent[]>;
  findByTimeRange(start: Date, end: Date): Promise<WhaleEvent[]>;
  findRecent(limit?: number): Promise<WhaleEvent[]>;
}

export class PostgresWhaleEventRepository implements WhaleEventRepository {
  constructor(private db: DatabaseClient) {}

  async create(event: Omit<WhaleEvent, 'id'>): Promise<WhaleEvent> {
    const result = await this.db.query<WhaleEvent>(
      `INSERT INTO whale_events (event_type, symbol, amount, usd_value, source, destination, severity, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [event.eventType, event.symbol, event.amount, event.usdValue, event.source, event.destination, event.severity, event.timestamp]
    );
    return result.rows[0];
  }

  async findBySymbol(symbol: string, limit: number = 50): Promise<WhaleEvent[]> {
    const result = await this.db.query<WhaleEvent>(
      `SELECT * FROM whale_events WHERE symbol = $1 ORDER BY timestamp DESC LIMIT $2`,
      [symbol, limit]
    );
    return result.rows;
  }

  async findBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', limit: number = 50): Promise<WhaleEvent[]> {
    const result = await this.db.query<WhaleEvent>(
      `SELECT * FROM whale_events WHERE severity = $1 ORDER BY timestamp DESC LIMIT $2`,
      [severity, limit]
    );
    return result.rows;
  }

  async findByTimeRange(start: Date, end: Date): Promise<WhaleEvent[]> {
    const result = await this.db.query<WhaleEvent>(
      `SELECT * FROM whale_events WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp ASC`,
      [start, end]
    );
    return result.rows;
  }

  async findRecent(limit: number = 20): Promise<WhaleEvent[]> {
    const result = await this.db.query<WhaleEvent>(
      `SELECT * FROM whale_events ORDER BY timestamp DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}
