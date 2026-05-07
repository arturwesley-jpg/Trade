import type { Client } from "pg";
import { randomUUID } from "node:crypto";

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: "info" | "warning" | "critical";
  timestamp: string;
}

export interface AuditLoggerConfig {
  pgClient?: Client;
  enableConsoleLog?: boolean;
}

/**
 * Tamper-proof audit logging service
 */
export class AuditLogger {
  private pgClient?: Client;
  private enableConsoleLog: boolean;
  private inMemoryLogs: AuditLogEntry[] = [];

  constructor(config: AuditLoggerConfig = {}) {
    this.pgClient = config.pgClient;
    this.enableConsoleLog = config.enableConsoleLog ?? true;
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(data: {
    userId?: string;
    email: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.success ? "AUTH_SUCCESS" : "AUTH_FAILED",
      resource: "authentication",
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: {
        email: data.email,
        reason: data.reason
      },
      severity: data.success ? "info" : "warning"
    });
  }

  /**
   * Log admin action
   */
  async logAdminAction(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...data,
      severity: "critical"
    });
  }

  /**
   * Log sensitive operation
   */
  async logSensitiveOperation(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...data,
      severity: "critical"
    });
  }

  /**
   * Log API key change
   */
  async logApiKeyChange(data: {
    userId: string;
    action: "CREATE" | "REVOKE" | "ROTATE";
    apiKeyId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: `API_KEY_${data.action}`,
      resource: "api_key",
      resourceId: data.apiKeyId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      severity: "critical"
    });
  }

  /**
   * Log withdrawal or financial operation
   */
  async logFinancialOperation(data: {
    userId: string;
    action: string;
    amount: number;
    currency: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.action,
      resource: "financial",
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: {
        amount: data.amount,
        currency: data.currency,
        ...data.metadata
      },
      severity: "critical"
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(data: {
    userId?: string;
    action: string;
    resource: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...data,
      severity: "critical"
    });
  }

  /**
   * Core logging method
   */
  private async log(data: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...data
    };

    // Store in memory
    this.inMemoryLogs.push(entry);

    // Keep only last 1000 logs in memory
    if (this.inMemoryLogs.length > 1000) {
      this.inMemoryLogs.shift();
    }

    // Console log if enabled
    if (this.enableConsoleLog) {
      console.log(`[AUDIT] ${entry.severity.toUpperCase()} - ${entry.action} on ${entry.resource}`, {
        userId: entry.userId,
        resourceId: entry.resourceId,
        ipAddress: entry.ipAddress,
        metadata: entry.metadata
      });
    }

    // Persist to database if available
    if (this.pgClient) {
      try {
        await this.pgClient.query(
          `INSERT INTO audit_logs (id, user_id, action, resource, resource_id, ip_address, user_agent, metadata, severity, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            entry.id,
            entry.userId ?? null,
            entry.action,
            entry.resource,
            entry.resourceId ?? null,
            entry.ipAddress ?? null,
            entry.userAgent ?? null,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            entry.severity,
            entry.timestamp
          ]
        );
      } catch (error) {
        console.error("Failed to persist audit log to database:", error);
      }
    }
  }

  /**
   * Get recent audit logs (from memory)
   */
  getRecentLogs(limit: number = 100): AuditLogEntry[] {
    return this.inMemoryLogs.slice(-limit);
  }

  /**
   * Query audit logs from database
   */
  async queryLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    if (!this.pgClient) {
      return this.inMemoryLogs.filter(log => {
        if (filters.userId && log.userId !== filters.userId) return false;
        if (filters.action && log.action !== filters.action) return false;
        if (filters.resource && log.resource !== filters.resource) return false;
        if (filters.severity && log.severity !== filters.severity) return false;
        return true;
      }).slice(-(filters.limit ?? 100));
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }

    if (filters.resource) {
      conditions.push(`resource = $${paramIndex++}`);
      params.push(filters.resource);
    }

    if (filters.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(filters.severity);
    }

    if (filters.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.startDate.toISOString());
    }

    if (filters.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.endDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit ?? 100;

    const result = await this.pgClient.query<AuditLogEntry>(
      `SELECT id, user_id as "userId", action, resource, resource_id as "resourceId",
              ip_address as "ipAddress", user_agent as "userAgent", metadata, severity, timestamp
       FROM audit_logs
       ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    return result.rows;
  }
}
