/**
 * Notification Worker
 * Background worker for processing pending notifications
 */

import { Client } from "pg";
import { NotificationManager } from "./notification-manager.js";
import type { NotificationManagerConfig } from "./notification-manager.js";

export interface NotificationWorkerConfig {
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  notifications: NotificationManagerConfig;
  pollIntervalMs?: number;
  batchSize?: number;
  maxRetries?: number;
}

export class NotificationWorker {
  private client: Client;
  private manager: NotificationManager;
  private pollIntervalMs: number;
  private batchSize: number;
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;

  constructor(private config: NotificationWorkerConfig) {
    this.client = new Client(config.database);
    this.manager = new NotificationManager(this.client, config.notifications);
    this.pollIntervalMs = config.pollIntervalMs || 5000; // 5 seconds
    this.batchSize = config.batchSize || 100;
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[NotificationWorker] Already running");
      return;
    }

    console.log("[NotificationWorker] Starting...");

    try {
      await this.client.connect();
      console.log("[NotificationWorker] Database connected");

      this.isRunning = true;
      this.scheduleNextPoll();

      console.log("[NotificationWorker] Started successfully");
    } catch (error) {
      console.error("[NotificationWorker] Failed to start:", error);
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("[NotificationWorker] Not running");
      return;
    }

    console.log("[NotificationWorker] Stopping...");

    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    try {
      await this.client.end();
      console.log("[NotificationWorker] Stopped successfully");
    } catch (error) {
      console.error("[NotificationWorker] Error during shutdown:", error);
    }
  }

  /**
   * Schedule next poll
   */
  private scheduleNextPoll(): void {
    if (!this.isRunning) {
      return;
    }

    this.pollTimer = setTimeout(async () => {
      try {
        await this.processPendingNotifications();
      } catch (error) {
        console.error("[NotificationWorker] Error processing notifications:", error);
      } finally {
        this.scheduleNextPoll();
      }
    }, this.pollIntervalMs);
  }

  /**
   * Process pending notifications
   */
  private async processPendingNotifications(): Promise<void> {
    try {
      await this.manager.processPendingNotifications();
    } catch (error) {
      console.error("[NotificationWorker] Error in processPendingNotifications:", error);
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    pollIntervalMs: number;
    batchSize: number;
  } {
    return {
      isRunning: this.isRunning,
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize
    };
  }
}

/**
 * Create and start notification worker
 */
export async function startNotificationWorker(
  config: NotificationWorkerConfig
): Promise<NotificationWorker> {
  const worker = new NotificationWorker(config);
  await worker.start();

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("[NotificationWorker] SIGTERM received, shutting down...");
    await worker.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[NotificationWorker] SIGINT received, shutting down...");
    await worker.stop();
    process.exit(0);
  });

  return worker;
}
