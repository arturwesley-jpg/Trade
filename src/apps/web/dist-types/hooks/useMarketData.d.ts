export interface MarketData {
    symbol: string;
    price: number;
    volume24h?: number;
    change24h?: number;
    change24hPct?: number;
    high24h?: number;
    low24h?: number;
    timestamp: number;
    source?: string;
}
export interface UseMarketDataOptions {
    symbol: string;
    wsUrl: string;
    token?: string;
    autoConnect?: boolean;
    onUpdate?: (data: MarketData) => void;
    onError?: (error: Error) => void;
}
export interface UseMarketDataReturn {
    marketData: MarketData | null;
    isConnected: boolean;
    isLoading: boolean;
    error: Error | null;
    lastUpdate: Date | null;
    subscribe: () => void;
    unsubscribe: () => void;
}
/**
 * Hook for subscribing to real-time market data for a specific symbol
 *
 * Features:
 * - Automatic subscription management
 * - Real-time price updates
 * - Connection state tracking
 * - Error handling
 * - Last update timestamp
 *
 * @example
 * ```tsx
 * const { marketData, isConnected, lastUpdate } = useMarketData({
 *   symbol: 'BTCUSDT',
 *   wsUrl: 'ws://localhost:3000/ws',
 *   onUpdate: (data) => console.log('Price update:', data.price)
 * });
 * ```
 */
export declare function useMarketData(options: UseMarketDataOptions): UseMarketDataReturn;
