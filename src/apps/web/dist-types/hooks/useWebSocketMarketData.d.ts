/**
 * WebSocket Market Data Hook
 * Provides real-time market data updates via WebSocket connection
 */
interface MarketDataMessage {
    type: "candle" | "ticker" | "orderbook" | "trades";
    data: any;
}
interface UseWebSocketMarketDataOptions {
    symbol: string;
    interval?: string;
    autoConnect?: boolean;
    onMessage?: (message: MarketDataMessage) => void;
    onError?: (error: Error) => void;
}
interface UseWebSocketMarketDataReturn {
    isConnected: boolean;
    lastMessage: MarketDataMessage | null;
    error: Error | null;
    connect: () => void;
    disconnect: () => void;
    subscribe: (channel: string) => void;
    unsubscribe: (channel: string) => void;
}
export declare function useWebSocketMarketData({ symbol, interval, autoConnect, onMessage, onError }: UseWebSocketMarketDataOptions): UseWebSocketMarketDataReturn;
export {};
