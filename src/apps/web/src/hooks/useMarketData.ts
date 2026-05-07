import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket.js";
import type { MarketTick } from "../shared-types.js";

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
export function useMarketData(options: UseMarketDataOptions): UseMarketDataReturn {
  const { symbol, wsUrl, token, autoConnect = true, onUpdate, onError } = options;

  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { isConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe, error } = useWebSocket({
    url: wsUrl,
    token,
    autoConnect,
    onError
  });

  const handleMarketUpdate = useCallback((data: unknown) => {
    try {
      const tickerData = data as any;

      // Handle different message formats
      let marketUpdate: MarketData;

      if (tickerData.type === "market_tick" || tickerData.type === "ticker") {
        const tick = tickerData.data || tickerData;
        marketUpdate = {
          symbol: tick.symbol,
          price: tick.price,
          volume24h: tick.volume24h,
          change24h: tick.change24h,
          change24hPct: tick.change24hPct,
          high24h: tick.high24h,
          low24h: tick.low24h,
          timestamp: tick.timestamp || Date.now(),
          source: tick.source
        };
      } else {
        // Direct market data format
        marketUpdate = {
          symbol: tickerData.symbol,
          price: tickerData.price,
          volume24h: tickerData.volume24h,
          change24h: tickerData.change24h,
          change24hPct: tickerData.change24hPct,
          high24h: tickerData.high24h,
          low24h: tickerData.low24h,
          timestamp: tickerData.timestamp || Date.now(),
          source: tickerData.source
        };
      }

      setMarketData(marketUpdate);
      setLastUpdate(new Date());
      setIsLoading(false);
      onUpdate?.(marketUpdate);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to parse market data");
      console.error("[useMarketData] Parse error:", error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  const subscribe = useCallback(() => {
    if (!isConnected) return;

    const channel = `market:${symbol}`;
    wsSubscribe(channel, handleMarketUpdate);
    console.log(`[useMarketData] Subscribed to ${channel}`);
  }, [isConnected, symbol, wsSubscribe, handleMarketUpdate]);

  const unsubscribe = useCallback(() => {
    const channel = `market:${symbol}`;
    wsUnsubscribe(channel, handleMarketUpdate);
    console.log(`[useMarketData] Unsubscribed from ${channel}`);
  }, [symbol, wsUnsubscribe, handleMarketUpdate]);

  useEffect(() => {
    if (isConnected && autoConnect) {
      subscribe();
    }

    return () => {
      if (isConnected) {
        unsubscribe();
      }
    };
  }, [isConnected, autoConnect, subscribe, unsubscribe]);

  return {
    marketData,
    isConnected,
    isLoading: isLoading && isConnected,
    error,
    lastUpdate,
    subscribe,
    unsubscribe
  };
}
