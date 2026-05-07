/**
 * Strategy Registry
 * Central registry for all available trading strategies
 */

export * from "./sma-crossover.js";
export * from "./rsi-strategy.js";
export * from "./macd-strategy.js";

import { SMACrossoverFactory } from "./sma-crossover.js";
import { RSIStrategyFactory } from "./rsi-strategy.js";
import { MACDStrategyFactory } from "./macd-strategy.js";
import type { StrategyFactory } from "../strategy-interface.js";

export const STRATEGY_REGISTRY: Record<string, StrategyFactory> = {
  "sma-crossover": SMACrossoverFactory,
  "rsi-mean-reversion": RSIStrategyFactory,
  "macd-crossover": MACDStrategyFactory
};

export function getStrategy(name: string): StrategyFactory | undefined {
  return STRATEGY_REGISTRY[name];
}

export function listStrategies(): Array<{ name: string; metadata: any }> {
  return Object.entries(STRATEGY_REGISTRY).map(([name, factory]) => ({
    name,
    metadata: factory.metadata
  }));
}
