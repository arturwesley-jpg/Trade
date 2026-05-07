/**
 * Push Notification Service
 * Uses Web Push API for browser push notifications
 */

import type { Notification, NotificationDeliveryResult, PushSubscription } from "./types.js";

export interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string; // mailto: or https: URL
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

export class PushService {
  constructor(private config: PushConfig) {}

  /**
   * Send push notification to all user subscriptions
   */
  async send(
    notification: Notification,
    subscriptions: PushSubscription[]
  ): Promise<NotificationDeliveryResult> {
    try {
      const payload = this.buildPushPayload(notification);
      const results = await Promise.allSettled(
        subscriptions.map(sub => this.sendToSubscription(sub, payload))
      );

      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      return {
        notificationId: notification.id,
        channel: "push",
        success: successful > 0,
        deliveredAt: new Date().toISOString(),
        metadata: {
          totalSubscriptions: subscriptions.length,
          successful,
          failed
        }
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: "push",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build push notification payload
   */
  private buildPushPayload(notification: Notification): PushPayload {
    const priorityIcons = {
      low: "/icons/info.png",
      medium: "/icons/warning.png",
      high: "/icons/alert.png",
      critical: "/icons/critical.png"
    };

    const payload: PushPayload = {
      title: notification.title,
      body: notification.body,
      icon: priorityIcons[notification.priority],
      badge: "/icons/badge.png",
      data: {
        notificationId: notification.id,
        priority: notification.priority,
        timestamp: notification.createdAt,
        ...notification.data
      },
      tag: notification.groupId || notification.id,
      requireInteraction: notification.priority === "critical"
    };

    // Add action buttons for high priority notifications
    if (notification.priority === "high" || notification.priority === "critical") {
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

  /**
   * Send push notification to a single subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: PushPayload
  ): Promise<void> {
    // In production, use web-push library:
    // const webpush = require('web-push');
    // webpush.setVapidDetails(
    //   this.config.vapidSubject,
    //   this.config.vapidPublicKey,
    //   this.config.vapidPrivateKey
    // );
    // await webpush.sendNotification(
    //   {
    //     endpoint: subscription.endpoint,
    //     keys: subscription.keys
    //   },
    //   JSON.stringify(payload)
    // );

    console.log(`[Push] Sending to ${subscription.endpoint.substring(0, 50)}...`);
    console.log(`[Push] Payload:`, payload.title);
  }

  /**
   * Validate push subscription
   */
  validateSubscription(subscription: PushSubscription): boolean {
    return !!(
      subscription.endpoint &&
      subscription.keys &&
      subscription.keys.p256dh &&
      subscription.keys.auth
    );
  }

  /**
   * Generate VAPID keys (for initial setup)
   */
  static generateVAPIDKeys(): { publicKey: string; privateKey: string } {
    // In production, use web-push library:
    // const webpush = require('web-push');
    // return webpush.generateVAPIDKeys();

    return {
      publicKey: "BExample_Public_Key_" + Math.random().toString(36),
      privateKey: "Example_Private_Key_" + Math.random().toString(36)
    };
  }

  /**
   * Verify push configuration
   */
  async verify(): Promise<boolean> {
    try {
      // Verify VAPID keys are valid
      if (!this.config.vapidPublicKey || !this.config.vapidPrivateKey) {
        return false;
      }

      // Verify subject is valid mailto: or https: URL
      if (
        !this.config.vapidSubject.startsWith("mailto:") &&
        !this.config.vapidSubject.startsWith("https:")
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Push configuration verification failed:", error);
      return false;
    }
  }
}
