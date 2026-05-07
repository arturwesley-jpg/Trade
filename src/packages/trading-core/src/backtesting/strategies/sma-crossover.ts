/**
 * Simple Moving Average Crossover Strategy
 * Generates buy signals when fast MA crosses above slow MA
 * Generates sell signals when fast MA crosses below slow MA
 */

import type { Candle } from "../historical-data-fetcher.js";
import { BaseStrategy, type StrategyContext, type TradingSignal, type StrategyFactory } from "../strategy-interface.js";

export interface SMACrossoverParams {
  fastPeriod: number;
  slowPeriod: number;
  useStopLoss: boolean;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export class SMACrossoverStrategy extends BaseStrategy {
  name = "SMA Crossover";
  description = "Simple Moving Average crossover strategy";

  private fastPeriod: number;
  private slowPeriod: number;
  private useStopLoss: boolean;
  private stopLossPercent: number;
  private takeProfitPercent: number;

  constructor(params: Partial<SMACrossoverParams> = {}) {
    super(params);
    this.fastPeriod = params.fastPeriod ?? 10;
    this.slowPeriod = params.slowPeriod ?? 20;
    this.useStopLoss = params.useStopLoss ?? true;
    this.stopLossPercent = params.stopLossPercent ?? 0.02;
    this.takeProfitPercent = params.takeProfitPercent ?? 0.04;
  }

  generateSignal(context: StrategyContext): TradingSignal | null {
    const { candles, currentIndex } = context;

    if (currentIndex < this.slowPeriod) {
      return null;
    }

    const fastSMA = this.calculateSMA(candles, currentIndex, this.fastPeriod);
    const slowSMA = this.calculateSMA(candles, currentIndex, this.slowPeriod);

    const prevFastSMA = this.calculateSMA(candles, currentIndex - 1, this.fastPeriod);
    const prevSlowSMA = this.calculateSMA(candles, currentIndex - 1, this.slowPeriod);

    // Bullish crossover
    if (prevFastSMA <= prevSlowSMA && fastSMA > slowSMA) {
      return {
        action: "BUY",
        confidence: 70,
        reasoning: `Fast SMA (${fastSMA.toFixed(2)}) crossed above Slow SMA (${slowSMA.toFixed(2)})`
      };
    }

    // Bearish crossover
    if (prevFastSMA >= prevSlowSMA && fastSMA < slowSMA) {
      return {
        action: "SELL",
        confidence: 70,
        reasoning: `Fast SMA (${fastSMA.toFixed(2)}) crossed below Slow SMA (${slowSMA.toFixed(2)})`
      };
    }

    return null;
  }

  calculateStopLoss(context: StrategyContext, signal: TradingSignal): number {
    if (!this.useStopLoss) {
      return 0;
    }
    const price = context.currentPrice;
    return signal.action === "BUY" ? price * (1 - this.stopLossPercent) : price * (1 + this.stopLossPercent);
  }

  calculateTakeProfit(context: StrategyContext, signal: TradingSignal): number {
    const price = context.currentPrice;
    return signal.action === "BUY" ? price * (1 + this.takeProfitPercent) : price * (1 - this.takeProfitPercent);
  }

  private calculateSMA(candles: Candle[], index: number, period: number): number {
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += candles[index - i].close;
    }
    return sum / period;
  }
}

export const SMACrossoverFactory: StrategyFactory = {
  create: (params) => new SMACrossoverStrategy(params),
  metadata: {
    name: "SMA Crossover",
    description: "Simple Moving Average crossover strategy for trend following",
    category: "trend",
    timeframes: ["1h", "4h", "1d"],
    requiredIndicators: ["SMA"],
    riskLevel: "medium"
  },
  defaultParameters: {
    fastPeriod: 10,
    slowPeriod: 20,
    useStopLoss: true,
    stopLossPercent: 0.02,
    takeProfitPercent: 0.04
  }
};
