/**
 * Trading types for the web application
 * Re-exports and extends types from shared packages
 */
import type { Candle, PerformanceMetrics } from "@trade/trading-core";
import type { Backtest, BacktestWithMetrics, BacktestMetricsRecord, BacktestTrade, CreateBacktestRequest, BacktestListResponse } from "@trade/shared";
export type { Candle, PerformanceMetrics };
export type { Backtest, BacktestWithMetrics, BacktestMetricsRecord, BacktestTrade, CreateBacktestRequest, BacktestListResponse };
/**
 * Parameters for creating a new backtest
 */
export interface BacktestParams {
    /** Name of the backtest */
    name: string;
    /** Optional description */
    description?: string;
    /** Trading symbol (e.g., "BTCUSDT") */
    symbol: string;
    /** Start date in ISO format */
    startDate: string;
    /** End date in ISO format */
    endDate: string;
    /** Candle interval (e.g., "1h", "4h", "1d") */
    interval: string;
    /** Initial capital amount */
    initialCapital: number;
    /** Trading fee rate (e.g., 0.001 for 0.1%) */
    feeRate: number;
    /** Slippage rate (e.g., 0.0005 for 0.05%) */
    slippageRate: number;
    /** Name of the strategy to use */
    strategyName: string;
    /** Optional strategy description */
    strategyDescription?: string;
    /** Strategy-specific parameters */
    strategyParameters: Record<string, any>;
}
/**
 * Trading state interface
 */
export interface TradingState {
    /** Real-time candle data */
    candles: Candle[];
    /** Current performance metrics */
    metrics: PerformanceMetrics | null;
    /** List of backtests */
    backtests: Backtest[];
    /** Loading state for async operations */
    isLoading: boolean;
    /** Error message if any operation fails */
    error: string | null;
}
