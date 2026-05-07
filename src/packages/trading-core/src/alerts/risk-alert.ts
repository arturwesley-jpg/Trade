import type { CreateAlertRuleRequest } from "./types.js";
import type { Position } from "@trade/shared";

export interface RiskMetrics {
  totalPnl: number;
  totalPnlPct: number;
  dailyPnl: number;
  dailyPnlPct: number;
  weeklyPnl: number;
  weeklyPnlPct: number;
  monthlyPnl: number;
  monthlyPnlPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
  openPositionsCount: number;
  totalMarginUsed: number;
  marginUsagePct: number;
  largestPositionSize: number;
  volatility: number;
}

export class RiskAlertBuilder {
  /**
   * Create alert for position loss threshold
   * Example: Position loss exceeds 5%
   */
  static positionLossThreshold(
    symbol: string,
    lossPct: number,
    cooldownMinutes = 30
  ): CreateAlertRuleRequest {
    return {
      name: `${symbol} position loss exceeds ${lossPct}%`,
      description: `Alert when ${symbol} position loss exceeds ${lossPct}%`,
      type: "risk",
      symbol,
      conditions: [
        {
          field: "position.pnlPct",
          condition: "below",
          value: -lossPct
        }
      ],
      frequency: "5m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for daily loss limit
   * Example: Daily loss exceeds 3%
   */
  static dailyLossLimit(lossPct: number, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `Daily loss exceeds ${lossPct}%`,
      description: `Alert when daily loss exceeds ${lossPct}% of account equity`,
      type: "risk",
      conditions: [
        {
          field: "risk.dailyPnlPct",
          condition: "below",
          value: -lossPct
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for drawdown threshold
   * Example: Total drawdown exceeds 10%
   */
  static drawdownThreshold(drawdownPct: number, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `Drawdown exceeds ${drawdownPct}%`,
      description: `Alert when total drawdown exceeds ${drawdownPct}%`,
      type: "risk",
      conditions: [
        {
          field: "risk.currentDrawdownPct",
          condition: "above",
          value: drawdownPct
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for margin usage
   * Example: Margin usage exceeds 80%
   */
  static marginUsageHigh(usagePct: number, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `Margin usage exceeds ${usagePct}%`,
      description: `Alert when margin usage exceeds ${usagePct}% of available margin`,
      type: "risk",
      conditions: [
        {
          field: "risk.marginUsagePct",
          condition: "above",
          value: usagePct
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for unusual volatility
   * Example: Volatility spike detected
   */
  static volatilitySpike(
    symbol: string,
    volatilityThreshold: number,
    cooldownMinutes = 60
  ): CreateAlertRuleRequest {
    return {
      name: `${symbol} volatility spike`,
      description: `Alert when ${symbol} volatility exceeds ${volatilityThreshold}%`,
      type: "risk",
      symbol,
      conditions: [
        {
          field: "risk.volatility",
          condition: "above",
          value: volatilityThreshold
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for too many open positions
   * Example: Open positions exceed limit
   */
  static tooManyPositions(maxPositions: number, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `Too many open positions (>${maxPositions})`,
      description: `Alert when open positions exceed ${maxPositions}`,
      type: "risk",
      conditions: [
        {
          field: "risk.openPositionsCount",
          condition: "above",
          value: maxPositions
        }
      ],
      frequency: "5m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for position size too large
   * Example: Single position exceeds 30% of equity
   */
  static positionSizeTooLarge(sizePct: number, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `Position size exceeds ${sizePct}% of equity`,
      description: `Alert when a single position exceeds ${sizePct}% of account equity`,
      type: "risk",
      conditions: [
        {
          field: "risk.largestPositionPct",
          condition: "above",
          value: sizePct
        }
      ],
      frequency: "5m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for consecutive losses
   * Example: 3 consecutive losing trades
   */
  static consecutiveLosses(lossCount: number, cooldownMinutes = 180): CreateAlertRuleRequest {
    return {
      name: `${lossCount} consecutive losses`,
      description: `Alert when ${lossCount} consecutive losing trades occur`,
      type: "risk",
      conditions: [
        {
          field: "risk.consecutiveLosses",
          condition: "above",
          value: lossCount
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for win rate drop
   * Example: Win rate drops below 40%
   */
  static winRateDrop(winRatePct: number, cooldownMinutes = 240): CreateAlertRuleRequest {
    return {
      name: `Win rate drops below ${winRatePct}%`,
      description: `Alert when win rate drops below ${winRatePct}%`,
      type: "risk",
      conditions: [
        {
          field: "risk.winRate",
          condition: "below",
          value: winRatePct
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for approaching stop loss
   * Example: Position within 1% of stop loss
   */
  static approachingStopLoss(
    symbol: string,
    distancePct: number,
    cooldownMinutes = 15
  ): CreateAlertRuleRequest {
    return {
      name: `${symbol} approaching stop loss`,
      description: `Alert when ${symbol} position is within ${distancePct}% of stop loss`,
      type: "risk",
      symbol,
      conditions: [
        {
          field: "position.stopLossDistance",
          condition: "below",
          value: distancePct
        }
      ],
      frequency: "1m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }
}

/**
 * Calculate risk metrics from positions and trades
 */
export function calculateRiskMetrics(
  positions: Position[],
  accountEquity: number,
  historicalPnl: { pnl: number; timestamp: string }[]
): RiskMetrics {
  const openPositions = positions.filter(p => p.status === "OPEN");

  // Calculate total margin used
  const totalMarginUsed = openPositions.reduce((sum, p) => sum + p.marginUsdt, 0);
  const marginUsagePct = accountEquity > 0 ? (totalMarginUsed / accountEquity) * 100 : 0;

  // Calculate largest position size
  const largestPositionSize = openPositions.length > 0
    ? Math.max(...openPositions.map(p => p.marginUsdt))
    : 0;

  // Calculate PnL metrics
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const dailyPnl = historicalPnl
    .filter(p => new Date(p.timestamp).getTime() > oneDayAgo)
    .reduce((sum, p) => sum + p.pnl, 0);

  const weeklyPnl = historicalPnl
    .filter(p => new Date(p.timestamp).getTime() > oneWeekAgo)
    .reduce((sum, p) => sum + p.pnl, 0);

  const monthlyPnl = historicalPnl
    .filter(p => new Date(p.timestamp).getTime() > oneMonthAgo)
    .reduce((sum, p) => sum + p.pnl, 0);

  const totalPnl = historicalPnl.reduce((sum, p) => sum + p.pnl, 0);

  // Calculate drawdown
  let peak = accountEquity;
  let maxDrawdown = 0;
  let currentEquity = accountEquity;

  for (const pnl of historicalPnl) {
    currentEquity += pnl.pnl;
    if (currentEquity > peak) {
      peak = currentEquity;
    }
    const drawdown = peak - currentEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const currentDrawdown = peak - currentEquity;

  // Calculate volatility (standard deviation of returns)
  const returns = historicalPnl.map(p => (p.pnl / accountEquity) * 100);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  return {
    totalPnl,
    totalPnlPct: accountEquity > 0 ? (totalPnl / accountEquity) * 100 : 0,
    dailyPnl,
    dailyPnlPct: accountEquity > 0 ? (dailyPnl / accountEquity) * 100 : 0,
    weeklyPnl,
    weeklyPnlPct: accountEquity > 0 ? (weeklyPnl / accountEquity) * 100 : 0,
    monthlyPnl,
    monthlyPnlPct: accountEquity > 0 ? (monthlyPnl / accountEquity) * 100 : 0,
    maxDrawdown,
    maxDrawdownPct: accountEquity > 0 ? (maxDrawdown / accountEquity) * 100 : 0,
    currentDrawdown,
    currentDrawdownPct: accountEquity > 0 ? (currentDrawdown / accountEquity) * 100 : 0,
    openPositionsCount: openPositions.length,
    totalMarginUsed,
    marginUsagePct,
    largestPositionSize,
    volatility
  };
}
