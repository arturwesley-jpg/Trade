import type { Client } from "pg";
import type {
  AlertRule,
  AlertEvent,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  AlertStatistics
} from "./types.js";

export class AlertRepository {
  constructor(private client: Client) {}

  /**
   * Create a new alert rule
   */
  async createRule(userId: string, request: CreateAlertRuleRequest): Promise<AlertRule> {
    const id = `alert-rule-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const result = await this.client.query(
      `INSERT INTO alert_rules (
        id, user_id, name, description, type, symbol, conditions,
        frequency, status, cooldown_minutes, expires_at, delivery_channels,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id,
        userId,
        request.name,
        request.description || null,
        request.type,
        request.symbol || null,
        JSON.stringify(request.conditions),
        request.frequency,
        "active",
        request.cooldownMinutes || 60,
        request.expiresAt || null,
        JSON.stringify(request.deliveryChannels || ["telegram", "in-app"]),
        now,
        now
      ]
    );

    return this.mapRuleRow(result.rows[0]);
  }

  /**
   * Get alert rule by ID
   */
  async getRuleById(ruleId: string): Promise<AlertRule | null> {
    const result = await this.client.query(
      "SELECT * FROM alert_rules WHERE id = $1",
      [ruleId]
    );

    return result.rows.length > 0 ? this.mapRuleRow(result.rows[0]) : null;
  }

  /**
   * Get all alert rules for a user
   */
  async getRulesByUserId(userId: string, status?: string): Promise<AlertRule[]> {
    const query = status
      ? "SELECT * FROM alert_rules WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC"
      : "SELECT * FROM alert_rules WHERE user_id = $1 ORDER BY created_at DESC";

    const params = status ? [userId, status] : [userId];
    const result = await this.client.query(query, params);

    return result.rows.map(row => this.mapRuleRow(row));
  }

  /**
   * Get active alert rules (for evaluation)
   */
  async getActiveRules(symbol?: string): Promise<AlertRule[]> {
    const query = symbol
      ? "SELECT * FROM alert_rules WHERE status = 'active' AND (symbol = $1 OR symbol IS NULL)"
      : "SELECT * FROM alert_rules WHERE status = 'active'";

    const params = symbol ? [symbol] : [];
    const result = await this.client.query(query, params);

    return result.rows.map(row => this.mapRuleRow(row));
  }

  /**
   * Update alert rule
   */
  async updateRule(ruleId: string, userId: string, request: UpdateAlertRuleRequest): Promise<AlertRule | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }

    if (request.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(request.description);
    }

    if (request.conditions !== undefined) {
      updates.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(request.conditions));
    }

    if (request.frequency !== undefined) {
      updates.push(`frequency = $${paramIndex++}`);
      values.push(request.frequency);
    }

    if (request.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(request.status);
    }

    if (request.cooldownMinutes !== undefined) {
      updates.push(`cooldown_minutes = $${paramIndex++}`);
      values.push(request.cooldownMinutes);
    }

    if (request.expiresAt !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(request.expiresAt);
    }

    if (request.deliveryChannels !== undefined) {
      updates.push(`delivery_channels = $${paramIndex++}`);
      values.push(JSON.stringify(request.deliveryChannels));
    }

    if (updates.length === 0) {
      return this.getRuleById(ruleId);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());

    values.push(ruleId, userId);

    const result = await this.client.query(
      `UPDATE alert_rules SET ${updates.join(", ")}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.mapRuleRow(result.rows[0]) : null;
  }

  /**
   * Update rule last triggered timestamp
   */
  async updateRuleLastTriggered(ruleId: string): Promise<void> {
    await this.client.query(
      "UPDATE alert_rules SET last_triggered_at = $1 WHERE id = $2",
      [new Date().toISOString(), ruleId]
    );
  }

  /**
   * Delete alert rule
   */
  async deleteRule(ruleId: string, userId: string): Promise<boolean> {
    const result = await this.client.query(
      "DELETE FROM alert_rules WHERE id = $1 AND user_id = $2",
      [ruleId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Create alert event
   */
  async createEvent(event: Omit<AlertEvent, "id" | "createdAt">): Promise<AlertEvent> {
    const id = `alert-event-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const result = await this.client.query(
      `INSERT INTO alert_events (
        id, rule_id, user_id, type, severity, title, message, context,
        status, delivery_channels, delivery_attempts, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        id,
        event.ruleId,
        event.userId,
        event.type,
        event.severity,
        event.title,
        event.message,
        JSON.stringify(event.context),
        event.status,
        JSON.stringify(event.deliveryChannels),
        event.deliveryAttempts,
        now
      ]
    );

    return this.mapEventRow(result.rows[0]);
  }

  /**
   * Get alert events for a user
   */
  async getEventsByUserId(
    userId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<{ events: AlertEvent[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options || {};

    const whereClause = status
      ? "WHERE user_id = $1 AND status = $2"
      : "WHERE user_id = $1";

    const params = status ? [userId, status] : [userId];

    // Get total count
    const countResult = await this.client.query(
      `SELECT COUNT(*) FROM alert_events ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get events
    const result = await this.client.query(
      `SELECT * FROM alert_events ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      events: result.rows.map(row => this.mapEventRow(row)),
      total
    };
  }

  /**
   * Get alert event by ID
   */
  async getEventById(eventId: string): Promise<AlertEvent | null> {
    const result = await this.client.query(
      "SELECT * FROM alert_events WHERE id = $1",
      [eventId]
    );

    return result.rows.length > 0 ? this.mapEventRow(result.rows[0]) : null;
  }

  /**
   * Update alert event status
   */
  async updateEventStatus(
    eventId: string,
    status: AlertEvent["status"],
    additionalFields?: { deliveredAt?: string; acknowledgedAt?: string; snoozedUntil?: string; error?: string }
  ): Promise<AlertEvent | null> {
    const updates = ["status = $1"];
    const values: any[] = [status];
    let paramIndex = 2;

    if (additionalFields?.deliveredAt) {
      updates.push(`delivered_at = $${paramIndex++}`);
      values.push(additionalFields.deliveredAt);
    }

    if (additionalFields?.acknowledgedAt) {
      updates.push(`acknowledged_at = $${paramIndex++}`);
      values.push(additionalFields.acknowledgedAt);
    }

    if (additionalFields?.snoozedUntil) {
      updates.push(`snoozed_until = $${paramIndex++}`);
      values.push(additionalFields.snoozedUntil);
    }

    if (additionalFields?.error) {
      updates.push(`error = $${paramIndex++}`);
      values.push(additionalFields.error);
    }

    values.push(eventId);

    const result = await this.client.query(
      `UPDATE alert_events SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.mapEventRow(result.rows[0]) : null;
  }

  /**
   * Increment delivery attempts
   */
  async incrementDeliveryAttempts(eventId: string): Promise<void> {
    await this.client.query(
      "UPDATE alert_events SET delivery_attempts = delivery_attempts + 1 WHERE id = $1",
      [eventId]
    );
  }

  /**
   * Get alert statistics for a user
   */
  async getStatistics(userId: string): Promise<AlertStatistics> {
    const rulesResult = await this.client.query(
      `SELECT status, COUNT(*) as count
       FROM alert_rules
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );

    const eventsResult = await this.client.query(
      `SELECT status, COUNT(*) as count
       FROM alert_events
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );

    const last24hResult = await this.client.query(
      `SELECT COUNT(*) as count
       FROM alert_events
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    const ruleStats = new Map(rulesResult.rows.map(r => [r.status, parseInt(r.count)]));
    const eventStats = new Map(eventsResult.rows.map(r => [r.status, parseInt(r.count)]));

    return {
      totalRules: Array.from(ruleStats.values()).reduce((sum, count) => sum + count, 0),
      activeRules: ruleStats.get("active") || 0,
      pausedRules: ruleStats.get("paused") || 0,
      totalEvents: Array.from(eventStats.values()).reduce((sum, count) => sum + count, 0),
      pendingEvents: eventStats.get("pending") || 0,
      deliveredEvents: eventStats.get("delivered") || 0,
      acknowledgedEvents: eventStats.get("acknowledged") || 0,
      failedEvents: eventStats.get("failed") || 0,
      last24hEvents: parseInt(last24hResult.rows[0].count)
    };
  }

  /**
   * Clean up old events
   */
  async cleanupOldEvents(daysToKeep = 30): Promise<number> {
    const result = await this.client.query(
      `DELETE FROM alert_events
       WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`,
      []
    );

    return result.rowCount || 0;
  }

  private mapRuleRow(row: any): AlertRule {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      symbol: row.symbol,
      conditions: JSON.parse(row.conditions),
      frequency: row.frequency,
      status: row.status,
      cooldownMinutes: row.cooldown_minutes,
      expiresAt: row.expires_at,
      deliveryChannels: JSON.parse(row.delivery_channels),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastTriggeredAt: row.last_triggered_at
    };
  }

  private mapEventRow(row: any): AlertEvent {
    return {
      id: row.id,
      ruleId: row.rule_id,
      userId: row.user_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      context: JSON.parse(row.context),
      status: row.status,
      deliveryChannels: JSON.parse(row.delivery_channels),
      deliveryAttempts: row.delivery_attempts,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
      acknowledgedAt: row.acknowledged_at,
      snoozedUntil: row.snoozed_until,
      error: row.error
    };
  }
}
