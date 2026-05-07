import { DatabaseClient } from '../client';
import { Position } from '../models';

export interface PositionRepository {
  create(position: Omit<Position, 'id'>): Promise<Position>;
  findById(id: string): Promise<Position | null>;
  findBySymbol(symbol: string): Promise<Position[]>;
  findOpen(mode?: 'PAPER' | 'LIVE'): Promise<Position[]>;
  update(id: string, updates: Partial<Position>): Promise<Position>;
  close(id: string, closedPrice: string, realizedPnl: string): Promise<Position>;
}

export class PostgresPositionRepository implements PositionRepository {
  constructor(private db: DatabaseClient) {}

  async create(position: Omit<Position, 'id'>): Promise<Position> {
    const result = await this.db.query<Position>(
      `INSERT INTO positions (symbol, side, entry_price, current_price, quantity, leverage, stop_loss, take_profit, mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        position.symbol,
        position.side,
        position.entryPrice,
        position.currentPrice,
        position.quantity,
        position.leverage,
        position.stopLoss,
        position.takeProfit,
        position.mode
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Position | null> {
    const result = await this.db.query<Position>(
      `SELECT * FROM positions WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findBySymbol(symbol: string): Promise<Position[]> {
    const result = await this.db.query<Position>(
      `SELECT * FROM positions WHERE symbol = $1 ORDER BY opened_at DESC`,
      [symbol]
    );
    return result.rows;
  }

  async findOpen(mode?: 'PAPER' | 'LIVE'): Promise<Position[]> {
    const query = mode
      ? `SELECT * FROM positions WHERE status = 'OPEN' AND mode = $1 ORDER BY opened_at DESC`
      : `SELECT * FROM positions WHERE status = 'OPEN' ORDER BY opened_at DESC`;

    const result = await this.db.query<Position>(query, mode ? [mode] : []);
    return result.rows;
  }

  async update(id: string, updates: Partial<Position>): Promise<Position> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${this.toSnakeCase(key)} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    values.push(id);

    const result = await this.db.query<Position>(
      `UPDATE positions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async close(id: string, closedPrice: string, realizedPnl: string): Promise<Position> {
    const result = await this.db.query<Position>(
      `UPDATE positions
       SET status = 'CLOSED', current_price = $1, realized_pnl = $2, closed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [closedPrice, realizedPnl, id]
    );
    return result.rows[0];
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
