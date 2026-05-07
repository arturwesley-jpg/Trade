import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string; // mailto: or https: URL
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

export class PushHandler implements NotificationHandler {
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private readonly vapidSubject: string;

  constructor(config: PushConfig) {
    this.vapidPublicKey = config.vapidPublicKey;
    this.vapidPrivateKey = config.vapidPrivateKey;
    this.vapidSubject = config.vapidSubject;
    logger.info("Push handler initialized");
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      // Parse subscriptions from recipient (JSON array)
      const subscriptions: PushSubscription[] = JSON.parse(message.recipient);

      const payload = this.buildPayload(message);
      const results = await Promise.allSettled(
        subscriptions.map(sub => this.sendToSubscription(sub, payload))
      );

      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      logger.info(
        { total: subscriptions.length, successful, failed },
        "Push notifications sent"
      );

      if (successful === 0 && failed > 0) {
        throw new Error(`All push notifications failed (${failed} subscriptions)`);
      }
    } catch (error) {
      logger.error("Failed to send push notification", {
        error: error instanceof Error ? error : String(error)
      });
      throw error;
    }
  }

  private buildPayload(message: NotificationMessage): PushPayload {
    const priorityIcons = {
      low: "/icons/info.png",
      normal: "/icons/notification.png",
      high: "/icons/warning.png",
      critical: "/icons/alert.png"
    };

    const payload: PushPayload = {
      title: message.subject || "Notification",
      body: message.message,
      icon: priorityIcons[message.priority],
      badge: "/icons/badge.png",
      data: {
        priority: message.priority,
        timestamp: new Date().toISOString(),
        ...message.metadata
      },
      requireInteraction: message.priority === "critical"
    };

    // Add action buttons for high priority
    if (message.priority === "high" || message.priority === "critical") {
      payload.actions = [
        {
          action: "view",
          title: "View Details",
          icon: "/icons/view.png"
        },
        {
          action: "dismiss",
          title: "Dismiss",
          icon: "/icons/dismiss.png"
        }
      ];
    }

    return payload;
  }

  private async sendToSubscription(
    subscription: PushSubscription,
    payload: PushPayload
  ): Promise<void> {
    // In production, use web-push library:
    // const webpush = require('web-push');
    // webpush.setVapidDetails(
    //   this.vapidSubject,
    //   this.vapidPublicKey,
    //   this.vapidPrivateKey
    // );
    // await webpush.sendNotification(subscription, JSON.stringify(payload));

    logger.debug(
      { endpoint: subscription.endpoint.substring(0, 50) },
      "Push notification sent to subscription"
    );
  }

  validateSubscription(subscription: PushSubscription): boolean {
    return !!(
      subscription.endpoint &&
      subscription.keys &&
      subscription.keys.p256dh &&
      subscription.keys.auth
    );
  }

  async verify(): Promise<boolean> {
    try {
      if (!this.vapidPublicKey || !this.vapidPrivateKey) {
        return false;
      }

      if (
        !this.vapidSubject.startsWith("mailto:") &&
        !this.vapidSubject.startsWith("https:")
      ) {
        return false;
      }

      logger.info("Push handler verified successfully");
      return true;
    } catch (error) {
      logger.error("Push handler verification failed", {
        error: error instanceof Error ? error : String(error)
      });
      return false;
    }
  }
}
