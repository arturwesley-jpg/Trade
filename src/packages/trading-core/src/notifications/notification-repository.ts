/**
 * Notification Repository
 * Database operations for notifications and preferences
 */

import type { Client } from "pg";
import type {
  Notification,
  NotificationPreferences,
  NotificationTemplate,
  NotificationHistory,
  NotificationStats,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  UpdatePreferencesRequest,
  PushSubscription
} from "./types.js";

export class NotificationRepository {
  constructor(private client: Client) {}

  /**
   * Create notification
   */
  async createNotification(notification: Omit<Notification, "id" | "createdAt" | "updatedAt">): Promise<Notification> {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const result = await this.client.query(
      `INSERT INTO notifications (
        id, user_id, channel, priority, status, subject, title, body, data,
        template_id, alert_event_id, group_id, scheduled_for, retry_count,
        max_retries, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        id,
        notification.userId,
        notification.channel,
        notification.priority,
        notification.status,
        notification.subject || null,
        notification.title,
        notification.body,
        JSON.stringify(notification.data || {}),
        notification.templateId || null,
        notification.alertEventId || null,
        notification.groupId || null,
        notification.scheduledFor || null,
        notification.retryCount,
        notification.maxRetries,
        now,
        now
      ]
    );

    return this.mapNotificationRow(result.rows[0]);
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: string): Promise<Notification | null> {
    const result = await this.client.query(
      "SELECT * FROM notifications WHERE id = $1",
      [id]
    );

    return result.rows.length > 0 ? this.mapNotificationRow(result.rows[0]) : null;
  }

  /**
   * Get notifications by user ID
   */
  async getNotificationsByUserId(
    userId: string,
    options: {
      channel?: string;
      status?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<NotificationHistory> {
    const { channel, status, priority, limit = 50, offset = 0 } = options;

    let query = "SELECT * FROM notifications WHERE user_id = $1";
    const params: any[] = [userId];
    let paramIndex = 2;

    if (channel) {
      query += ` AND channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.client.query(query, params);

    // Get total count
    const countQuery = "SELECT COUNT(*) FROM notifications WHERE user_id = $1";
    const countResult = await this.client.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].count);

    return {
      notifications: result.rows.map(row => this.mapNotificationRow(row)),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit
    };
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(
    id: string,
    status: Notification["status"],
    error?: string
  ): Promise<void> {
    const updates: string[] = ["status = $2", "updated_at = $3"];
    const params: any[] = [id, status, new Date().toISOString()];
    let paramIndex = 4;

    if (status === "delivered") {
      updates.push(`delivered_at = $${paramIndex}`);
      params.push(new Date().toISOString());
      paramIndex++;
    } else if (status === "failed") {
      updates.push(`failed_at = $${paramIndex}`);
      params.push(new Date().toISOString());
      paramIndex++;
    }

    if (status === "sending") {
      updates.push(`sent_at = $${paramIndex}`);
      params.push(new Date().toISOString());
      paramIndex++;
    }

    if (error) {
      updates.push(`error = $${paramIndex}`);
      params.push(error);
    }

    await this.client.query(
      `UPDATE notifications SET ${updates.join(", ")} WHERE id = $1`,
      params
    );
  }

  /**
   * Increment retry count
   */
  async incrementRetryCount(id: string): Promise<void> {
    await this.client.query(
      "UPDATE notifications SET retry_count = retry_count + 1, updated_at = $2 WHERE id = $1",
      [id, new Date().toISOString()]
    );
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(limit = 100): Promise<Notification[]> {
    const result = await this.client.query(
      `SELECT * FROM notifications
       WHERE status IN ('pending', 'retrying')
       AND (scheduled_for IS NULL OR scheduled_for <= $1)
       AND retry_count < max_retries
       ORDER BY priority DESC, created_at ASC
       LIMIT $2`,
      [new Date().toISOString(), limit]
    );

    return result.rows.map(row => this.mapNotificationRow(row));
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    const result = await this.client.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE channel = 'email') as email_count,
        COUNT(*) FILTER (WHERE channel = 'sms') as sms_count,
        COUNT(*) FILTER (WHERE channel = 'push') as push_count,
        COUNT(*) FILTER (WHERE channel = 'telegram') as telegram_count,
        COUNT(*) FILTER (WHERE channel = 'discord') as discord_count,
        COUNT(*) FILTER (WHERE channel = 'slack') as slack_count,
        COUNT(*) FILTER (WHERE channel = 'in-app') as in_app_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE priority = 'low') as low_priority_count,
        COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority_count,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count,
        COUNT(*) FILTER (WHERE priority = 'critical') as critical_priority_count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7days,
        AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) * 1000) FILTER (WHERE delivered_at IS NOT NULL) as avg_delivery_time
       FROM notifications
       WHERE user_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    const total = parseInt(row.total);
    const delivered = parseInt(row.delivered_count);

    return {
      total,
      byChannel: {
        email: parseInt(row.email_count),
        sms: parseInt(row.sms_count),
        push: parseInt(row.push_count),
        telegram: parseInt(row.telegram_count),
        discord: parseInt(row.discord_count),
        slack: parseInt(row.slack_count),
        "in-app": parseInt(row.in_app_count)
      },
      byStatus: {
        pending: parseInt(row.pending_count),
        queued: 0,
        sending: 0,
        delivered: parseInt(row.delivered_count),
        failed: parseInt(row.failed_count),
        retrying: 0
      },
      byPriority: {
        low: parseInt(row.low_priority_count),
        medium: parseInt(row.medium_priority_count),
        high: parseInt(row.high_priority_count),
        critical: parseInt(row.critical_priority_count)
      },
      last24h: parseInt(row.last_24h),
      last7days: parseInt(row.last_7days),
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      averageDeliveryTime: parseFloat(row.avg_delivery_time) || 0
    };
  }

  /**
   * Get or create notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const result = await this.client.query(
      "SELECT * FROM notification_preferences WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length > 0) {
      return this.mapPreferencesRow(result.rows[0]);
    }

    // Create default preferences
    return await this.createDefaultPreferences(userId);
  }

  /**
   * Create default notification preferences
   */
  private async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const now = new Date().toISOString();
    const defaultChannels = {
      inApp: { enabled: true }
    };

    const result = await this.client.query(
      `INSERT INTO notification_preferences (user_id, channels, updated_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, JSON.stringify(defaultChannels), now]
    );

    return this.mapPreferencesRow(result.rows[0]);
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: UpdatePreferencesRequest
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);

    const updated = {
      ...current,
      ...updates,
      channels: {
        ...current.channels,
        ...updates.channels
      },
      updatedAt: new Date().toISOString()
    };

    await this.client.query(
      `UPDATE notification_preferences
       SET channels = $2, quiet_hours = $3, alert_filters = $4,
           digest_mode = $5, grouping = $6, updated_at = $7
       WHERE user_id = $1`,
      [
        userId,
        JSON.stringify(updated.channels),
        JSON.stringify(updated.quietHours || null),
        JSON.stringify(updated.alertFilters || null),
        JSON.stringify(updated.digestMode || null),
        JSON.stringify(updated.grouping || null),
        updated.updatedAt
      ]
    );

    return updated;
  }

  /**
   * Add push subscription
   */
  async addPushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    const preferences = await this.getPreferences(userId);

    if (!preferences.channels.push) {
      preferences.channels.push = {
        enabled: true,
        subscriptions: []
      };
    }

    // Remove existing subscription with same endpoint
    preferences.channels.push.subscriptions = preferences.channels.push.subscriptions.filter(
      sub => sub.endpoint !== subscription.endpoint
    );

    // Add new subscription
    preferences.channels.push.subscriptions.push(subscription);

    await this.updatePreferences(userId, { channels: { push: preferences.channels.push } });
  }

  /**
   * Remove push subscription
   */
  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    const preferences = await this.getPreferences(userId);

    if (preferences.channels.push) {
      preferences.channels.push.subscriptions = preferences.channels.push.subscriptions.filter(
        sub => sub.endpoint !== endpoint
      );

      await this.updatePreferences(userId, { channels: { push: preferences.channels.push } });
    }
  }

  /**
   * Create notification template
   */
  async createTemplate(request: CreateTemplateRequest): Promise<NotificationTemplate> {
    const id = `template-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const result = await this.client.query(
      `INSERT INTO notification_templates (
        id, name, description, channel, subject, body, variables, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        request.name,
        request.description || null,
        request.channel,
        request.subject || null,
        request.body,
        JSON.stringify(request.variables),
        now,
        now
      ]
    );

    return this.mapTemplateRow(result.rows[0]);
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<NotificationTemplate | null> {
    const result = await this.client.query(
      "SELECT * FROM notification_templates WHERE id = $1",
      [id]
    );

    return result.rows.length > 0 ? this.mapTemplateRow(result.rows[0]) : null;
  }

  /**
   * Get all templates
   */
  async getTemplates(channel?: string): Promise<NotificationTemplate[]> {
    const query = channel
      ? "SELECT * FROM notification_templates WHERE channel = $1 ORDER BY name"
      : "SELECT * FROM notification_templates ORDER BY name";

    const params = channel ? [channel] : [];
    const result = await this.client.query(query, params);

    return result.rows.map(row => this.mapTemplateRow(row));
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, updates: UpdateTemplateRequest): Promise<NotificationTemplate> {
    const current = await this.getTemplateById(id);
    if (!current) {
      throw new Error("Template not found");
    }

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.client.query(
      `UPDATE notification_templates
       SET name = $2, description = $3, subject = $4, body = $5,
           variables = $6, updated_at = $7
       WHERE id = $1`,
      [
        id,
        updated.name,
        updated.description || null,
        updated.subject || null,
        updated.body,
        JSON.stringify(updated.variables),
        updated.updatedAt
      ]
    );

    return updated;
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    await this.client.query("DELETE FROM notification_templates WHERE id = $1", [id]);
  }

  /**
   * Map database row to Notification
   */
  private mapNotificationRow(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel,
      priority: row.priority,
      status: row.status,
      subject: row.subject,
      title: row.title,
      body: row.body,
      data: row.data,
      templateId: row.template_id,
      alertEventId: row.alert_event_id,
      groupId: row.group_id,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      failedAt: row.failed_at,
      error: row.error,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to NotificationPreferences
   */
  private mapPreferencesRow(row: any): NotificationPreferences {
    return {
      userId: row.user_id,
      channels: row.channels,
      quietHours: row.quiet_hours,
      alertFilters: row.alert_filters,
      digestMode: row.digest_mode,
      grouping: row.grouping,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to NotificationTemplate
   */
  private mapTemplateRow(row: any): NotificationTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      channel: row.channel,
      subject: row.subject,
      body: row.body,
      variables: row.variables,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
