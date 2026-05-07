/**
 * MACD Strategy
 * Generates signals based on MACD line and signal line crossovers
 */

import type { Candle } from "../historical-data-fetcher.js";
import { BaseStrategy, type StrategyContext, type TradingSignal, type StrategyFactory } from "../strategy-interface.js";

export interface MACDStrategyParams {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export class MACDStrategy extends BaseStrategy {
  name = "MACD Crossover";
  description = "MACD line and signal line crossover strategy";

  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;
  private stopLossPercent: number;
  private takeProfitPercent: number;

  constructor(params: Partial<MACDStrategyParams> = {}) {
    super(params);
    this.fastPeriod = params.fastPeriod ?? 12;
    this.slowPeriod = params.slowPeriod ?? 26;
    this.signalPeriod = params.signalPeriod ?? 9;
    this.stopLossPercent = params.stopLossPercent ?? 0.025;
    this.takeProfitPercent = params.takeProfitPercent ?? 0.045;
  }

  generateSignal(context: StrategyContext): TradingSignal | null {
    const { candles, currentIndex } = context;

    const minLength = this.slowPeriod + this.signalPeriod;
    if (currentIndex < minLength) {
      return null;
    }

    const macdData = this.calculateMACD(candles, currentIndex);
    const prevMACDData = this.calculateMACD(candles, currentIndex - 1);

    if (!macdData || !prevMACDData) {
      return null;
    }

    const { macd, signal, histogram } = macdData;
    const prevHistogram = prevMACDData.histogram;

    // Bullish crossover
    if (prevHistogram <= 0 && histogram > 0) {
      return {
        action: "BUY",
        confidence: Math.min(Math.abs(histogram) * 10, 100),
        reasoning: `MACD line crossed above signal line (histogram: ${histogram.toFixed(4)})`
      };
    }

    // Bearish crossover
    if (prevHistogram >= 0 && histogram < 0) {
      return {
        action: "SELL",
        confidence: Math.min(Math.abs(histogram) * 10, 100),
        reasoning: `MACD line crossed below signal line (histogram: ${histogram.toFixed(4)})`
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

  private calculateMACD(candles: Candle[], index: number): { macd: number; signal: number; histogram: number } | null {
    const prices = candles.slice(0, index + 1).map(c => c.close);

    const minLength = this.slowPeriod + this.signalPeriod;
    if (prices.length < minLength) {
      return null;
    }

    const fastEMA = this.calculateEMA(prices, this.fastPeriod);
    const slowEMA = this.calculateEMA(prices, this.slowPeriod);

    const macdLine: number[] = [];
    const offset = this.slowPeriod - this.fastPeriod;

    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(fastEMA[i + offset] - slowEMA[i]);
    }

    const signalLine = this.calculateEMA(macdLine, this.signalPeriod);

    const macd = macdLine[macdLine.length - 1];
    const signal = signalLine[signalLine.length - 1];
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(sma);

    for (let i = period; i < prices.length; i++) {
      const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  }
}

export const MACDStrategyFactory: StrategyFactory = {
  create: (params) => new MACDStrategy(params),
  metadata: {
    name: "MACD Crossover",
    description: "Momentum strategy based on MACD line and signal line crossovers",
    category: "momentum",
    timeframes: ["1h", "4h", "1d"],
    requiredIndicators: ["MACD"],
    riskLevel: "medium"
  },
  defaultParameters: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    stopLossPercent: 0.025,
    takeProfitPercent: 0.045
  }
};
