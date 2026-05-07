import { type ReactNode } from "react";
import type { Candle, PerformanceMetrics, Backtest, BacktestParams } from "../types/trading.js";
/**
 * Trading signal interface
 */
interface Signal {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    timestamp: number;
    confidence: number;
}
/**
 * Trading position interface
 */
interface Position {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
}
/**
 * Trading context value interface
 * Provides global state and actions for trading data
 */
interface TradingContextValue {
    /** Real-time candle data */
    candles: Candle[];
    /** Current performance metrics */
    metrics: PerformanceMetrics | null;
    /** List of backtests */
    backtests: Backtest[];
    /** Trading signals */
    signals: Signal[];
    /** Open positions */
    positions: Position[];
    /** Loading state for async operations */
    isLoading: boolean;
    /** Error message if any operation fails */
    error: string | null;
    /** Refresh performance metrics from the API */
    refreshMetrics: () => Promise<void>;
    /** Load backtests from the API */
    loadBacktests: () => Promise<void>;
    /** Create a new backtest */
    createBacktest: (params: BacktestParams) => Promise<void>;
    /** Add a new candle to the state */
    addCandle: (candle: Candle) => void;
}
/**
 * TradingProvider component
 * Provides global trading state management for the application
 *
 * @param children - Child components that will have access to trading context
 */
export declare function TradingProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
/**
 * Hook to access trading context
 * Must be used within a TradingProvider
 *
 * @returns Trading context value with state and actions
 * @throws Error if used outside of TradingProvider
 */
export declare function useTrading(): TradingContextValue;
export {};
