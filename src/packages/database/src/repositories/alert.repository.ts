import { DatabaseClient } from '../client';
import { Alert, AlertRule } from '../models';

export interface AlertRepository {
  create(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<Alert>;
  findById(id: string): Promise<Alert | null>;
  findByStatus(status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED', limit?: number): Promise<Alert[]>;
  findBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', limit?: number): Promise<Alert[]>;
  acknowledge(id: string): Promise<Alert>;
  resolve(id: string): Promise<Alert>;
}

export interface AlertRuleRepository {
  create(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule>;
  findById(id: string): Promise<AlertRule | null>;
  findEnabled(): Promise<AlertRule[]>;
  update(id: string, updates: Partial<AlertRule>): Promise<AlertRule>;
  delete(id: string): Promise<void>;
}

export class PostgresAlertRepository implements AlertRepository {
  constructor(private db: DatabaseClient) {}

  async create(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<Alert> {
    const result = await this.db.query<Alert>(
      `INSERT INTO alerts (rule_id, type, severity, title, message, data, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [alert.ruleId, alert.type, alert.severity, alert.title, alert.message, JSON.stringify(alert.data), alert.status]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Alert | null> {
    const result = await this.db.query<Alert>(
      `SELECT * FROM alerts WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByStatus(status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED', limit: number = 50): Promise<Alert[]> {
    const result = await this.db.query<Alert>(
      `SELECT * FROM alerts WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
      [status, limit]
    );
    return result.rows;
  }

  async findBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', limit: number = 50): Promise<Alert[]> {
    const result = await this.db.query<Alert>(
      `SELECT * FROM alerts WHERE severity = $1 ORDER BY created_at DESC LIMIT $2`,
      [severity, limit]
    );
    return result.rows;
  }

  async acknowledge(id: string): Promise<Alert> {
    const result = await this.db.query<Alert>(
      `UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  async resolve(id: string): Promise<Alert> {
    const result = await this.db.query<Alert>(
      `UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
}

export class PostgresAlertRuleRepository implements AlertRuleRepository {
  constructor(private db: DatabaseClient) {}

  async create(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const result = await this.db.query<AlertRule>(
      `INSERT INTO alert_rules (name, type, conditions, actions, enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [rule.name, rule.type, JSON.stringify(rule.conditions), JSON.stringify(rule.actions), rule.enabled]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<AlertRule | null> {
    const result = await this.db.query<AlertRule>(
      `SELECT * FROM alert_rules WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findEnabled(): Promise<AlertRule[]> {
    const result = await this.db.query<AlertRule>(
      `SELECT * FROM alert_rules WHERE enabled = true`
    );
    return result.rows;
  }

  async update(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${this.toSnakeCase(key)} = $${paramIndex}`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    });

    values.push(id);

    const result = await this.db.query<AlertRule>(
      `UPDATE alert_rules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.query(`DELETE FROM alert_rules WHERE id = $1`, [id]);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
