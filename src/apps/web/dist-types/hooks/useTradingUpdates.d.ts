import type { Position, TradingSignal } from "../shared-types.js";
export interface TradingUpdate {
    type: "trade_executed" | "position_opened" | "position_updated" | "position_closed" | "signal_update" | "portfolio_updated";
    timestamp: number;
    trade?: any;
    position?: Position;
    signal?: TradingSignal;
    portfolio?: any;
}
export interface UseTradingUpdatesOptions {
    userId?: string;
    wsUrl: string;
    token?: string;
    autoConnect?: boolean;
    maxUpdates?: number;
    onPositionUpdate?: (position: Position) => void;
    onSignalUpdate?: (signal: TradingSignal) => void;
    onTradeExecuted?: (trade: any) => void;
    onError?: (error: Error) => void;
}
export interface UseTradingUpdatesReturn {
    updates: TradingUpdate[];
    positions: Position[];
    signals: TradingSignal[];
    isConnected: boolean;
    error: Error | null;
    clearUpdates: () => void;
    getLatestUpdate: (type: TradingUpdate["type"]) => TradingUpdate | null;
}
/**
 * Hook for subscribing to real-time trading updates (positions, signals, trades)
 *
 * Features:
 * - Automatic subscription to multiple channels
 * - Separate state for positions and signals
 * - Update history with configurable limit
 * - Type-specific callbacks
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * const { positions, signals, updates } = useTradingUpdates({
 *   userId: 'user-123',
 *   wsUrl: 'ws://localhost:3000/ws',
 *   token: 'auth-token',
 *   onPositionUpdate: (pos) => console.log('Position updated:', pos)
 * });
 * ```
 */
export declare function useTradingUpdates(options: UseTradingUpdatesOptions): UseTradingUpdatesReturn;
