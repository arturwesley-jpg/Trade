export type NotificationChannel = "email" | "sms" | "push" | "telegram" | "webhook" | "slack";
export type NotificationPriority = "low" | "normal" | "high" | "critical";
export type NotificationStatus = "pending" | "sent" | "failed" | "queued";

export interface NotificationMessage {
  recipient: string;
  subject?: string;
  message: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface NotificationRequest {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface MultiChannelNotificationRequest {
  channels: NotificationChannel[];
  recipient: string;
  subject?: string;
  message: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface TemplateNotificationRequest {
  channel: NotificationChannel;
  recipient: string;
  template: string;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface NotificationTemplate {
  subject?: string;
  body: string;
}

export interface NotificationHandler {
  send(message: NotificationMessage): Promise<void>;
}

export interface NotificationRecord {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface NotificationHistoryQuery {
  channel?: NotificationChannel;
  recipient?: string;
  status?: NotificationStatus;
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface BatchConfig {
  interval: number; // milliseconds
  maxSize: number;
}

export interface RateLimitConfig {
  maxPerMinute: number;
  maxPerHour?: number;
  maxPerDay?: number;
}
