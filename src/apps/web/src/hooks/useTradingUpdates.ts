import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket.js";
import { API_WS_URL } from "../config/api";
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
  wsUrl?: string;
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
 * userId: 'user-123',
 * token: 'auth-token',
 * onPositionUpdate: (pos) => console.log('Position updated:', pos)
 * });
 * ```
 */
export function useTradingUpdates(options: UseTradingUpdatesOptions): UseTradingUpdatesReturn {
  const {
    userId,
    wsUrl = API_WS_URL,
    token,
    autoConnect = true,
    maxUpdates = 100,
    onPositionUpdate,
    onSignalUpdate,
    onTradeExecuted,
    onError
  } = options;

  const [updates, setUpdates] = useState<TradingUpdate[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const callbacksRef = useRef(new Map<string, (data: unknown) => void>());

  const { isConnected, subscribe, unsubscribe, error } = useWebSocket({
    url: wsUrl,
    token,
    autoConnect,
    onError
  });

  const handleUpdate = useCallback((type: TradingUpdate["type"], data: unknown) => {
    const update: TradingUpdate = {
      type,
      timestamp: Date.now(),
      ...(data as any)
    };

    setUpdates((prev) => {
      const newUpdates = [...prev, update];
      // Keep only the last maxUpdates
      return newUpdates.slice(-maxUpdates);
    });

    // Update specific state based on type
    switch (type) {
      case "position_opened":
      case "position_updated":
        if (update.position) {
          setPositions((prev) => {
            const filtered = prev.filter((p) => p.id !== update.position!.id);
            return [...filtered, update.position!];
          });
          onPositionUpdate?.(update.position);
        }
        break;

      case "position_closed":
        if (update.position) {
          setPositions((prev) => prev.filter((p) => p.id !== update.position!.id));
          onPositionUpdate?.(update.position);
        }
        break;

      case "signal_update":
        if (update.signal) {
          setSignals((prev) => {
            const filtered = prev.filter((s) => s.symbol !== update.signal!.symbol);
            return [...filtered, update.signal!];
          });
          onSignalUpdate?.(update.signal);
        }
        break;

      case "trade_executed":
        if (update.trade) {
          onTradeExecuted?.(update.trade);
        }
        break;
    }
  }, [maxUpdates, onPositionUpdate, onSignalUpdate, onTradeExecuted]);

  useEffect(() => {
    if (!isConnected) return;

    const channels: string[] = [];

    // Subscribe to user-specific channels if userId provided
    if (userId) {
      channels.push(
        `trades:${userId}`,
        `positions:${userId}`,
        `portfolio:${userId}`
      );
    }

    // Subscribe to global channels
    channels.push("signals", "positions");

    channels.forEach((channel) => {
      const callback = (data: unknown) => {
        try {
          const message = data as any;

          // Determine update type from message
          let updateType: TradingUpdate["type"];

          if (message.type === "position_update") {
            updateType = message.data?.status === "OPEN" ? "position_opened" : "position_closed";
          } else if (message.type === "signal_update") {
            updateType = "signal_update";
          } else if (message.type === "trade_executed") {
            updateType = "trade_executed";
          } else {
            updateType = message.type;
          }

          handleUpdate(updateType, message.data || message);
        } catch (err) {
          const error = err instanceof Error ? err : new Error("Failed to parse trading update");
          console.error("[useTradingUpdates] Parse error:", error);
          onError?.(error);
        }
      };

      callbacksRef.current.set(channel, callback);
      subscribe(channel, callback);
      console.log(`[useTradingUpdates] Subscribed to ${channel}`);
    });

    return () => {
      channels.forEach((channel) => {
        const callback = callbacksRef.current.get(channel);
        if (callback) {
          unsubscribe(channel, callback);
          callbacksRef.current.delete(channel);
          console.log(`[useTradingUpdates] Unsubscribed from ${channel}`);
        }
      });
    };
  }, [isConnected, userId, subscribe, unsubscribe, handleUpdate, onError]);

  const clearUpdates = useCallback(() => {
    setUpdates([]);
  }, []);

  const getLatestUpdate = useCallback((type: TradingUpdate["type"]) => {
    const filtered = updates.filter((u) => u.type === type);
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }, [updates]);

  return {
    updates,
    positions,
    signals,
    isConnected,
    error,
    clearUpdates,
    getLatestUpdate
  };
}
