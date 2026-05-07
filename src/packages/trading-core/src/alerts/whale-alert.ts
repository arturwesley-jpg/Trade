import type { CreateAlertRuleRequest } from "./types.js";

export interface WhaleTransaction {
  id: string;
  symbol: string;
  amount: number;
  valueUsd: number;
  from: string;
  to: string;
  type: "EXCHANGE_INFLOW" | "EXCHANGE_OUTFLOW" | "LARGE_TRANSFER" | "ACCUMULATION" | "DISTRIBUTION";
  timestamp: string;
}

export class WhaleAlertBuilder {
  /**
   * Create alert for large transfers
   * Example: Transfer > $1M detected
   */
  static largeTransfer(symbol: string, minValueUsd = 1_000_000, cooldownMinutes = 30): CreateAlertRuleRequest {
    return {
      name: `${symbol} large transfer (>$${(minValueUsd / 1_000_000).toFixed(1)}M)`,
      description: `Alert when a ${symbol} transfer exceeding $${minValueUsd.toLocaleString()} is detected`,
      type: "whale",
      symbol,
      conditions: [
        {
          field: "whale.valueUsd",
          condition: "above",
          value: minValueUsd
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for exchange inflow spike
   * Example: Large amount moving to exchanges (potential sell pressure)
   */
  static exchangeInflowSpike(symbol: string, minValueUsd = 5_000_000, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol} exchange inflow spike (>$${(minValueUsd / 1_000_000).toFixed(1)}M)`,
      description: `Alert when large ${symbol} inflow to exchanges detected (potential sell pressure)`,
      type: "whale",
      symbol,
      conditions: [
        {
          field: "whale.exchangeInflow",
          condition: "above",
          value: minValueUsd
        }
      ],
      frequency: "5m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for exchange outflow spike
   * Example: Large amount moving from exchanges (potential accumulation)
   */
  static exchangeOutflowSpike(symbol: string, minValueUsd = 5_000_000, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol} exchange outflow spike (>$${(minValueUsd / 1_000_000).toFixed(1)}M)`,
      description: `Alert when large ${symbol} outflow from exchanges detected (potential accumulation)`,
      type: "whale",
      symbol,
      conditions: [
        {
          field: "whale.exchangeOutflow",
          condition: "above",
          value: minValueUsd
        }
      ],
      frequency: "5m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for whale accumulation pattern
   * Example: Multiple large buys detected
   */
  static accumulationPattern(symbol: string, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol} whale accumulation detected`,
      description: `Alert when whale accumulation pattern detected for ${symbol}`,
      type: "whale",
      symbol,
      conditions: [
        {
          field: "whale.accumulationScore",
          condition: "above",
          value: 70 // Score 0-100
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for whale distribution pattern
   * Example: Multiple large sells detected
   */
  static distributionPattern(symbol: string, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol} whale distribution detected`,
      description: `Alert when whale distribution pattern detected for ${symbol}`,
      type: "whale",
      symbol,
      conditions: [
        {
          field: "whale.distributionScore",
          condition: "above",
          value: 70 // Score 0-100
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for stablecoin flow changes
   * Example: Large USDT/USDC moving to exchanges (potential buying power)
   */
  static stablecoinInflow(minValueUsd = 10_000_000, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `Stablecoin inflow spike (>$${(minValueUsd / 1_000_000).toFixed(1)}M)`,
      description: `Alert when large stablecoin inflow to exchanges detected (potential buying power)`,
      type: "whale",
      conditions: [
        {
          field: "whale.stablecoinInflow",
          condition: "above",
          value: minValueUsd
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for unusual wallet activity
   * Example: Dormant whale wallet becomes active
   */
  static dormantWalletActive(symbol: string, cooldownMinutes = 240): CreateAlertRuleRequest {
    return {
      name: `${symbol} dormant whale wallet active`,
      description: `Alert when a dormant ${symbol} whale wallet becomes active`,
      type: "whale",
      symbol,
      conditions: [
        {
          field: "whale.dormantWalletActive",
          condition: "equals",
          value: 1 // Boolean flag
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }
}

/**
 * Analyze whale transactions to detect patterns
 */
export function analyzeWhaleActivity(transactions: WhaleTransaction[]): {
  accumulationScore: number;
  distributionScore: number;
  netFlow: number;
  largestTransaction: WhaleTransaction | null;
} {
  if (transactions.length === 0) {
    return {
      accumulationScore: 0,
      distributionScore: 0,
      netFlow: 0,
      largestTransaction: null
    };
  }

  let exchangeInflow = 0;
  let exchangeOutflow = 0;
  let largestTransaction = transactions[0];

  for (const tx of transactions) {
    if (tx.type === "EXCHANGE_INFLOW") {
      exchangeInflow += tx.valueUsd;
    } else if (tx.type === "EXCHANGE_OUTFLOW") {
      exchangeOutflow += tx.valueUsd;
    }

    if (tx.valueUsd > largestTransaction.valueUsd) {
      largestTransaction = tx;
    }
  }

  const netFlow = exchangeOutflow - exchangeInflow;
  const totalVolume = exchangeInflow + exchangeOutflow;

  // Calculate accumulation score (0-100)
  // Higher when more outflow (coins leaving exchanges)
  const accumulationScore = totalVolume > 0
    ? Math.min(100, (exchangeOutflow / totalVolume) * 100)
    : 0;

  // Calculate distribution score (0-100)
  // Higher when more inflow (coins entering exchanges)
  const distributionScore = totalVolume > 0
    ? Math.min(100, (exchangeInflow / totalVolume) * 100)
    : 0;

  return {
    accumulationScore: Math.round(accumulationScore),
    distributionScore: Math.round(distributionScore),
    netFlow,
    largestTransaction
  };
}
