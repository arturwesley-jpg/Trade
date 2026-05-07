/**
 * Alert-Notification Integration
 * Connects alert system with notification system
 */

import type { NotificationManager } from "./notification-manager.js";
import type { AlertEvent } from "../alerts/types.js";
import type { NotificationChannel, NotificationPriority } from "./types.js";

export interface AlertNotificationConfig {
  defaultChannels: NotificationChannel[];
  priorityMapping: Record<string, NotificationPriority>;
  enableAutoNotifications: boolean;
}

export class AlertNotificationIntegration {
  constructor(
    private notificationManager: NotificationManager,
    private config: AlertNotificationConfig
  ) {}

  /**
   * Handle alert triggered event
   */
  async onAlertTriggered(event: AlertEvent): Promise<void> {
    if (!this.config.enableAutoNotifications) {
      return;
    }

    try {
      const channels = this.getNotificationChannels(event);
      const priority = this.getNotificationPriority(event);

      await this.notificationManager.send({
        userId: event.userId,
        channels,
        priority,
        title: this.buildTitle(event),
        body: this.buildBody(event),
        data: this.buildData(event),
        alertEventId: event.id
      });

      console.log(`[AlertNotification] Sent notification for alert rule ${event.ruleId}`);
    } catch (error) {
      console.error(`[AlertNotification] Failed to send notification:`, error);
    }
  }

  /**
   * Get notification channels for alert
   */
  private getNotificationChannels(event: AlertEvent): NotificationChannel[] {
    if (event.deliveryChannels && event.deliveryChannels.length > 0) {
      return event.deliveryChannels as NotificationChannel[];
    }

    // Fall back to default channels
    return this.config.defaultChannels;
  }

  /**
   * Get notification priority based on alert type and data
   */
  private getNotificationPriority(event: AlertEvent): NotificationPriority {
    if (event.severity) {
      return event.severity as NotificationPriority;
    }

    const mapped = this.config.priorityMapping[event.type];
    if (mapped) {
      return mapped;
    }

    return "medium";
  }

  /**
   * Build notification title
   */
  private buildTitle(event: AlertEvent): string {
    const typeLabels: Record<string, string> = {
      price: "Price Alert",
      indicator: "Indicator Alert",
      whale: "Whale Alert",
      news: "News Alert",
      sentiment: "Sentiment Alert",
      risk: "Risk Alert"
    };

    const label = typeLabels[event.type] || "Alert";

    const symbol = typeof event.context?.symbol === "string" ? event.context.symbol : undefined;
    if (symbol) {
      return `${label}: ${symbol}`;
    }

    return label;
  }

  /**
   * Build notification body
   */
  private buildBody(event: AlertEvent): string {
    const parts: string[] = [];

    parts.push(event.title);
    parts.push(event.message);

    const timestamp = new Date(event.createdAt).toLocaleString();
    parts.push(`Triggered at ${timestamp}`);

    return parts.join("\n");
  }

  /**
   * Build notification data
   */
  private buildData(event: AlertEvent): Record<string, any> {
    return {
      alertRuleId: event.ruleId,
      alertEventId: event.id,
      alertType: event.type,
      severity: event.severity,
      status: event.status,
      createdAt: event.createdAt,
      ...event.context
    };
  }

  /**
   * Send custom alert notification
   */
  async sendCustomNotification(
    userId: string,
    alertId: string,
    options: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
      title: string;
      body: string;
      data?: Record<string, any>;
    }
  ): Promise<void> {
    await this.notificationManager.send({
      userId,
      channels: options.channels || this.config.defaultChannels,
      priority: options.priority || "medium",
      title: options.title,
      body: options.body,
      data: {
        alertId,
        ...options.data
      }
    });
  }

  /**
   * Send batch alert notifications
   */
  async sendBatchNotifications(events: AlertEvent[]): Promise<void> {
    const promises = events.map(event => this.onAlertTriggered(event));
    await Promise.allSettled(promises);
  }
}

/**
 * Create default alert notification integration
 */
export function createAlertNotificationIntegration(
  notificationManager: NotificationManager,
  config?: Partial<AlertNotificationConfig>
): AlertNotificationIntegration {
  const defaultConfig: AlertNotificationConfig = {
    defaultChannels: ["in-app"],
    priorityMapping: {
      price: "medium",
      indicator: "medium",
      whale: "high",
      news: "low",
      risk: "high",
      sentiment: "medium"
    },
    enableAutoNotifications: true,
    ...config
  };

  return new AlertNotificationIntegration(notificationManager, defaultConfig);
}
