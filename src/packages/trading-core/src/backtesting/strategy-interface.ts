/**
 * Strategy Interface
 * Defines the contract for trading strategies used in backtesting
 */

import type { Candle } from "./historical-data-fetcher.js";

export interface TradingSignal {
  action: "BUY" | "SELL" | "HOLD" | "CLOSE";
  confidence: number; // 0-100
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number; // Percentage of capital (0-1)
  reasoning: string;
}

export interface StrategyContext {
  candles: Candle[];
  currentIndex: number;
  currentPrice: number;
  capital: number;
  position: {
    side: "long" | "short" | null;
    entryPrice: number;
    size: number;
  } | null;
  indicators: Record<string, any>;
}

export interface TradingStrategy {
  name: string;
  description: string;
  parameters: Record<string, any>;

  /**
   * Initialize strategy with historical data
   * Called once before backtesting starts
   */
  initialize?(candles: Candle[]): void | Promise<void>;

  /**
   * Generate trading signal based on current market state
   */
  generateSignal(context: StrategyContext): TradingSignal | null;

  /**
   * Calculate position size based on risk management rules
   */
  calculatePositionSize?(context: StrategyContext, signal: TradingSignal): number;

  /**
   * Determine stop loss level
   */
  calculateStopLoss?(context: StrategyContext, signal: TradingSignal): number;

  /**
   * Determine take profit level
   */
  calculateTakeProfit?(context: StrategyContext, signal: TradingSignal): number;

  /**
   * Called when a trade is executed
   */
  onTradeExecuted?(trade: {
    side: "BUY" | "SELL";
    price: number;
    size: number;
    timestamp: number;
  }): void;

  /**
   * Called when a position is closed
   */
  onPositionClosed?(result: {
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    reason: string;
  }): void;
}

export interface StrategyMetadata {
  name: string;
  description: string;
  author?: string;
  version?: string;
  category?: "trend" | "momentum" | "mean-reversion" | "breakout" | "arbitrage" | "custom";
  timeframes?: string[];
  requiredIndicators?: string[];
  riskLevel?: "low" | "medium" | "high";
}

export interface StrategyFactory {
  create(parameters: Record<string, any>): TradingStrategy;
  metadata: StrategyMetadata;
  defaultParameters: Record<string, any>;
}

/**
 * Base Strategy Class
 * Provides common functionality for all strategies
 */
export abstract class BaseStrategy implements TradingStrategy {
  abstract name: string;
  abstract description: string;

  constructor(public parameters: Record<string, any> = {}) {}

  abstract generateSignal(context: StrategyContext): TradingSignal | null;

  initialize?(candles: Candle[]): void | Promise<void> {
    // Optional initialization
  }

  calculatePositionSize(context: StrategyContext, signal: TradingSignal): number {
    // Default: use signal's position size or 95% of capital
    return signal.positionSize ?? 0.95;
  }

  calculateStopLoss(context: StrategyContext, signal: TradingSignal): number {
    // Default: 2% stop loss
    const price = signal.price ?? context.currentPrice;
    return signal.action === "BUY" ? price * 0.98 : price * 1.02;
  }

  calculateTakeProfit(context: StrategyContext, signal: TradingSignal): number {
    // Default: 4% take profit
    const price = signal.price ?? context.currentPrice;
    return signal.action === "BUY" ? price * 1.04 : price * 0.96;
  }

  onTradeExecuted?(trade: any): void {
    // Optional callback
  }

  onPositionClosed?(result: any): void {
    // Optional callback
  }
}
