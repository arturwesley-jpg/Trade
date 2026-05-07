export type AlertRuleType = "price" | "indicator" | "whale" | "news" | "sentiment" | "risk";
export type AlertCondition = "above" | "below" | "crosses_above" | "crosses_below" | "equals" | "changes_by";
export type AlertOperator = "AND" | "OR" | "NOT";
export type AlertFrequency = "real-time" | "1m" | "5m" | "15m" | "1h";
export type AlertStatus = "active" | "paused" | "triggered" | "expired";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertDeliveryChannel = "telegram" | "email" | "webhook" | "in-app";

export interface AlertRuleCondition {
  field: string;
  condition: AlertCondition;
  value: number;
  operator?: AlertOperator;
}

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: AlertRuleType;
  symbol?: string;
  conditions: AlertRuleCondition[];
  frequency: AlertFrequency;
  status: AlertStatus;
  cooldownMinutes: number;
  expiresAt?: string;
  deliveryChannels: AlertDeliveryChannel[];
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  userId: string;
  type: AlertRuleType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context: Record<string, any>;
  status: "pending" | "delivered" | "acknowledged" | "snoozed" | "failed";
  deliveryChannels: AlertDeliveryChannel[];
  deliveryAttempts: number;
  createdAt: string;
  deliveredAt?: string;
  acknowledgedAt?: string;
  snoozedUntil?: string;
  error?: string;
}

export interface CreateAlertRuleRequest {
  name: string;
  description?: string;
  type: AlertRuleType;
  symbol?: string;
  conditions: AlertRuleCondition[];
  frequency: AlertFrequency;
  cooldownMinutes?: number;
  expiresAt?: string;
  deliveryChannels?: AlertDeliveryChannel[];
}

export interface UpdateAlertRuleRequest {
  name?: string;
  description?: string;
  conditions?: AlertRuleCondition[];
  frequency?: AlertFrequency;
  status?: AlertStatus;
  cooldownMinutes?: number;
  expiresAt?: string;
  deliveryChannels?: AlertDeliveryChannel[];
}

export interface AlertStatistics {
  totalRules: number;
  activeRules: number;
  pausedRules: number;
  totalEvents: number;
  pendingEvents: number;
  deliveredEvents: number;
  acknowledgedEvents: number;
  failedEvents: number;
  last24hEvents: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24hPct: number;
  volume24h: number;
  timestamp: number;
}

export interface IndicatorData {
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  movingAverages?: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    ema20?: number;
    ema50?: number;
  };
}

export interface AlertEvaluationContext {
  marketData: MarketData;
  indicators?: IndicatorData;
  previousMarketData?: MarketData;
  previousIndicators?: IndicatorData;
  whaleEvents?: any[];
  newsItems?: any[];
  sentimentScore?: number;
  riskMetrics?: any;
}
