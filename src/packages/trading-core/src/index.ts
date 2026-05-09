export * from "./paper-executor.js";
export * from "./intelligence-engines.js";
export * from "./postgres-migrations.js";
export * from "./postgres-repository.js";
export * from "./position-monitor.js";
export * from "./repository.js";
export * from "./risk-engine.js";
export * from "./signal-engine.js";
export * from "./signal-generator.js";
export * from "./data-providers/coingecko-provider.js";
export * from "./data-providers/rss-news-provider.js";
export * from "./data-providers/defillama-provider.js";
export * from "./metrics/time-series-analytics.js";
export * from "./metrics/risk-metrics.js";
export * from "./indicators/index.js";

// Export signals (excluding TradingSignal to avoid conflict with backtesting)
export { EnhancedSignalGenerator, EnhancedSignalService, SignalCache } from "./signals/index.js";
export type {
  SignalType,
  SignalStrength
} from "./signals/signal-types.js";

// Export backtesting (TradingSignal from here takes precedence)
export * from "./backtesting/index.js";

export * from "./paper-trading/index.js";

// Re-export specific types to avoid conflicts
export type { TradeMetrics, PerformanceMetrics } from "./metrics/metrics-calculator.js";
export type { AdvancedMetrics } from "./metrics/advanced-metrics.js";

// Type alias for PaperTradingEngine (PaperExecutor)
export { PaperExecutor as PaperTradingEngine } from "./paper-executor.js";
