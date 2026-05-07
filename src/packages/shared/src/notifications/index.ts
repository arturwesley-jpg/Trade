export { NotificationService, notificationService } from "./notification-service.js";
export { EmailHandler } from "./handlers/email-handler.js";
export { TelegramHandler } from "./handlers/telegram-handler.js";
export { WebhookHandler } from "./handlers/webhook-handler.js";
export { SlackHandler } from "./handlers/slack-handler.js";
export { WebSocketHandler } from "./handlers/websocket-handler.js";
export type {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationMessage,
  NotificationRequest,
  MultiChannelNotificationRequest,
  TemplateNotificationRequest,
  NotificationTemplate,
  NotificationHandler,
  NotificationRecord,
  NotificationHistoryQuery,
  BatchConfig,
  RateLimitConfig
} from "./types.js";
export type { EmailConfig } from "./handlers/email-handler.js";
export type { TelegramConfig } from "./handlers/telegram-handler.js";
export type { WebhookConfig } from "./handlers/webhook-handler.js";
export type { SlackConfig } from "./handlers/slack-handler.js";
export type { WebSocketNotificationConfig } from "./handlers/websocket-handler.js";
