import { randomUUID } from "crypto";
import { logger } from "../logger.js";
import type {
  NotificationChannel,
  NotificationHandler,
  NotificationMessage,
  NotificationRecord,
  NotificationRequest,
  MultiChannelNotificationRequest,
  TemplateNotificationRequest,
  NotificationTemplate,
  NotificationHistoryQuery,
  BatchConfig,
  RateLimitConfig
} from "./types.js";

export class NotificationService {
  private handlers = new Map<NotificationChannel, NotificationHandler>();
  private templates = new Map<string, NotificationTemplate>();
  private history: NotificationRecord[] = [];
  private batches = new Map<NotificationChannel, NotificationRecord[]>();
  private batchConfigs = new Map<NotificationChannel, BatchConfig>();
  private batchTimers = new Map<NotificationChannel, NodeJS.Timeout>();
  private rateLimits = new Map<NotificationChannel, RateLimitConfig>();
  private rateLimitCounters = new Map<NotificationChannel, { minute: number; hour: number; day: number; lastReset: Date }>();

  registerHandler(channel: NotificationChannel, handler: NotificationHandler): void {
    this.handlers.set(channel, handler);
    logger.info({ channel }, "Notification handler registered");
  }

  unregisterHandler(channel: NotificationChannel): void {
    this.handlers.delete(channel);
    logger.info({ channel }, "Notification handler unregistered");
  }

  hasHandler(channel: NotificationChannel): boolean {
    return this.handlers.has(channel);
  }

  registerTemplate(name: string, template: NotificationTemplate): void {
    this.templates.set(name, template);
    logger.debug({ name }, "Notification template registered");
  }

  enableBatching(channel: NotificationChannel, config: BatchConfig): void {
    this.batchConfigs.set(channel, config);
    this.batches.set(channel, []);
    logger.info({ channel, config }, "Notification batching enabled");
  }

  disableBatching(channel: NotificationChannel): void {
    const timer = this.batchTimers.get(channel);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(channel);
    }
    this.batchConfigs.delete(channel);
    this.batches.delete(channel);
    logger.info({ channel }, "Notification batching disabled");
  }

  setRateLimit(channel: NotificationChannel, config: RateLimitConfig): void {
    this.rateLimits.set(channel, config);
    this.rateLimitCounters.set(channel, {
      minute: 0,
      hour: 0,
      day: 0,
      lastReset: new Date()
    });
    logger.info({ channel, config }, "Rate limit configured");
  }

  async send(request: NotificationRequest): Promise<void> {
    const record = this.createRecord(request);

    // Check rate limits
    if (!this.checkRateLimit(request.channel)) {
      record.status = "queued";
      this.history.push(record);
      logger.warn({ channel: request.channel }, "Rate limit exceeded, notification queued");
      return;
    }

    // Check if batching is enabled
    const batchConfig = this.batchConfigs.get(request.channel);
    if (batchConfig && request.priority !== "critical" && request.priority !== "high") {
      this.addToBatch(request.channel, record);
      return;
    }

    // Send immediately
    await this.sendImmediate(request.channel, record);
  }

  async sendMulti(request: MultiChannelNotificationRequest): Promise<void> {
    await Promise.all(
      request.channels.map((channel) =>
        this.send({
          channel,
          recipient: request.recipient,
          subject: request.subject,
          message: request.message,
          priority: request.priority,
          metadata: request.metadata
        })
      )
    );
  }

  async sendFromTemplate(request: TemplateNotificationRequest): Promise<void> {
    const template = this.templates.get(request.template);
    if (!template) {
      logger.error({ template: request.template }, "Template not found");
      return;
    }

    const subject = template.subject ? this.renderTemplate(template.subject, request.data) : undefined;
    const message = this.renderTemplate(template.body, request.data);

    await this.send({
      channel: request.channel,
      recipient: request.recipient,
      subject,
      message,
      priority: request.priority,
      metadata: request.metadata
    });
  }

  getHistory(query: NotificationHistoryQuery = {}): NotificationRecord[] {
    let results = [...this.history];

    if (query.channel) {
      results = results.filter((r) => r.channel === query.channel);
    }

    if (query.recipient) {
      results = results.filter((r) => r.recipient === query.recipient);
    }

    if (query.status) {
      results = results.filter((r) => r.status === query.status);
    }

    if (query.priority) {
      results = results.filter((r) => r.priority === query.priority);
    }

    if (query.startDate) {
      results = results.filter((r) => r.createdAt >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((r) => r.createdAt <= query.endDate!);
    }

    // Sort by creation date descending
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;

    return results.slice(offset, offset + limit);
  }

  private createRecord(request: NotificationRequest): NotificationRecord {
    return {
      id: randomUUID(),
      channel: request.channel,
      recipient: request.recipient,
      subject: request.subject,
      message: request.message,
      priority: request.priority,
      status: "pending",
      createdAt: new Date(),
      metadata: request.metadata
    };
  }

  private async sendImmediate(channel: NotificationChannel, record: NotificationRecord): Promise<void> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      logger.warn({ channel }, "No handler registered for channel");
      record.status = "failed";
      record.error = "No handler registered";
      this.history.push(record);
      return;
    }

    try {
      await handler.send({
        recipient: record.recipient,
        subject: record.subject,
        message: record.message,
        priority: record.priority,
        metadata: record.metadata
      });

      record.status = "sent";
      record.sentAt = new Date();
      this.incrementRateLimit(channel);
      logger.info({ channel, recipient: record.recipient }, "Notification sent");
    } catch (error) {
      record.status = "failed";
      record.error = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to send notification", { error: error instanceof Error ? error : String(error), channel, recipient: record.recipient });
    }

    this.history.push(record);
  }

  private addToBatch(channel: NotificationChannel, record: NotificationRecord): void {
    const batch = this.batches.get(channel);
    if (!batch) return;

    batch.push(record);
    logger.debug({ channel, batchSize: batch.length }, "Notification added to batch");

    const config = this.batchConfigs.get(channel)!;

    // Check if batch is full
    if (batch.length >= config.maxSize) {
      this.flushBatch(channel);
      return;
    }

    // Set timer if not already set
    if (!this.batchTimers.has(channel)) {
      const timer = setTimeout(() => {
        this.flushBatch(channel);
      }, config.interval);
      this.batchTimers.set(channel, timer);
    }
  }

  private async flushBatch(channel: NotificationChannel): Promise<void> {
    const batch = this.batches.get(channel);
    if (!batch || batch.length === 0) return;

    logger.info({ channel, count: batch.length }, "Flushing notification batch");

    // Clear timer
    const timer = this.batchTimers.get(channel);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(channel);
    }

    // Send all notifications in batch
    await Promise.all(batch.map((record) => this.sendImmediate(channel, record)));

    // Clear batch
    this.batches.set(channel, []);
  }

  private checkRateLimit(channel: NotificationChannel): boolean {
    const config = this.rateLimits.get(channel);
    if (!config) return true;

    const counter = this.rateLimitCounters.get(channel);
    if (!counter) return true;

    // Reset counters if needed
    const now = new Date();
    const elapsed = now.getTime() - counter.lastReset.getTime();

    if (elapsed >= 86400000) {
      // 24 hours
      counter.minute = 0;
      counter.hour = 0;
      counter.day = 0;
      counter.lastReset = now;
    } else if (elapsed >= 3600000) {
      // 1 hour
      counter.minute = 0;
      counter.hour = 0;
    } else if (elapsed >= 60000) {
      // 1 minute
      counter.minute = 0;
    }

    // Check limits
    if (counter.minute >= config.maxPerMinute) return false;
    if (config.maxPerHour && counter.hour >= config.maxPerHour) return false;
    if (config.maxPerDay && counter.day >= config.maxPerDay) return false;

    return true;
  }

  private incrementRateLimit(channel: NotificationChannel): void {
    const counter = this.rateLimitCounters.get(channel);
    if (!counter) return;

    counter.minute++;
    counter.hour++;
    counter.day++;
  }

  private renderTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(data[key] ?? "");
    });
  }
}

export const notificationService = new NotificationService();
