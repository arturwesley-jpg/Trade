import type {
  AlertRule,
  AlertRuleCondition,
  AlertEvaluationContext,
  AlertCondition,
  AlertOperator
} from "./types.js";

export class AlertRuleEngine {
  /**
   * Evaluate if an alert rule should trigger based on current market context
   */
  evaluateRule(rule: AlertRule, context: AlertEvaluationContext): {
    shouldTrigger: boolean;
    reason?: string;
    matchedConditions?: string[];
  } {
    // Check if rule is active
    if (rule.status !== "active") {
      return { shouldTrigger: false, reason: "Rule is not active" };
    }

    // Check if rule has expired
    if (rule.expiresAt && new Date(rule.expiresAt) < new Date()) {
      return { shouldTrigger: false, reason: "Rule has expired" };
    }

    // Check if rule is in cooldown period
    if (rule.lastTriggeredAt && rule.cooldownMinutes > 0) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - new Date(rule.lastTriggeredAt).getTime();
      if (timeSinceLastTrigger < cooldownMs) {
        return { shouldTrigger: false, reason: "Rule is in cooldown period" };
      }
    }

    // Check if symbol matches (if specified)
    if (rule.symbol && context.marketData.symbol !== rule.symbol) {
      return { shouldTrigger: false, reason: "Symbol does not match" };
    }

    // Evaluate conditions
    const matchedConditions: string[] = [];
    let allConditionsMet = true;

    for (const condition of rule.conditions) {
      const result = this.evaluateCondition(condition, context);
      if (result.met) {
        matchedConditions.push(result.description);
      } else {
        allConditionsMet = false;
        // If any condition fails and we're using AND logic, we can short-circuit
        if (!condition.operator || condition.operator === "AND") {
          break;
        }
      }
    }

    // For now, we use simple AND logic (all conditions must be met)
    // TODO: Implement complex boolean logic with OR and NOT operators
    const shouldTrigger = allConditionsMet && matchedConditions.length > 0;

    return {
      shouldTrigger,
      reason: shouldTrigger ? "All conditions met" : "Not all conditions met",
      matchedConditions: shouldTrigger ? matchedConditions : undefined
    };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: AlertRuleCondition,
    context: AlertEvaluationContext
  ): { met: boolean; description: string } {
    const { field, condition: conditionType, value } = condition;

    // Get current and previous values
    const currentValue = this.getFieldValue(field, context);
    const previousValue = this.getPreviousFieldValue(field, context);

    if (currentValue === null) {
      return { met: false, description: `Field ${field} not available` };
    }

    let met = false;
    let description = "";

    switch (conditionType) {
      case "above":
        met = currentValue > value;
        description = `${field} (${currentValue.toFixed(2)}) is above ${value}`;
        break;

      case "below":
        met = currentValue < value;
        description = `${field} (${currentValue.toFixed(2)}) is below ${value}`;
        break;

      case "equals":
        met = Math.abs(currentValue - value) < 0.0001; // Float comparison with tolerance
        description = `${field} (${currentValue.toFixed(2)}) equals ${value}`;
        break;

      case "crosses_above":
        if (previousValue !== null) {
          met = previousValue <= value && currentValue > value;
          description = `${field} crossed above ${value} (from ${previousValue.toFixed(2)} to ${currentValue.toFixed(2)})`;
        }
        break;

      case "crosses_below":
        if (previousValue !== null) {
          met = previousValue >= value && currentValue < value;
          description = `${field} crossed below ${value} (from ${previousValue.toFixed(2)} to ${currentValue.toFixed(2)})`;
        }
        break;

      case "changes_by":
        if (previousValue !== null && previousValue !== 0) {
          const changePct = ((currentValue - previousValue) / previousValue) * 100;
          met = Math.abs(changePct) >= value;
          description = `${field} changed by ${changePct.toFixed(2)}% (threshold: ${value}%)`;
        }
        break;

      default:
        description = `Unknown condition type: ${conditionType}`;
    }

    return { met, description };
  }

  /**
   * Get field value from context
   */
  private getFieldValue(field: string, context: AlertEvaluationContext): number | null {
    const parts = field.split(".");

    if (parts[0] === "price") {
      return context.marketData.price;
    }

    if (parts[0] === "change24hPct") {
      return context.marketData.change24hPct;
    }

    if (parts[0] === "volume24h") {
      return context.marketData.volume24h;
    }

    if (parts[0] === "rsi" && context.indicators?.rsi !== undefined) {
      return context.indicators.rsi;
    }

    if (parts[0] === "macd" && context.indicators?.macd) {
      if (parts[1] === "macd") return context.indicators.macd.macd;
      if (parts[1] === "signal") return context.indicators.macd.signal;
      if (parts[1] === "histogram") return context.indicators.macd.histogram;
    }

    if (parts[0] === "bb" && context.indicators?.bollingerBands) {
      if (parts[1] === "upper") return context.indicators.bollingerBands.upper;
      if (parts[1] === "middle") return context.indicators.bollingerBands.middle;
      if (parts[1] === "lower") return context.indicators.bollingerBands.lower;
    }

    if (parts[0] === "sma" && context.indicators?.movingAverages) {
      if (parts[1] === "20") return context.indicators.movingAverages.sma20 ?? null;
      if (parts[1] === "50") return context.indicators.movingAverages.sma50 ?? null;
      if (parts[1] === "200") return context.indicators.movingAverages.sma200 ?? null;
    }

    if (parts[0] === "ema" && context.indicators?.movingAverages) {
      if (parts[1] === "20") return context.indicators.movingAverages.ema20 ?? null;
      if (parts[1] === "50") return context.indicators.movingAverages.ema50 ?? null;
    }

    if (parts[0] === "sentiment" && context.sentimentScore !== undefined) {
      return context.sentimentScore;
    }

    return null;
  }

  /**
   * Get previous field value from context
   */
  private getPreviousFieldValue(field: string, context: AlertEvaluationContext): number | null {
    if (!context.previousMarketData && !context.previousIndicators) {
      return null;
    }

    const parts = field.split(".");

    if (parts[0] === "price" && context.previousMarketData) {
      return context.previousMarketData.price;
    }

    if (parts[0] === "change24hPct" && context.previousMarketData) {
      return context.previousMarketData.change24hPct;
    }

    if (parts[0] === "rsi" && context.previousIndicators?.rsi !== undefined) {
      return context.previousIndicators.rsi;
    }

    if (parts[0] === "macd" && context.previousIndicators?.macd) {
      if (parts[1] === "macd") return context.previousIndicators.macd.macd;
      if (parts[1] === "signal") return context.previousIndicators.macd.signal;
      if (parts[1] === "histogram") return context.previousIndicators.macd.histogram;
    }

    return null;
  }

  /**
   * Validate alert rule conditions
   */
  validateRule(rule: Partial<AlertRule>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.name || rule.name.trim().length === 0) {
      errors.push("Rule name is required");
    }

    if (!rule.type) {
      errors.push("Rule type is required");
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      errors.push("At least one condition is required");
    }

    if (rule.conditions) {
      for (let i = 0; i < rule.conditions.length; i++) {
        const condition = rule.conditions[i];
        if (!condition.field) {
          errors.push(`Condition ${i + 1}: field is required`);
        }
        if (!condition.condition) {
          errors.push(`Condition ${i + 1}: condition type is required`);
        }
        if (condition.value === undefined || condition.value === null) {
          errors.push(`Condition ${i + 1}: value is required`);
        }
      }
    }

    if (!rule.frequency) {
      errors.push("Evaluation frequency is required");
    }

    if (rule.cooldownMinutes !== undefined && rule.cooldownMinutes < 0) {
      errors.push("Cooldown minutes must be non-negative");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
