/**
 * Webhook Types and Interfaces
 */

export enum WebhookEvent {
  SIGNAL_GENERATED = 'signal.generated',
  ALERT_TRIGGERED = 'alert.triggered',
  TRADE_EXECUTED = 'trade.executed',
  POSITION_OPENED = 'position.opened',
  POSITION_CLOSED = 'position.closed',
  PRICE_THRESHOLD = 'price.threshold',
  WHALE_DETECTED = 'whale.detected',
  SENTIMENT_CHANGED = 'sentiment.changed',
}

export interface WebhookRetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  retryPolicy: WebhookRetryPolicy;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
  metadata?: Record<string, any>;
}

export interface WebhookDeliveryAttempt {
  id: string;
  webhookId: string;
  eventType: WebhookEvent;
  payload: any;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  attemptNumber: number;
  createdAt: Date;
  deliveredAt?: Date;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  eventType: WebhookEvent;
  payload: any;
  statusCode: number;
  responseBody?: string;
  errorMessage?: string;
  deliveryTimeMs: number;
  attemptNumber: number;
  success: boolean;
  createdAt: Date;
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEvent[];
  retryPolicy?: Partial<WebhookRetryPolicy>;
  metadata?: Record<string, any>;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: WebhookEvent[];
  active?: boolean;
  retryPolicy?: Partial<WebhookRetryPolicy>;
  metadata?: Record<string, any>;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: any;
  webhookId: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveryTimeMs: number;
}

export interface WebhookHealth {
  webhookId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  averageDeliveryTimeMs: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

export const DEFAULT_RETRY_POLICY: WebhookRetryPolicy = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
};
