import { DatabaseClient } from '../client';
import { SentimentSnapshot } from '../models';

export interface SentimentSnapshotRepository {
  create(snapshot: Omit<SentimentSnapshot, 'id'>): Promise<SentimentSnapshot>;
  findBySymbol(symbol: string, limit?: number): Promise<SentimentSnapshot[]>;
  findBySource(source: string, limit?: number): Promise<SentimentSnapshot[]>;
  findByTimeRange(symbol: string, start: Date, end: Date): Promise<SentimentSnapshot[]>;
  getLatest(symbol: string): Promise<SentimentSnapshot | null>;
  getAggregated(symbol: string, hours?: number): Promise<{
    avgScore: number;
    totalVolume: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
  }>;
}

export class PostgresSentimentSnapshotRepository implements SentimentSnapshotRepository {
  constructor(private db: DatabaseClient) {}

  async create(snapshot: Omit<SentimentSnapshot, 'id'>): Promise<SentimentSnapshot> {
    const result = await this.db.query<SentimentSnapshot>(
      `INSERT INTO sentiment_snapshots (symbol, source, score, volume, positive_count, negative_count, neutral_count, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [snapshot.symbol, snapshot.source, snapshot.score, snapshot.volume, snapshot.positiveCount, snapshot.negativeCount, snapshot.neutralCount, snapshot.timestamp]
    );
    return result.rows[0];
  }

  async findBySymbol(symbol: string, limit: number = 50): Promise<SentimentSnapshot[]> {
    const result = await this.db.query<SentimentSnapshot>(
      `SELECT * FROM sentiment_snapshots WHERE symbol = $1 ORDER BY timestamp DESC LIMIT $2`,
      [symbol, limit]
    );
    return result.rows;
  }

  async findBySource(source: string, limit: number = 50): Promise<SentimentSnapshot[]> {
    const result = await this.db.query<SentimentSnapshot>(
      `SELECT * FROM sentiment_snapshots WHERE source = $1 ORDER BY timestamp DESC LIMIT $2`,
      [source, limit]
    );
    return result.rows;
  }

  async findByTimeRange(symbol: string, start: Date, end: Date): Promise<SentimentSnapshot[]> {
    const result = await this.db.query<SentimentSnapshot>(
      `SELECT * FROM sentiment_snapshots WHERE symbol = $1 AND timestamp >= $2 AND timestamp <= $3 ORDER BY timestamp ASC`,
      [symbol, start, end]
    );
    return result.rows;
  }

  async getLatest(symbol: string): Promise<SentimentSnapshot | null> {
    const result = await this.db.query<SentimentSnapshot>(
      `SELECT * FROM sentiment_snapshots WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`,
      [symbol]
    );
    return result.rows[0] || null;
  }

  async getAggregated(symbol: string, hours: number = 24): Promise<{
    avgScore: number;
    totalVolume: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
  }> {
    const result = await this.db.query(
      `SELECT
         ROUND(AVG(score), 2) as avg_score,
         SUM(volume) as total_volume,
         SUM(positive_count) as positive_count,
         SUM(negative_count) as negative_count,
         SUM(neutral_count) as neutral_count
       FROM sentiment_snapshots
       WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '${hours} hours'`,
      [symbol]
    );

    const row = result.rows[0];
    return {
      avgScore: parseFloat(row.avg_score) || 0,
      totalVolume: parseInt(row.total_volume) || 0,
      positiveCount: parseInt(row.positive_count) || 0,
      negativeCount: parseInt(row.negative_count) || 0,
      neutralCount: parseInt(row.neutral_count) || 0,
    };
  }
}
