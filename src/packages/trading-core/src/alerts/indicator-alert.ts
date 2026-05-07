import type { CreateAlertRuleRequest } from "./types.js";

export class IndicatorAlertBuilder {
  /**
   * Create alert for RSI overbought
   * Example: RSI > 70
   */
  static rsiOverbought(symbol: string, threshold = 70, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol} RSI overbought (>${threshold})`,
      description: `Alert when ${symbol} RSI goes above ${threshold} (overbought condition)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "rsi",
          condition: "above",
          value: threshold
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for RSI oversold
   * Example: RSI < 30
   */
  static rsiOversold(symbol: string, threshold = 30, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol} RSI oversold (<${threshold})`,
      description: `Alert when ${symbol} RSI goes below ${threshold} (oversold condition)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "rsi",
          condition: "below",
          value: threshold
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for MACD bullish crossover
   * Example: MACD line crosses above signal line
   */
  static macdBullishCrossover(symbol: string, cooldownMinutes = 240): CreateAlertRuleRequest {
    return {
      name: `${symbol} MACD bullish crossover`,
      description: `Alert when ${symbol} MACD line crosses above signal line (bullish signal)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "macd.histogram",
          condition: "crosses_above",
          value: 0
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for MACD bearish crossover
   * Example: MACD line crosses below signal line
   */
  static macdBearishCrossover(symbol: string, cooldownMinutes = 240): CreateAlertRuleRequest {
    return {
      name: `${symbol} MACD bearish crossover`,
      description: `Alert when ${symbol} MACD line crosses below signal line (bearish signal)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "macd.histogram",
          condition: "crosses_below",
          value: 0
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for Bollinger Band upper breakout
   * Example: Price breaks above upper Bollinger Band
   */
  static bollingerUpperBreakout(symbol: string, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol} breaks above upper Bollinger Band`,
      description: `Alert when ${symbol} price breaks above the upper Bollinger Band`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "bb.upper",
          condition: "crosses_above",
          value: 0 // Will compare price against BB upper
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for Bollinger Band lower breakout
   * Example: Price breaks below lower Bollinger Band
   */
  static bollingerLowerBreakout(symbol: string, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol} breaks below lower Bollinger Band`,
      description: `Alert when ${symbol} price breaks below the lower Bollinger Band`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "bb.lower",
          condition: "crosses_below",
          value: 0 // Will compare price against BB lower
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for Bollinger Band squeeze
   * Example: Bollinger Bands are very narrow (low volatility)
   */
  static bollingerSqueeze(symbol: string, squeezeThreshold = 2, cooldownMinutes = 240): CreateAlertRuleRequest {
    return {
      name: `${symbol} Bollinger Band squeeze`,
      description: `Alert when ${symbol} Bollinger Bands narrow to ${squeezeThreshold}% or less (potential breakout setup)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "bb.upper",
          condition: "below",
          value: squeezeThreshold // Percentage width
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for RSI divergence
   * Example: Price makes new high but RSI doesn't (bearish divergence)
   */
  static rsiBearishDivergence(symbol: string, cooldownMinutes = 360): CreateAlertRuleRequest {
    return {
      name: `${symbol} RSI bearish divergence`,
      description: `Alert when ${symbol} shows bearish RSI divergence (price higher, RSI lower)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "rsi",
          condition: "below",
          value: 65 // RSI not confirming new highs
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for multiple indicator confluence
   * Example: RSI oversold + MACD bullish + price at lower BB
   */
  static bullishConfluence(symbol: string, cooldownMinutes = 240): CreateAlertRuleRequest {
    return {
      name: `${symbol} bullish confluence`,
      description: `Alert when ${symbol} shows multiple bullish indicators (RSI oversold, MACD positive, near lower BB)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "rsi",
          condition: "below",
          value: 35,
          operator: "AND"
        },
        {
          field: "macd.histogram",
          condition: "above",
          value: 0,
          operator: "AND"
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for bearish confluence
   * Example: RSI overbought + MACD bearish + price at upper BB
   */
  static bearishConfluence(symbol: string, cooldownMinutes = 240): CreateAlertRuleRequest {
    return {
      name: `${symbol} bearish confluence`,
      description: `Alert when ${symbol} shows multiple bearish indicators (RSI overbought, MACD negative, near upper BB)`,
      type: "indicator",
      symbol,
      conditions: [
        {
          field: "rsi",
          condition: "above",
          value: 65,
          operator: "AND"
        },
        {
          field: "macd.histogram",
          condition: "below",
          value: 0,
          operator: "AND"
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }
}
