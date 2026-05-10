import { randomUUID } from "node:crypto";
import { logger } from "../../logger.js";
import type { NotificationHandler, NotificationMessage } from "../types.js";

export type NotificationType = "TRADE_ALERT" | "PRICE_ALERT" | "POSITION_ALERT" | "SYSTEM_ALERT";

export interface WebSocketNotificationConfig {
  broadcastFn: (userId: string, channel: string, data: unknown) => void;
  checkClientOnline?: (userId: string) => boolean;
  fallbackHandlers?: NotificationHandler[];
  maxRetries?: number;
  retryDelay?: number;
}

export interface NotificationDeliveryStatus {
  id: string;
  userId: string;
  status: "sent" | "delivered" | "failed" | "fallback";
  attempts: number;
  sentAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  error?: string;
  fallbackChannel?: string;
}

export class WebSocketHandler implements NotificationHandler {
  private broadcastFn: (userId: string, channel: string, data: unknown) => void;
  private checkClientOnline?: (userId: string) => boolean;
  private fallbackHandlers: NotificationHandler[];
  private maxRetries: number;
  private retryDelay: number;
  private deliveryTracking = new Map<string, NotificationDeliveryStatus>();
  private pendingRetries = new Map<string, NodeJS.Timeout>();

  constructor(config: WebSocketNotificationConfig) {
    this.broadcastFn = config.broadcastFn;
    this.checkClientOnline = config.checkClientOnline;
    this.fallbackHandlers = config.fallbackHandlers ?? [];
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 5000;
    logger.info("WebSocket notification handler initialized");
  }

  async send(message: NotificationMessage): Promise<void> {
    const notificationId = randomUUID();
    const userId = this.extractUserId(message.recipient);
    const notificationType = this.determineNotificationType(message);

    const deliveryStatus: NotificationDeliveryStatus = {
      id: notificationId,
      userId,
      status: "sent",
      attempts: 0,
      sentAt: new Date()
    };

    this.deliveryTracking.set(notificationId, deliveryStatus);

    try {
      await this.sendWithRetry(notificationId, userId, notificationType, message);
    } catch (error) {
      await this.finalizeFailure(notificationId, message, deliveryStatus, error);
    }
  }

  private async sendWithRetry(
    notificationId: string,
    userId: string,
    notificationType: NotificationType,
    message: NotificationMessage
  ): Promise<void> {
    const deliveryStatus = this.deliveryTracking.get(notificationId);
    if (!deliveryStatus) return;

    deliveryStatus.attempts++;

    // Check if client is online
    const isOnline = this.checkClientOnline ? this.checkClientOnline(userId) : true;

    if (!isOnline) {
      logger.warn({ userId, notificationId }, "Client is offline, will retry or fallback");

      if (deliveryStatus.attempts < this.maxRetries) {
        // Schedule retry
        await this.scheduleRetry(notificationId, userId, notificationType, message);
        return;
      } else {
        throw new Error("Client offline after max retries");
      }
    }

    try {
      // Send notification via WebSocket
      this.broadcastFn(userId, "notifications", {
        type: "notification",
        notificationType,
        notificationId,
        notification: {
          id: notificationId,
          subject: message.subject,
          message: message.message,
          priority: message.priority,
          metadata: message.metadata,
          timestamp: new Date().toISOString()
        }
      });

      deliveryStatus.status = "delivered";
      deliveryStatus.deliveredAt = new Date();

      logger.info(
        { userId, notificationId, notificationType, priority: message.priority, attempts: deliveryStatus.attempts },
        "WebSocket notification delivered"
      );
    } catch (error) {
      logger.error("Failed to send WebSocket notification", { error: error instanceof Error ? error : String(error), userId, notificationId, attempts: deliveryStatus.attempts });

      if (deliveryStatus.attempts < this.maxRetries) {
        await this.scheduleRetry(notificationId, userId, notificationType, message);
      } else {
        throw error;
      }
    }
  }

  private async scheduleRetry(
    notificationId: string,
    userId: string,
    notificationType: NotificationType,
    message: NotificationMessage
  ): Promise<void> {
    const deliveryStatus = this.deliveryTracking.get(notificationId);
    if (!deliveryStatus) return;

    const delay = this.retryDelay * deliveryStatus.attempts;

    logger.info(
      { notificationId, userId, attempt: deliveryStatus.attempts, delayMs: delay },
      "Scheduling notification retry"
    );

    const timeout = setTimeout(async () => {
      this.pendingRetries.delete(notificationId);
      try {
        await this.sendWithRetry(notificationId, userId, notificationType, message);
      } catch (error) {
        logger.error("Retry failed", { error: error instanceof Error ? error : String(error), notificationId });
        const deliveryStatus = this.deliveryTracking.get(notificationId);
        if (deliveryStatus) {
          await this.finalizeFailure(notificationId, message, deliveryStatus, error);
        }
      }
    }, delay);

    this.pendingRetries.set(notificationId, timeout);
  }

  private async tryFallback(
    notificationId: string,
    message: NotificationMessage,
    deliveryStatus: NotificationDeliveryStatus
  ): Promise<void> {
    if (this.fallbackHandlers.length === 0) {
      logger.warn({ notificationId }, "No fallback handlers configured");
      return;
    }

    logger.info(
      { notificationId, fallbackCount: this.fallbackHandlers.length },
      "Attempting fallback notification delivery"
    );

    for (const handler of this.fallbackHandlers) {
      try {
        await handler.send(message);
        deliveryStatus.fallbackChannel = handler.constructor.name;
        logger.info(
          { notificationId, fallbackChannel: deliveryStatus.fallbackChannel },
          "Notification delivered via fallback"
        );
        return;
      } catch (error) {
        logger.error(
          "Fallback handler failed",
          { error: error instanceof Error ? error : String(error), notificationId, handler: handler.constructor.name }
        );
      }
    }

    logger.error({ notificationId }, "All fallback handlers failed");
  }

  private async finalizeFailure(
    notificationId: string,
    message: NotificationMessage,
    deliveryStatus: NotificationDeliveryStatus,
    error: unknown
  ): Promise<void> {
    logger.error("Failed to send WebSocket notification after retries", { error: error instanceof Error ? error : String(error), recipient: message.recipient, notificationId });
    deliveryStatus.status = "failed";
    deliveryStatus.failedAt = new Date();
    deliveryStatus.error = error instanceof Error ? error.message : "Unknown error";
    await this.tryFallback(notificationId, message, deliveryStatus);
  }

  private extractUserId(recipient: string): string {
    return recipient.replace(/^user-/, "");
  }

  private determineNotificationType(message: NotificationMessage): NotificationType {
    const metadata = message.metadata;

    if (metadata?.type) {
      return metadata.type as NotificationType;
    }

    // Infer from message content or subject
    const content = `${message.subject ?? ""} ${message.message}`.toLowerCase();

    if (content.includes("trade") || content.includes("order") || content.includes("fill")) {
      return "TRADE_ALERT";
    }
    if (content.includes("price") || content.includes("market")) {
      return "PRICE_ALERT";
    }
    if (content.includes("position") || content.includes("pnl")) {
      return "POSITION_ALERT";
    }

    return "SYSTEM_ALERT";
  }

  getDeliveryStatus(notificationId: string): NotificationDeliveryStatus | undefined {
    return this.deliveryTracking.get(notificationId);
  }

  getDeliveryHistory(userId: string, limit = 100): NotificationDeliveryStatus[] {
    return Array.from(this.deliveryTracking.values())
      .filter((status) => status.userId === userId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit);
  }

  getStats() {
    const statuses = Array.from(this.deliveryTracking.values());
    return {
      total: statuses.length,
      sent: statuses.filter((s) => s.status === "sent").length,
      delivered: statuses.filter((s) => s.status === "delivered").length,
      failed: statuses.filter((s) => s.status === "failed").length,
      fallback: statuses.filter((s) => Boolean(s.fallbackChannel)).length,
      pendingRetries: this.pendingRetries.size
    };
  }

  clearHistory(olderThanMs = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleared = 0;

    for (const [id, status] of this.deliveryTracking.entries()) {
      if (now - status.sentAt.getTime() >= olderThanMs) {
        this.deliveryTracking.delete(id);
        cleared++;
      }
    }

    logger.info({ cleared, olderThanMs }, "Cleared old delivery history");
    return cleared;
  }

  cleanup(): void {
    // Clear all pending retries
    for (const timeout of this.pendingRetries.values()) {
      clearTimeout(timeout);
    }
    this.pendingRetries.clear();
    this.deliveryTracking.clear();
    logger.info("WebSocket notification handler cleaned up");
  }
}
