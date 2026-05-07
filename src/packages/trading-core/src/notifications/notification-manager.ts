/**
 * Notification Manager
 * Orchestrates notification delivery across all channels
 */

import type { Client } from "pg";
import type {
  Notification,
  NotificationChannel,
  NotificationPreferences,
  SendNotificationRequest,
  NotificationDeliveryResult
} from "./types.js";
import { NotificationRepository } from "./notification-repository.js";
import { EmailService, type EmailConfig } from "./email-service.js";
import { SMSService, type SMSConfig } from "./sms-service.js";
import { PushService, type PushConfig } from "./push-service.js";
import { TelegramService, type TelegramConfig } from "./telegram-service.js";
import { DiscordService, type DiscordConfig } from "./discord-service.js";
import { SlackService, type SlackConfig } from "./slack-service.js";

export interface NotificationManagerConfig {
  email?: EmailConfig;
  sms?: SMSConfig;
  push?: PushConfig;
  telegram?: TelegramConfig;
  discord?: DiscordConfig;
  slack?: SlackConfig;
}

export class NotificationManager {
  private repository: NotificationRepository;
  private emailService?: EmailService;
  private smsService?: SMSService;
  private pushService?: PushService;
  private telegramService?: TelegramService;
  private discordService?: DiscordService;
  private slackService?: SlackService;

  constructor(
    private client: Client,
    private config: NotificationManagerConfig
  ) {
    this.repository = new NotificationRepository(client);

    // Initialize services based on config
    if (config.email) {
      this.emailService = new EmailService(config.email);
    }
    if (config.sms) {
      this.smsService = new SMSService(config.sms);
    }
    if (config.push) {
      this.pushService = new PushService(config.push);
    }
    if (config.telegram) {
      this.telegramService = new TelegramService(config.telegram);
    }
    if (config.discord) {
      this.discordService = new DiscordService(config.discord);
    }
    if (config.slack) {
      this.slackService = new SlackService(config.slack);
    }
  }

  /**
   * Send notification to user
   */
  async send(request: SendNotificationRequest): Promise<string[]> {
    const preferences = await this.repository.getPreferences(request.userId);

    // Filter channels based on preferences and quiet hours
    const enabledChannels = this.filterChannels(
      request.channels,
      preferences,
      request.priority
    );

    if (enabledChannels.length === 0) {
      console.log(`No enabled channels for user ${request.userId}`);
      return [];
    }

    // Check if we should group this notification
    const groupId = await this.getGroupId(request, preferences);

    // Create notifications for each channel
    const notificationIds: string[] = [];

    for (const channel of enabledChannels) {
      const notification = await this.repository.createNotification({
        userId: request.userId,
        channel,
        priority: request.priority,
        status: "pending",
        subject: request.subject,
        title: request.title,
        body: request.body,
        data: request.data,
        templateId: request.templateId,
        alertEventId: request.alertEventId,
        groupId,
        scheduledFor: request.scheduledFor,
        retryCount: 0,
        maxRetries: 3
      });

      notificationIds.push(notification.id);
    }

    // Process notifications immediately if not scheduled
    if (!request.scheduledFor) {
      await this.processNotifications(notificationIds);
    }

    return notificationIds;
  }

  /**
   * Process pending notifications
   */
  async processPendingNotifications(): Promise<void> {
    const notifications = await this.repository.getPendingNotifications();

    if (notifications.length === 0) {
      return;
    }

    console.log(`Processing ${notifications.length} pending notifications`);

    await this.processNotifications(notifications.map(n => n.id));
  }

  /**
   * Process specific notifications
   */
  private async processNotifications(notificationIds: string[]): Promise<void> {
    for (const id of notificationIds) {
      try {
        const notification = await this.repository.getNotificationById(id);
        if (!notification) continue;

        await this.repository.updateNotificationStatus(id, "sending");

        const result = await this.deliverNotification(notification);

        if (result.success) {
          await this.repository.updateNotificationStatus(id, "delivered");
        } else {
          // Retry logic
          if (notification.retryCount < notification.maxRetries) {
            await this.repository.incrementRetryCount(id);
            await this.repository.updateNotificationStatus(id, "retrying", result.error);
          } else {
            await this.repository.updateNotificationStatus(id, "failed", result.error);
          }
        }
      } catch (error) {
        console.error(`Error processing notification ${id}:`, error);
      }
    }
  }

  /**
   * Deliver notification via appropriate channel
   */
  private async deliverNotification(
    notification: Notification
  ): Promise<NotificationDeliveryResult> {
    const preferences = await this.repository.getPreferences(notification.userId);

    switch (notification.channel) {
      case "email":
        return await this.deliverEmail(notification, preferences);

      case "sms":
        return await this.deliverSMS(notification, preferences);

      case "push":
        return await this.deliverPush(notification, preferences);

      case "telegram":
        return await this.deliverTelegram(notification, preferences);

      case "discord":
        return await this.deliverDiscord(notification, preferences);

      case "slack":
        return await this.deliverSlack(notification, preferences);

      case "in-app":
        return await this.deliverInApp(notification);

      default:
        return {
          notificationId: notification.id,
          channel: notification.channel,
          success: false,
          error: `Unsupported channel: ${notification.channel}`
        };
    }
  }

  /**
   * Deliver email notification
   */
  private async deliverEmail(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<NotificationDeliveryResult> {
    if (!this.emailService) {
      return {
        notificationId: notification.id,
        channel: "email",
        success: false,
        error: "Email service not configured"
      };
    }

    const emailConfig = preferences.channels.email;
    if (!emailConfig?.enabled || !emailConfig.address) {
      return {
        notificationId: notification.id,
        channel: "email",
        success: false,
        error: "Email not configured for user"
      };
    }

    return await this.emailService.send(notification, emailConfig.address);
  }

  /**
   * Deliver SMS notification
   */
  private async deliverSMS(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<NotificationDeliveryResult> {
    if (!this.smsService) {
      return {
        notificationId: notification.id,
        channel: "sms",
        success: false,
        error: "SMS service not configured"
      };
    }

    const smsConfig = preferences.channels.sms;
    if (!smsConfig?.enabled || !smsConfig.phoneNumber) {
      return {
        notificationId: notification.id,
        channel: "sms",
        success: false,
        error: "SMS not configured for user"
      };
    }

    return await this.smsService.send(notification, smsConfig.phoneNumber);
  }

  /**
   * Deliver push notification
   */
  private async deliverPush(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<NotificationDeliveryResult> {
    if (!this.pushService) {
      return {
        notificationId: notification.id,
        channel: "push",
        success: false,
        error: "Push service not configured"
      };
    }

    const pushConfig = preferences.channels.push;
    if (!pushConfig?.enabled || !pushConfig.subscriptions?.length) {
      return {
        notificationId: notification.id,
        channel: "push",
        success: false,
        error: "Push not configured for user"
      };
    }

    return await this.pushService.send(notification, pushConfig.subscriptions);
  }

  /**
   * Deliver Telegram notification
   */
  private async deliverTelegram(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<NotificationDeliveryResult> {
    if (!this.telegramService) {
      return {
        notificationId: notification.id,
        channel: "telegram",
        success: false,
        error: "Telegram service not configured"
      };
    }

    const telegramConfig = preferences.channels.telegram;
    if (!telegramConfig?.enabled || !telegramConfig.chatId) {
      return {
        notificationId: notification.id,
        channel: "telegram",
        success: false,
        error: "Telegram not configured for user"
      };
    }

    return await this.telegramService.send(notification, telegramConfig.chatId);
  }

  /**
   * Deliver Discord notification
   */
  private async deliverDiscord(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<NotificationDeliveryResult> {
    if (!this.discordService) {
      return {
        notificationId: notification.id,
        channel: "discord",
        success: false,
        error: "Discord service not configured"
      };
    }

    const discordConfig = preferences.channels.discord;
    if (!discordConfig?.enabled || !discordConfig.webhookUrl) {
      return {
        notificationId: notification.id,
        channel: "discord",
        success: false,
        error: "Discord not configured for user"
      };
    }

    return await this.discordService.send(notification, discordConfig.webhookUrl);
  }

  /**
   * Deliver Slack notification
   */
  private async deliverSlack(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<NotificationDeliveryResult> {
    if (!this.slackService) {
      return {
        notificationId: notification.id,
        channel: "slack",
        success: false,
        error: "Slack service not configured"
      };
    }

    const slackConfig = preferences.channels.slack;
    if (!slackConfig?.enabled || !slackConfig.webhookUrl) {
      return {
        notificationId: notification.id,
        channel: "slack",
        success: false,
        error: "Slack not configured for user"
      };
    }

    return await this.slackService.send(
      notification,
      slackConfig.webhookUrl,
      slackConfig.channel
    );
  }

  /**
   * Deliver in-app notification
   */
  private async deliverInApp(notification: Notification): Promise<NotificationDeliveryResult> {
    // In-app notifications are stored in database and retrieved by frontend
    return {
      notificationId: notification.id,
      channel: "in-app",
      success: true,
      deliveredAt: new Date().toISOString()
    };
  }

  /**
   * Filter channels based on preferences and quiet hours
   */
  private filterChannels(
    requestedChannels: NotificationChannel[],
    preferences: NotificationPreferences,
    priority: Notification["priority"]
  ): NotificationChannel[] {
    const filtered: NotificationChannel[] = [];

    // Check quiet hours (except for critical alerts)
    if (priority !== "critical" && this.isQuietHours(preferences)) {
      // Only allow in-app notifications during quiet hours
      return requestedChannels.filter(ch => ch === "in-app");
    }

    for (const channel of requestedChannels) {
      // Check if channel is enabled
      const channelConfig = preferences.channels[this.getChannelKey(channel)];
      if (!channelConfig?.enabled) {
        continue;
      }

      // Check alert filters
      if (preferences.alertFilters?.minPriority) {
        const priorityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
        if (priorityLevels[priority] < priorityLevels[preferences.alertFilters.minPriority]) {
          continue;
        }
      }

      filtered.push(channel);
    }

    return filtered;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const timezone = preferences.quietHours.timezone || "UTC";

    // In production, use proper timezone handling
    // For now, simple time comparison
    const currentTime = now.toTimeString().substring(0, 5); // HH:mm
    const start = preferences.quietHours.start;
    const end = preferences.quietHours.end;

    if (start < end) {
      return currentTime >= start && currentTime < end;
    } else {
      // Quiet hours span midnight
      return currentTime >= start || currentTime < end;
    }
  }

  /**
   * Get channel key for preferences lookup
   */
  private getChannelKey(channel: NotificationChannel): keyof NotificationPreferences["channels"] {
    const mapping: Record<NotificationChannel, keyof NotificationPreferences["channels"]> = {
      email: "email",
      sms: "sms",
      push: "push",
      telegram: "telegram",
      discord: "discord",
      slack: "slack",
      "in-app": "inApp"
    };
    return mapping[channel];
  }

  /**
   * Get group ID for notification grouping
   */
  private async getGroupId(
    request: SendNotificationRequest,
    preferences: NotificationPreferences
  ): Promise<string | undefined> {
    if (!preferences.grouping?.enabled) {
      return undefined;
    }

    // Group notifications by alert type and symbol within time window
    const windowMs = preferences.grouping.windowMinutes * 60 * 1000;
    const groupKey = `${request.data?.alertType || "general"}-${request.data?.symbol || "all"}`;

    return `group-${groupKey}-${Math.floor(Date.now() / windowMs)}`;
  }

  /**
   * Get notification history
   */
  async getHistory(
    userId: string,
    options?: {
      channel?: string;
      status?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    return await this.repository.getNotificationsByUserId(userId, options);
  }

  /**
   * Get notification statistics
   */
  async getStats(userId: string) {
    return await this.repository.getNotificationStats(userId);
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string) {
    return await this.repository.getPreferences(userId);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, updates: any) {
    return await this.repository.updatePreferences(userId, updates);
  }

  /**
   * Add push subscription
   */
  async addPushSubscription(userId: string, subscription: any) {
    return await this.repository.addPushSubscription(userId, subscription);
  }

  /**
   * Remove push subscription
   */
  async removePushSubscription(userId: string, endpoint: string) {
    return await this.repository.removePushSubscription(userId, endpoint);
  }

  /**
   * Create notification template
   */
  async createTemplate(request: any) {
    return await this.repository.createTemplate(request);
  }

  /**
   * Get templates
   */
  async getTemplates(channel?: string) {
    return await this.repository.getTemplates(channel);
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, updates: any) {
    return await this.repository.updateTemplate(id, updates);
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string) {
    return await this.repository.deleteTemplate(id);
  }
}
