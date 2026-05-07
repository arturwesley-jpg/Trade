import type { MarketTick, Position, TradingSignal } from "./shared-types.js";
export interface WebSocketMessage {
    type: "market_tick" | "signal_update" | "position_update" | "connection_ack";
    data: unknown;
    timestamp: number;
}
export type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error";
export interface UseWebSocketOptions {
    url: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    onMarketTick?: (tick: MarketTick) => void;
    onSignalUpdate?: (signal: TradingSignal) => void;
    onPositionUpdate?: (position: Position) => void;
    onConnectionChange?: (status: WebSocketStatus) => void;
}
export declare function useWebSocket(options: UseWebSocketOptions): {
    status: WebSocketStatus;
    isConnected: boolean;
    disconnect: () => void;
};
