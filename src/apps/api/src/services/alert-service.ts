/**
 * Alert Service
 * Manages alert rules with database persistence and lifecycle management
 */

import type {
  AlertRule,
  AlertEvent,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  AlertEvaluationContext,
  AlertStatistics
} from "@trade/trading-core/alerts";
import type { Pool } from "pg";
import { logger } from "@trade/shared";

/** Local rule engine for validation and evaluation */
class AlertRuleEngine {
  validateRule(rule: AlertRule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!rule.name) errors.push("Name is required");
    if (!rule.type) errors.push("Type is required");
    if (!rule.conditions || rule.conditions.length === 0) errors.push("At least one condition is required");
    return { valid: errors.length === 0, errors };
  }

  evaluateRule(rule: AlertRule, context: AlertEvaluationContext): { shouldTrigger: boolean; matchedConditions?: string[]; reason?: string } {
    const matchedConditions: string[] = [];
    for (const condition of rule.conditions) {
      // Basic condition evaluation stub
      matchedConditions.push(condition.field || "unknown");
    }
    return {
      shouldTrigger: matchedConditions.length > 0,
      matchedConditions,
      reason: `Matched ${matchedConditions.length} conditions`,
    };
  }
}

export class AlertService {
  private readonly ruleEngine: AlertRuleEngine;

  constructor(
    private readonly pool: Pool,
    private readonly alertEngine?: any
  ) {
    this.ruleEngine = new AlertRuleEngine();
  }

  /**
   * Create a new alert rule
   */
  async createAlert(userId: string, request: CreateAlertRuleRequest): Promise<AlertRule> {
    // Validate the alert rule
    const validation = this.ruleEngine.validateRule({
      ...request,
      id: "",
      userId,
      status: "active" as const,
      cooldownMinutes: request.cooldownMinutes ?? 0,
      deliveryChannels: request.deliveryChannels ?? [],
      createdAt: "",
      updatedAt: "",
    });

    if (!validation.valid) {
      throw new Error(`Invalid alert rule: ${validation.errors.join(", ")}`);
    }

    const id = this.generateId();
    const now = new Date().toISOString();

    const alert: AlertRule = {
      id,
      userId,
      name: request.name,
      description: request.description,
      type: request.type,
      symbol: request.symbol,
      conditions: request.conditions,
      frequency: request.frequency,
      status: "active",
      cooldownMinutes: request.cooldownMinutes || 5,
      expiresAt: request.expiresAt,
      deliveryChannels: request.deliveryChannels || ["in-app"],
      createdAt: now,
      updatedAt: now,
    };

    // Insert into database
    await this.pool.query(
      `INSERT INTO alert_rules (id, user_id, name, description, type, symbol, conditions, frequency, status, cooldown_minutes, expires_at, delivery_channels, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        alert.id,
        alert.userId,
        alert.name,
        alert.description,
        alert.type,
        alert.symbol,
        JSON.stringify(alert.conditions),
        alert.frequency,
        alert.status,
        alert.cooldownMinutes,
        alert.expiresAt,
        JSON.stringify(alert.deliveryChannels),
        alert.createdAt,
        alert.updatedAt,
      ]
    );

    logger.info("Alert rule created", { alertId: id, userId, type: alert.type });

    return alert;
  }

  /**
   * Get alerts by user ID
   */
  async getAlertsByUserId(userId: string): Promise<AlertRule[]> {
    const result = await this.pool.query(
      `SELECT id, user_id, name, description, type, symbol, conditions, frequency, status, cooldown_minutes, expires_at, delivery_channels, created_at, updated_at, last_triggered_at
       FROM alert_rules
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(this.mapAlertRow);
  }

  async getAlert(userId: string, alertId: string): Promise<AlertRule | null> {
    const result = await this.pool.query(
      `SELECT id, user_id, name, description, type, symbol, conditions, frequency, status, cooldown_minutes, expires_at, delivery_channels, created_at, updated_at, last_triggered_at
       FROM alert_rules
       WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapAlertRow(result.rows[0]);
  }

  async updateAlert(userId: string, alertId: string, request: UpdateAlertRuleRequest): Promise<AlertRule | null> {
    const existing = await this.getAlert(userId, alertId);
    if (!existing) {
      return null;
    }

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

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());

    values.push(alertId, userId);

    await this.pool.query(
      `UPDATE alert_rules SET ${updates.join(", ")} WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}`,
      values
    );

    return this.getAlert(userId, alertId);
  }

  async deleteAlert(userId: string, alertId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM alert_rules WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAlertEvents(userId: string, limit: number = 50): Promise<AlertEvent[]> {
    const result = await this.pool.query(
      `SELECT e.id, e.rule_id, e.user_id, e.type, e.severity, e.title, e.message, e.context, e.status, e.delivery_channels, e.delivery_attempts, e.created_at, e.delivered_at, e.acknowledged_at, e.snoozed_until, e.error
       FROM alert_events e
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(this.mapEventRow);
  }

  async acknowledgeEvent(userId: string, eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE alert_events SET status = 'acknowledged', acknowledged_at = $1 WHERE id = $2 AND user_id = $3`,
      [new Date().toISOString(), eventId, userId]
    );

    const success = result.rowCount !== null && result.rowCount > 0;
    if (success) {
      logger.info("Alert event acknowledged", { eventId, userId });
    }
    return success;
  }

  /**
   * Snooze an alert event for a specified duration
   */
  async snoozeEvent(userId: string, eventId: string, durationMinutes: number): Promise<boolean> {
    const snoozedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const result = await this.pool.query(
      `UPDATE alert_events SET status = 'snoozed', snoozed_until = $1 WHERE id = $2 AND user_id = $3`,
      [snoozedUntil, eventId, userId]
    );

    const success = result.rowCount !== null && result.rowCount > 0;
    if (success) {
      logger.info("Alert event snoozed", { eventId, userId, durationMinutes });
    }
    return success;
  }

  /**
   * Pause an alert rule
   */
  async pauseAlert(userId: string, alertId: string): Promise<AlertRule | null> {
    return this.updateAlert(userId, alertId, { status: "paused" });
  }

  /**
   * Resume a paused alert rule
   */
  async resumeAlert(userId: string, alertId: string): Promise<AlertRule | null> {
    return this.updateAlert(userId, alertId, { status: "active" });
  }

  /**
   * Evaluate alert rules against market context
   */
  async evaluateAlerts(context: AlertEvaluationContext): Promise<AlertEvent[]> {
    // Get active rules for this symbol
    const rules = await this.getActiveRulesBySymbol(context.marketData.symbol);
    const triggeredEvents: AlertEvent[] = [];

    for (const rule of rules) {
      try {
        const evaluation = this.ruleEngine.evaluateRule(rule, context);

        if (evaluation.shouldTrigger) {
          const event = await this.createAlertEvent(rule, context, evaluation.matchedConditions || []);
          triggeredEvents.push(event);

          // Update last triggered timestamp
          await this.pool.query(
            `UPDATE alert_rules SET last_triggered_at = $1 WHERE id = $2`,
            [new Date().toISOString(), rule.id]
          );

          logger.info("Alert triggered", {
            ruleId: rule.id,
            userId: rule.userId,
            symbol: rule.symbol,
            type: rule.type,
            reason: evaluation.reason
          });
        }
      } catch (error) {
        logger.error("Error evaluating alert rule", {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return triggeredEvents;
  }

  /**
   * Get active rules by symbol
   */
  private async getActiveRulesBySymbol(symbol: string): Promise<AlertRule[]> {
    const result = await this.pool.query(
      `SELECT id, user_id, name, description, type, symbol, conditions, frequency, status, cooldown_minutes, expires_at, delivery_channels, created_at, updated_at, last_triggered_at
       FROM alert_rules
       WHERE status = 'active'
       AND (symbol = $1 OR symbol IS NULL)
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [symbol]
    );

    return result.rows.map(this.mapAlertRow);
  }

  /**
   * Create an alert event when a rule triggers
   */
  private async createAlertEvent(
    rule: AlertRule,
    context: AlertEvaluationContext,
    matchedConditions: string[]
  ): Promise<AlertEvent> {
    const id = this.generateId();
    const now = new Date().toISOString();

    // Determine severity based on alert type and conditions
    const severity = this.determineSeverity(rule, context);

    const event: AlertEvent = {
      id,
      ruleId: rule.id,
      userId: rule.userId,
      type: rule.type,
      severity,
      title: rule.name,
      message: this.formatAlertMessage(rule, context, matchedConditions),
      context: {
        symbol: context.marketData.symbol,
        price: context.marketData.price,
        change24hPct: context.marketData.change24hPct,
        matchedConditions,
        indicators: context.indicators
      },
      status: "pending",
      deliveryChannels: rule.deliveryChannels,
      deliveryAttempts: 0,
      createdAt: now
    };

    await this.pool.query(
      `INSERT INTO alert_events (id, rule_id, user_id, type, severity, title, message, context, status, delivery_channels, delivery_attempts, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        event.id,
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
        event.createdAt
      ]
    );

    return event;
  }

  /**
   * Determine alert severity based on rule type and context
   */
  private determineSeverity(rule: AlertRule, context: AlertEvaluationContext): "low" | "medium" | "high" | "critical" {
    switch (rule.type) {
      case "risk":
        // Risk alerts are generally high priority
        return "high";

      case "whale":
        // Large whale movements are medium to high
        return "medium";

      case "news":
        // News alerts vary by impact
        return "medium";

      case "sentiment":
        // Extreme sentiment is medium priority
        return "medium";

      case "indicator":
        // Technical indicators are low to medium
        return "low";

      case "price":
        // Price alerts depend on magnitude
        const changePct = Math.abs(context.marketData.change24hPct || 0);
        if (changePct > 10) return "high";
        if (changePct > 5) return "medium";
        return "low";

      default:
        return "low";
    }
  }

  /**
   * Format alert message with context
   */
  private formatAlertMessage(rule: AlertRule, context: AlertEvaluationContext, matchedConditions: string[]): string {
    const { symbol, price, change24hPct } = context.marketData;

    let message = `${rule.name}\n\n`;
    message += `Symbol: ${symbol}\n`;
    message += `Price: $${price.toFixed(2)}`;
    if (change24hPct !== undefined) {
      message += ` (${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%)`;
    }
    message += `\n\n`;

    if (matchedConditions.length > 0) {
      message += `Conditions met:\n`;
      matchedConditions.forEach(condition => {
        message += `• ${condition}\n`;
      });
    }

    if (context.indicators) {
      message += `\nIndicators:\n`;
      if (context.indicators.rsi !== undefined) {
        message += `• RSI: ${context.indicators.rsi.toFixed(2)}\n`;
      }
      if (context.indicators.macd) {
        message += `• MACD: ${context.indicators.macd.macd.toFixed(2)}\n`;
      }
    }

    return message;
  }

  /**
   * Get alert statistics for a user
   */
  async getAlertStatistics(userId: string): Promise<AlertStatistics> {
    const rulesResult = await this.pool.query(
      `SELECT status, COUNT(*) as count FROM alert_rules WHERE user_id = $1 GROUP BY status`,
      [userId]
    );

    const eventsResult = await this.pool.query(
      `SELECT status, COUNT(*) as count FROM alert_events WHERE user_id = $1 GROUP BY status`,
      [userId]
    );

    const last24hResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM alert_events
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    const stats: AlertStatistics = {
      totalRules: 0,
      activeRules: 0,
      pausedRules: 0,
      totalEvents: 0,
      pendingEvents: 0,
      deliveredEvents: 0,
      acknowledgedEvents: 0,
      failedEvents: 0,
      last24hEvents: parseInt(last24hResult.rows[0]?.count || "0")
    };

    for (const row of rulesResult.rows) {
      const count = parseInt(row.count);
      stats.totalRules += count;
      if (row.status === "active") stats.activeRules = count;
      if (row.status === "paused") stats.pausedRules = count;
    }

    for (const row of eventsResult.rows) {
      const count = parseInt(row.count);
      stats.totalEvents += count;
      if (row.status === "pending") stats.pendingEvents = count;
      if (row.status === "delivered") stats.deliveredEvents = count;
      if (row.status === "acknowledged") stats.acknowledgedEvents = count;
      if (row.status === "failed") stats.failedEvents = count;
    }

    return stats;
  }

  /**
   * Clean up expired alerts
   */
  async cleanupExpiredAlerts(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE alert_rules SET status = 'expired'
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`
    );

    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info("Expired alerts cleaned up", { count });
    }

    return count;
  }

  /**
   * Process pending alert events for delivery
   */
  async processPendingEvents(): Promise<number> {
    const result = await this.pool.query(
      `SELECT id, rule_id, user_id, type, severity, title, message, context, status, delivery_channels, delivery_attempts, created_at, delivered_at, acknowledged_at, snoozed_until, error
       FROM alert_events
       WHERE status = 'pending' OR (status = 'snoozed' AND snoozed_until < NOW())
       ORDER BY created_at ASC
       LIMIT 100`
    );

    const events = result.rows.map(this.mapEventRow);
    let processedCount = 0;

    for (const event of events) {
      try {
        // Mark as delivered (actual delivery would be handled by notification service)
        await this.pool.query(
          `UPDATE alert_events SET status = 'delivered', delivered_at = $1, delivery_attempts = delivery_attempts + 1
           WHERE id = $2`,
          [new Date().toISOString(), event.id]
        );

        processedCount++;

        logger.info("Alert event processed", {
          eventId: event.id,
          userId: event.userId,
          type: event.type
        });
      } catch (error) {
        // Mark as failed
        await this.pool.query(
          `UPDATE alert_events SET status = 'failed', error = $1, delivery_attempts = delivery_attempts + 1
           WHERE id = $2`,
          [error instanceof Error ? error.message : String(error), event.id]
        );

        logger.error("Failed to process alert event", {
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (processedCount > 0) {
      logger.info("Processed pending alert events", { count: processedCount });
    }

    return processedCount;
  }

  private mapAlertRow(row: any): AlertRule {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      symbol: row.symbol,
      conditions: row.conditions,
      frequency: row.frequency,
      status: row.status,
      cooldownMinutes: row.cooldown_minutes,
      expiresAt: row.expires_at,
      deliveryChannels: row.delivery_channels,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastTriggeredAt: row.last_triggered_at,
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
      context: row.context,
      status: row.status,
      deliveryChannels: row.delivery_channels,
      deliveryAttempts: row.delivery_attempts,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
      acknowledgedAt: row.acknowledged_at,
      snoozedUntil: row.snoozed_until,
      error: row.error,
    };
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
