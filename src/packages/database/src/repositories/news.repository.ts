import { DatabaseClient } from '../client';
import { NewsEvent } from '../models';

export interface NewsEventRepository {
  create(event: Omit<NewsEvent, 'id' | 'createdAt'>): Promise<NewsEvent>;
  findBySymbol(symbol: string, limit?: number): Promise<NewsEvent[]>;
  findBySentiment(sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL', limit?: number): Promise<NewsEvent[]>;
  findByTimeRange(start: Date, end: Date): Promise<NewsEvent[]>;
  findRecent(limit?: number): Promise<NewsEvent[]>;
}

export class PostgresNewsEventRepository implements NewsEventRepository {
  constructor(private db: DatabaseClient) {}

  async create(event: Omit<NewsEvent, 'id' | 'createdAt'>): Promise<NewsEvent> {
    const result = await this.db.query<NewsEvent>(
      `INSERT INTO news_events (title, content, source, url, sentiment, sentiment_score, symbols, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [event.title, event.content, event.source, event.url, event.sentiment, event.sentimentScore, event.symbols, event.publishedAt]
    );
    return result.rows[0];
  }

  async findBySymbol(symbol: string, limit: number = 50): Promise<NewsEvent[]> {
    const result = await this.db.query<NewsEvent>(
      `SELECT * FROM news_events WHERE $1 = ANY(symbols) ORDER BY published_at DESC LIMIT $2`,
      [symbol, limit]
    );
    return result.rows;
  }

  async findBySentiment(sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL', limit: number = 50): Promise<NewsEvent[]> {
    const result = await this.db.query<NewsEvent>(
      `SELECT * FROM news_events WHERE sentiment = $1 ORDER BY published_at DESC LIMIT $2`,
      [sentiment, limit]
    );
    return result.rows;
  }

  async findByTimeRange(start: Date, end: Date): Promise<NewsEvent[]> {
    const result = await this.db.query<NewsEvent>(
      `SELECT * FROM news_events WHERE published_at >= $1 AND published_at <= $2 ORDER BY published_at ASC`,
      [start, end]
    );
    return result.rows;
  }

  async findRecent(limit: number = 20): Promise<NewsEvent[]> {
    const result = await this.db.query<NewsEvent>(
      `SELECT * FROM news_events ORDER BY published_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}
