/**
 * Notification Queue System
 * Bull-based queue for async notification delivery with retry logic
 */

import { logger } from "../logger.js";
import type {
  NotificationChannel,
  NotificationPriority,
  NotificationMessage,
  NotificationHandler
} from "./types.js";

export interface QueueConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: "exponential" | "fixed";
      delay: number;
    };
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  };
}

export interface NotificationJob {
  id: string;
  channel: NotificationChannel;
  message: NotificationMessage;
  priority: NotificationPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  scheduledFor?: string;
}

export interface JobResult {
  jobId: string;
  success: boolean;
  deliveredAt?: string;
  error?: string;
  attempts: number;
}

export class NotificationQueue {
  private handlers = new Map<NotificationChannel, NotificationHandler>();
  private jobs = new Map<string, NotificationJob>();
  private processing = false;
  private config: QueueConfig;

  constructor(config: QueueConfig = {}) {
    this.config = {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false,
        ...config.defaultJobOptions
      },
      ...config
    };

    logger.info("Notification queue initialized");
  }

  /**
   * Register notification handler
   */
  registerHandler(channel: NotificationChannel, handler: NotificationHandler): void {
    this.handlers.set(channel, handler);
    logger.info({ channel }, "Handler registered with queue");
  }

  /**
   * Add notification to queue
   */
  async add(
    channel: NotificationChannel,
    message: NotificationMessage,
    options?: {
      priority?: NotificationPriority;
      delay?: number;
      scheduledFor?: Date;
      attempts?: number;
    }
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const job: NotificationJob = {
      id: jobId,
      channel,
      message,
      priority: options?.priority ?? message.priority,
      attempts: 0,
      maxAttempts: options?.attempts ?? this.config.defaultJobOptions?.attempts ?? 3,
      createdAt: new Date().toISOString(),
      scheduledFor: options?.scheduledFor?.toISOString()
    };

    this.jobs.set(jobId, job);

    logger.debug({ jobId, channel, priority: job.priority }, "Job added to queue");

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return jobId;
  }

  /**
   * Add multiple notifications to queue
   */
  async addBulk(
    notifications: Array<{
      channel: NotificationChannel;
      message: NotificationMessage;
      options?: {
        priority?: NotificationPriority;
        delay?: number;
        scheduledFor?: Date;
      };
    }>
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const notification of notifications) {
      const jobId = await this.add(
        notification.channel,
        notification.message,
        notification.options
      );
      jobIds.push(jobId);
    }

    logger.info({ count: jobIds.length }, "Bulk jobs added to queue");
    return jobIds;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): NotificationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get queue stats
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    byChannel: Record<string, number>;
    byPriority: Record<string, number>;
  } {
    const jobs = Array.from(this.jobs.values());

    const byChannel: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    for (const job of jobs) {
      byChannel[job.channel] = (byChannel[job.channel] || 0) + 1;
      byPriority[job.priority] = (byPriority[job.priority] || 0) + 1;
    }

    return {
      total: jobs.length,
      pending: jobs.length,
      processing: this.processing ? 1 : 0,
      byChannel,
      byPriority
    };
  }

  /**
   * Start processing queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    logger.info("Queue processing started");

    while (this.jobs.size > 0) {
      const job = this.getNextJob();
      if (!job) {
        break;
      }

      await this.processJob(job);
    }

    this.processing = false;
    logger.info("Queue processing completed");
  }

  /**
   * Get next job to process (priority-based)
   */
  private getNextJob(): NotificationJob | undefined {
    const jobs = Array.from(this.jobs.values());

    // Filter out scheduled jobs not yet due
    const dueJobs = jobs.filter(job => {
      if (!job.scheduledFor) {
        return true;
      }
      return new Date(job.scheduledFor) <= new Date();
    });

    if (dueJobs.length === 0) {
      return undefined;
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    dueJobs.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      // If same priority, sort by creation time
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return dueJobs[0];
  }

  /**
   * Process a single job
   */
  private async processJob(job: NotificationJob): Promise<JobResult> {
    const handler = this.handlers.get(job.channel);

    if (!handler) {
      logger.error({ jobId: job.id, channel: job.channel }, "No handler found for channel");
      this.jobs.delete(job.id);
      return {
        jobId: job.id,
        success: false,
        error: `No handler registered for channel: ${job.channel}`,
        attempts: job.attempts
      };
    }

    job.attempts++;

    try {
      await handler.send(job.message);

      logger.info(
        { jobId: job.id, channel: job.channel, attempts: job.attempts },
        "Job processed successfully"
      );

      this.jobs.delete(job.id);

      return {
        jobId: job.id,
        success: true,
        deliveredAt: new Date().toISOString(),
        attempts: job.attempts
      };
    } catch (error) {
      logger.error(
        {
          jobId: job.id,
          channel: job.channel,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          error: error instanceof Error ? error.message : String(error)
        },
        "Job processing failed"
      );

      // Retry logic
      if (job.attempts < job.maxAttempts) {
        const backoffDelay = this.calculateBackoff(job.attempts);
        logger.info(
          { jobId: job.id, attempts: job.attempts, backoffDelay },
          "Job will be retried"
        );

        // Schedule retry
        setTimeout(() => {
          if (this.jobs.has(job.id)) {
            this.processJob(job);
          }
        }, backoffDelay);

        return {
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          attempts: job.attempts
        };
      } else {
        // Max attempts reached, remove from queue
        this.jobs.delete(job.id);
        logger.error({ jobId: job.id }, "Job failed after max attempts");

        return {
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          attempts: job.attempts
        };
      }
    }
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = this.config.defaultJobOptions?.backoff?.delay ?? 1000;
    const type = this.config.defaultJobOptions?.backoff?.type ?? "exponential";

    if (type === "exponential") {
      return baseDelay * Math.pow(2, attempt - 1);
    }

    return baseDelay;
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.jobs.clear();
    logger.info("Queue cleared");
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.processing = false;
    logger.info("Queue paused");
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (!this.processing && this.jobs.size > 0) {
      this.startProcessing();
    }
  }
}

// Singleton instance
export const notificationQueue = new NotificationQueue();
