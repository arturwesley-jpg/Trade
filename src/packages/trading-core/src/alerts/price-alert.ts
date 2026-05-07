import type { AlertRule, AlertEvaluationContext, CreateAlertRuleRequest } from "./types.js";

export interface PriceAlertConfig {
  symbol: string;
  targetPrice?: number;
  priceAbove?: number;
  priceBelow?: number;
  dropPercentage?: number;
  risePercentage?: number;
  crossesMovingAverage?: "sma20" | "sma50" | "sma200" | "ema20" | "ema50";
}

export class PriceAlertBuilder {
  /**
   * Create alert for price above threshold
   * Example: BTC above $70,000
   */
  static priceAbove(symbol: string, price: number, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol} above $${price.toLocaleString()}`,
      description: `Alert when ${symbol} price goes above $${price.toLocaleString()}`,
      type: "price",
      symbol,
      conditions: [
        {
          field: "price",
          condition: "above",
          value: price
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for price below threshold
   * Example: ETH below $3,000
   */
  static priceBelow(symbol: string, price: number, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol} below $${price.toLocaleString()}`,
      description: `Alert when ${symbol} price goes below $${price.toLocaleString()}`,
      type: "price",
      symbol,
      conditions: [
        {
          field: "price",
          condition: "below",
          value: price
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for price drop percentage
   * Example: BTC drops 5% in 1 hour
   */
  static priceDrops(symbol: string, dropPercentage: number, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol} drops ${dropPercentage}%`,
      description: `Alert when ${symbol} price drops by ${dropPercentage}% or more`,
      type: "price",
      symbol,
      conditions: [
        {
          field: "price",
          condition: "changes_by",
          value: dropPercentage
        }
      ],
      frequency: "1m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for price rise percentage
   * Example: BTC rises 5% in 1 hour
   */
  static priceRises(symbol: string, risePercentage: number, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol} rises ${risePercentage}%`,
      description: `Alert when ${symbol} price rises by ${risePercentage}% or more`,
      type: "price",
      symbol,
      conditions: [
        {
          field: "price",
          condition: "changes_by",
          value: risePercentage
        }
      ],
      frequency: "1m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for price crossing above moving average
   * Example: BTC crosses above 200-day SMA
   */
  static crossesAboveMA(
    symbol: string,
    ma: "sma20" | "sma50" | "sma200" | "ema20" | "ema50",
    cooldownMinutes = 240
  ): CreateAlertRuleRequest {
    const maName = ma.toUpperCase();
    return {
      name: `${symbol} crosses above ${maName}`,
      description: `Alert when ${symbol} price crosses above ${maName}`,
      type: "price",
      symbol,
      conditions: [
        {
          field: ma,
          condition: "crosses_above",
          value: 0 // Will be compared against the MA value
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for price crossing below moving average
   * Example: BTC crosses below 200-day SMA
   */
  static crossesBelowMA(
    symbol: string,
    ma: "sma20" | "sma50" | "sma200" | "ema20" | "ema50",
    cooldownMinutes = 240
  ): CreateAlertRuleRequest {
    const maName = ma.toUpperCase();
    return {
      name: `${symbol} crosses below ${maName}`,
      description: `Alert when ${symbol} price crosses below ${maName}`,
      type: "price",
      symbol,
      conditions: [
        {
          field: ma,
          condition: "crosses_below",
          value: 0 // Will be compared against the MA value
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for price range breakout
   * Example: BTC breaks out of $65k-$70k range
   */
  static priceRangeBreakout(
    symbol: string,
    lowerBound: number,
    upperBound: number,
    cooldownMinutes = 120
  ): CreateAlertRuleRequest {
    return {
      name: `${symbol} breaks $${lowerBound.toLocaleString()}-$${upperBound.toLocaleString()} range`,
      description: `Alert when ${symbol} price breaks out of the $${lowerBound.toLocaleString()}-$${upperBound.toLocaleString()} range`,
      type: "price",
      symbol,
      conditions: [
        {
          field: "price",
          condition: "below",
          value: lowerBound,
          operator: "OR"
        },
        {
          field: "price",
          condition: "above",
          value: upperBound
        }
      ],
      frequency: "5m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }
}

/**
 * Evaluate price-specific alert conditions
 */
export function evaluatePriceAlert(rule: AlertRule, context: AlertEvaluationContext): boolean {
  if (rule.type !== "price") {
    return false;
  }

  // Price alerts are evaluated by the main rule engine
  // This function can add price-specific validation or preprocessing
  return true;
}
