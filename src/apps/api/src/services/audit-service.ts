/**
 * Audit Service
 *
 * Provides audit logging functionality for tracking user actions
 * and system events for compliance and security monitoring.
 */

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogRepository {
  create(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;
  findByUserId(userId: string, limit: number): Promise<AuditLog[]>;
  findByAction(action: string, limit: number): Promise<AuditLog[]>;
  findByResource(resource: string, resourceId?: string, limit?: number): Promise<AuditLog[]>;
  findByTimeRange(start: Date, end: Date): Promise<AuditLog[]>;
}

export interface AuditLogQuery {
  limit?: number;
  offset?: number;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditLogResult {
  logs: AuditLog[];
  total: number;
}

/**
 * Service for managing audit logs
 */
export class AuditService {
  constructor(private readonly repository: AuditLogRepository) {}

  /**
   * Create a new audit log entry
   */
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    return this.repository.create(entry);
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(query: AuditLogQuery): Promise<AuditLogResult> {
    const { limit = 100, offset = 0, userId, action, resource, startDate, endDate } = query;

    let logs: AuditLog[];

    if (startDate && endDate) {
      logs = await this.repository.findByTimeRange(startDate, endDate);
    } else if (userId) {
      logs = await this.repository.findByUserId(userId, limit + offset);
    } else if (action) {
      logs = await this.repository.findByAction(action, limit + offset);
    } else if (resource) {
      logs = await this.repository.findByResource(resource, undefined, limit + offset);
    } else {
      // Get all logs - would need a new repository method
      logs = await this.repository.findByTimeRange(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        new Date()
      );
    }

    // Apply offset and limit
    const paginatedLogs = logs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      total: logs.length
    };
  }

  /**
   * Get logs for a specific user
   */
  async getUserLogs(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.repository.findByUserId(userId, limit);
  }

  /**
   * Get logs for a specific action
   */
  async getActionLogs(action: string, limit: number = 100): Promise<AuditLog[]> {
    return this.repository.findByAction(action, limit);
  }

  /**
   * Get logs for a specific resource
   */
  async getResourceLogs(resource: string, resourceId?: string, limit: number = 100): Promise<AuditLog[]> {
    return this.repository.findByResource(resource, resourceId, limit);
  }

  /**
   * Get logs within a time range
   */
  async getLogsByTimeRange(start: Date, end: Date): Promise<AuditLog[]> {
    return this.repository.findByTimeRange(start, end);
  }
}
