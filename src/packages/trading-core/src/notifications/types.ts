/**
 * Notification System Types
 */

export type NotificationChannel =
  | "email"
  | "sms"
  | "push"
  | "telegram"
  | "discord"
  | "slack"
  | "in-app";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export type NotificationStatus =
  | "pending"
  | "queued"
  | "sending"
  | "delivered"
  | "failed"
  | "retrying";

export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  channel: NotificationChannel;
  subject?: string; // For email
  body: string;
  variables: string[]; // Template variables like {{symbol}}, {{price}}
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    email?: {
      enabled: boolean;
      address: string;
      verified: boolean;
    };
    sms?: {
      enabled: boolean;
      phoneNumber: string;
      verified: boolean;
    };
    push?: {
      enabled: boolean;
      subscriptions: PushSubscription[];
    };
    telegram?: {
      enabled: boolean;
      chatId: string;
      username?: string;
    };
    discord?: {
      enabled: boolean;
      webhookUrl: string;
      username?: string;
    };
    slack?: {
      enabled: boolean;
      webhookUrl: string;
      channel?: string;
    };
    inApp?: {
      enabled: boolean;
    };
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
    timezone: string;
  };
  alertFilters?: {
    minPriority?: NotificationPriority;
    alertTypes?: string[];
    symbols?: string[];
  };
  digestMode?: {
    enabled: boolean;
    frequency: "daily" | "weekly";
    time: string; // HH:mm format
  };
  grouping?: {
    enabled: boolean;
    windowMinutes: number; // Group notifications within this window
  };
  updatedAt: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  subject?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  templateId?: string;
  alertEventId?: string;
  groupId?: string; // For grouped notifications
  scheduledFor?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDeliveryResult {
  notificationId: string;
  channel: NotificationChannel;
  success: boolean;
  deliveredAt?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface NotificationHistory {
  notifications: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NotificationStats {
  total: number;
  byChannel: Record<NotificationChannel, number>;
  byStatus: Record<NotificationStatus, number>;
  byPriority: Record<NotificationPriority, number>;
  last24h: number;
  last7days: number;
  deliveryRate: number; // Percentage of successful deliveries
  averageDeliveryTime: number; // In milliseconds
}

export interface SendNotificationRequest {
  userId: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  subject?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  templateId?: string;
  alertEventId?: string;
  scheduledFor?: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables: string[];
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  subject?: string;
  body?: string;
  variables?: string[];
}

export interface UpdatePreferencesRequest {
  channels?: Partial<NotificationPreferences["channels"]>;
  quietHours?: NotificationPreferences["quietHours"];
  alertFilters?: NotificationPreferences["alertFilters"];
  digestMode?: NotificationPreferences["digestMode"];
  grouping?: NotificationPreferences["grouping"];
}
