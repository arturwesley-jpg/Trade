import type { Candle } from "@trade/trading-core";
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
export interface MarketDataWebSocketOptions {
    url: string;
    onCandle?: (candle: Candle) => void;
    onError?: (error: Error) => void;
    onStateChange?: (state: ConnectionState) => void;
}
export declare class MarketDataWebSocket {
    private ws;
    private url;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectTimeoutId;
    private state;
    private shouldReconnect;
    private onCandle?;
    private onError?;
    private onStateChange?;
    constructor(options: MarketDataWebSocketOptions);
    connect(): void;
    disconnect(): void;
    getState(): ConnectionState;
    private setState;
    private scheduleReconnect;
}
