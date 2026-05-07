import { DatabaseClient } from '../client';
import { AuditLog } from '../models';

export interface AuditLogRepository {
  create(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;
  findByUserId(userId: string, limit?: number): Promise<AuditLog[]>;
  findByAction(action: string, limit?: number): Promise<AuditLog[]>;
  findByResource(resource: string, resourceId?: string, limit?: number): Promise<AuditLog[]>;
  findByTimeRange(start: Date, end: Date): Promise<AuditLog[]>;
}

export class PostgresAuditLogRepository implements AuditLogRepository {
  constructor(private db: DatabaseClient) {}

  async create(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const result = await this.db.query<AuditLog>(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [log.userId, log.action, log.resource, log.resourceId, JSON.stringify(log.details), log.ipAddress, log.userAgent]
    );
    return result.rows[0];
  }

  async findByUserId(userId: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await this.db.query<AuditLog>(
      `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  async findByAction(action: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await this.db.query<AuditLog>(
      `SELECT * FROM audit_logs WHERE action = $1 ORDER BY timestamp DESC LIMIT $2`,
      [action, limit]
    );
    return result.rows;
  }

  async findByResource(resource: string, resourceId?: string, limit: number = 100): Promise<AuditLog[]> {
    const query = resourceId
      ? `SELECT * FROM audit_logs WHERE resource = $1 AND resource_id = $2 ORDER BY timestamp DESC LIMIT $3`
      : `SELECT * FROM audit_logs WHERE resource = $1 ORDER BY timestamp DESC LIMIT $2`;

    const params = resourceId ? [resource, resourceId, limit] : [resource, limit];
    const result = await this.db.query<AuditLog>(query, params);
    return result.rows;
  }

  async findByTimeRange(start: Date, end: Date): Promise<AuditLog[]> {
    const result = await this.db.query<AuditLog>(
      `SELECT * FROM audit_logs WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp ASC`,
      [start, end]
    );
    return result.rows;
  }
}
