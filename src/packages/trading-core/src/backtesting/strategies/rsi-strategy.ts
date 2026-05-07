/**
 * RSI Mean Reversion Strategy
 * Buys when RSI is oversold and sells when RSI is overbought
 */

import type { Candle } from "../historical-data-fetcher.js";
import { BaseStrategy, type StrategyContext, type TradingSignal, type StrategyFactory } from "../strategy-interface.js";

export interface RSIStrategyParams {
  period: number;
  oversoldThreshold: number;
  overboughtThreshold: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export class RSIStrategy extends BaseStrategy {
  name = "RSI Mean Reversion";
  description = "RSI-based mean reversion strategy";

  private period: number;
  private oversoldThreshold: number;
  private overboughtThreshold: number;
  private stopLossPercent: number;
  private takeProfitPercent: number;

  constructor(params: Partial<RSIStrategyParams> = {}) {
    super(params);
    this.period = params.period ?? 14;
    this.oversoldThreshold = params.oversoldThreshold ?? 30;
    this.overboughtThreshold = params.overboughtThreshold ?? 70;
    this.stopLossPercent = params.stopLossPercent ?? 0.03;
    this.takeProfitPercent = params.takeProfitPercent ?? 0.05;
  }

  generateSignal(context: StrategyContext): TradingSignal | null {
    const { candles, currentIndex } = context;

    if (currentIndex < this.period + 1) {
      return null;
    }

    const rsi = this.calculateRSI(candles, currentIndex);

    // Oversold - buy signal
    if (rsi < this.oversoldThreshold) {
      return {
        action: "BUY",
        confidence: Math.min(((this.oversoldThreshold - rsi) / this.oversoldThreshold) * 100, 100),
        reasoning: `RSI is oversold at ${rsi.toFixed(2)} (threshold: ${this.oversoldThreshold})`
      };
    }

    // Overbought - sell signal
    if (rsi > this.overboughtThreshold) {
      return {
        action: "SELL",
        confidence: Math.min(((rsi - this.overboughtThreshold) / (100 - this.overboughtThreshold)) * 100, 100),
        reasoning: `RSI is overbought at ${rsi.toFixed(2)} (threshold: ${this.overboughtThreshold})`
      };
    }

    return null;
  }

  calculateStopLoss(context: StrategyContext, signal: TradingSignal): number {
    const price = context.currentPrice;
    return signal.action === "BUY" ? price * (1 - this.stopLossPercent) : price * (1 + this.stopLossPercent);
  }

  calculateTakeProfit(context: StrategyContext, signal: TradingSignal): number {
    const price = context.currentPrice;
    return signal.action === "BUY" ? price * (1 + this.takeProfitPercent) : price * (1 - this.takeProfitPercent);
  }

  private calculateRSI(candles: Candle[], index: number): number {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= this.period; i++) {
      const change = candles[index - i + 1].close - candles[index - i].close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / this.period;
    const avgLoss = losses / this.period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
}

export const RSIStrategyFactory: StrategyFactory = {
  create: (params) => new RSIStrategy(params),
  metadata: {
    name: "RSI Mean Reversion",
    description: "Mean reversion strategy based on RSI overbought/oversold levels",
    category: "mean-reversion",
    timeframes: ["15m", "1h", "4h"],
    requiredIndicators: ["RSI"],
    riskLevel: "medium"
  },
  defaultParameters: {
    period: 14,
    oversoldThreshold: 30,
    overboughtThreshold: 70,
    stopLossPercent: 0.03,
    takeProfitPercent: 0.05
  }
};
