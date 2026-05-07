/**
 * Alert Engine
 * Intelligent alert system with conditions and notifications
 */

export type AlertCondition = 
  | "price_above"
  | "price_below"
  | "price_change_percent"
  | "volume_spike"
  | "rsi_overbought"
  | "rsi_oversold"
  | "macd_crossover"
  | "support_break"
  | "resistance_break";

export type AlertPriority = "low" | "medium" | "high" | "critical";

export interface AlertRule {
  id: string;
  name: string;
  symbol: string;
  condition: AlertCondition;
  threshold: number;
  priority: AlertPriority;
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: number;
  metadata?: Record<string, unknown>;
}

export interface AlertTrigger {
  ruleId: string;
  ruleName: string;
  symbol: string;
  condition: AlertCondition;
  currentValue: number;
  threshold: number;
  priority: AlertPriority;
  timestamp: number;
  message: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
  timestamp: number;
}

export interface TechnicalIndicators {
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  support?: number;
  resistance?: number;
}

export class AlertEngine {
  private rules = new Map<string, AlertRule>();
  private triggers: AlertTrigger[] = [];

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Update an alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.set(ruleId, { ...rule, ...updates });
    }
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules for a specific symbol
   */
  getRulesForSymbol(symbol: string): AlertRule[] {
    return this.getRules().filter(r => r.symbol === symbol && r.enabled);
  }

  /**
   * Check market data against all rules
   */
  checkAlerts(marketData: MarketData, indicators?: TechnicalIndicators): AlertTrigger[] {
    const newTriggers: AlertTrigger[] = [];
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.symbol !== marketData.symbol) continue;

      // Check cooldown
      if (rule.lastTriggered && now - rule.lastTriggered < rule.cooldownMs) {
        continue;
      }

      const trigger = this.evaluateRule(rule, marketData, indicators, now);
      if (trigger) {
        newTriggers.push(trigger);
        rule.lastTriggered = now;
        this.triggers.push(trigger);
      }
    }

    return newTriggers;
  }

  /**
   * Get recent triggers
   */
  getRecentTriggers(limit: number = 50): AlertTrigger[] {
    return this.triggers.slice(-limit);
  }

  /**
   * Clear old triggers
   */
  clearOldTriggers(olderThanMs: number): void {
    const cutoff = Date.now() - olderThanMs;
    this.triggers = this.triggers.filter(t => t.timestamp > cutoff);
  }

  private evaluateRule(
    rule: AlertRule,
    marketData: MarketData,
    indicators: TechnicalIndicators | undefined,
    timestamp: number
  ): AlertTrigger | null {
    let triggered = false;
    let currentValue = 0;
    let message = "";

    switch (rule.condition) {
      case "price_above":
        currentValue = marketData.price;
        triggered = currentValue > rule.threshold;
        message = `${rule.symbol} price ($${currentValue.toFixed(2)}) is above $${rule.threshold.toFixed(2)}`;
        break;

      case "price_below":
        currentValue = marketData.price;
        triggered = currentValue < rule.threshold;
        message = `${rule.symbol} price ($${currentValue.toFixed(2)}) is below $${rule.threshold.toFixed(2)}`;
        break;

      case "price_change_percent":
        currentValue = marketData.change24h;
        triggered = Math.abs(currentValue) > rule.threshold;
        message = `${rule.symbol} changed ${currentValue.toFixed(2)}% in 24h (threshold: ${rule.threshold}%)`;
        break;

      case "volume_spike":
        currentValue = marketData.volume;
        // Volume spike detection would need historical average
        // For now, just check if volume exceeds threshold
        triggered = currentValue > rule.threshold;
        message = `${rule.symbol} volume spike: ${currentValue.toFixed(0)} (threshold: ${rule.threshold})`;
        break;

      case "rsi_overbought":
        if (!indicators?.rsi) return null;
        currentValue = indicators.rsi;
        triggered = currentValue > rule.threshold;
        message = `${rule.symbol} RSI is overbought: ${currentValue.toFixed(2)} (threshold: ${rule.threshold})`;
        break;

      case "rsi_oversold":
        if (!indicators?.rsi) return null;
        currentValue = indicators.rsi;
        triggered = currentValue < rule.threshold;
        message = `${rule.symbol} RSI is oversold: ${currentValue.toFixed(2)} (threshold: ${rule.threshold})`;
        break;

      case "macd_crossover":
        if (!indicators?.macd) return null;
        currentValue = indicators.macd.histogram;
        // Detect crossover (histogram changes sign)
        triggered = Math.abs(currentValue) < rule.threshold && currentValue !== 0;
        message = `${rule.symbol} MACD crossover detected`;
        break;

      case "support_break":
        if (!indicators?.support) return null;
        currentValue = marketData.price;
        triggered = currentValue < indicators.support;
        message = `${rule.symbol} broke support at $${indicators.support.toFixed(2)} (current: $${currentValue.toFixed(2)})`;
        break;

      case "resistance_break":
        if (!indicators?.resistance) return null;
        currentValue = marketData.price;
        triggered = currentValue > indicators.resistance;
        message = `${rule.symbol} broke resistance at $${indicators.resistance.toFixed(2)} (current: $${currentValue.toFixed(2)})`;
        break;
    }

    if (!triggered) return null;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      symbol: rule.symbol,
      condition: rule.condition,
      currentValue,
      threshold: rule.threshold,
      priority: rule.priority,
      timestamp,
      message
    };
  }
}

/**
 * Alert notification handler
 */
export interface AlertNotificationHandler {
  send(trigger: AlertTrigger): Promise<void>;
}

/**
 * Console notification handler
 */
export class ConsoleNotificationHandler implements AlertNotificationHandler {
  async send(trigger: AlertTrigger): Promise<void> {
    const emoji = this.getPriorityEmoji(trigger.priority);
    console.log(`${emoji} [${trigger.priority.toUpperCase()}] ${trigger.message}`);
  }

  private getPriorityEmoji(priority: AlertPriority): string {
    switch (priority) {
      case "low": return "ℹ️";
      case "medium": return "⚠️";
      case "high": return "🔴";
      case "critical": return "🚨";
    }
  }
}

/**
 * Telegram notification handler
 */
export class TelegramNotificationHandler implements AlertNotificationHandler {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string
  ) {}

  async send(trigger: AlertTrigger): Promise<void> {
    const emoji = this.getPriorityEmoji(trigger.priority);
    const text = `${emoji} *${trigger.priority.toUpperCase()}*\n\n${trigger.message}`;

    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: "Markdown"
        })
      });
    } catch (error) {
      console.error("Failed to send Telegram alert:", error);
    }
  }

  private getPriorityEmoji(priority: AlertPriority): string {
    switch (priority) {
      case "low": return "ℹ️";
      case "medium": return "⚠️";
      case "high": return "🔴";
      case "critical": return "🚨";
    }
  }
}

/**
 * Alert manager with notification support
 */
export class AlertManager {
  private engine = new AlertEngine();
  private handlers: AlertNotificationHandler[] = [];

  addHandler(handler: AlertNotificationHandler): void {
    this.handlers.push(handler);
  }

  addRule(rule: AlertRule): void {
    this.engine.addRule(rule);
  }

  removeRule(ruleId: string): void {
    this.engine.removeRule(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    this.engine.updateRule(ruleId, updates);
  }

  getRules(): AlertRule[] {
    return this.engine.getRules();
  }

  async checkAlerts(marketData: MarketData, indicators?: TechnicalIndicators): Promise<AlertTrigger[]> {
    const triggers = this.engine.checkAlerts(marketData, indicators);

    // Send notifications for new triggers
    for (const trigger of triggers) {
      await this.notifyHandlers(trigger);
    }

    return triggers;
  }

  getRecentTriggers(limit?: number): AlertTrigger[] {
    return this.engine.getRecentTriggers(limit);
  }

  private async notifyHandlers(trigger: AlertTrigger): Promise<void> {
    await Promise.allSettled(
      this.handlers.map(handler => handler.send(trigger))
    );
  }
}
