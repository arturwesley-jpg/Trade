import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket.js";
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
export function useTradingUpdates(options) {
    const { userId, wsUrl, token, autoConnect = true, maxUpdates = 100, onPositionUpdate, onSignalUpdate, onTradeExecuted, onError } = options;
    const [updates, setUpdates] = useState([]);
    const [positions, setPositions] = useState([]);
    const [signals, setSignals] = useState([]);
    const callbacksRef = useRef(new Map());
    const { isConnected, subscribe, unsubscribe, error } = useWebSocket({
        url: wsUrl,
        token,
        autoConnect,
        onError
    });
    const handleUpdate = useCallback((type, data) => {
        const update = {
            type,
            timestamp: Date.now(),
            ...data
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
                        const filtered = prev.filter((p) => p.id !== update.position.id);
                        return [...filtered, update.position];
                    });
                    onPositionUpdate?.(update.position);
                }
                break;
            case "position_closed":
                if (update.position) {
                    setPositions((prev) => prev.filter((p) => p.id !== update.position.id));
                    onPositionUpdate?.(update.position);
                }
                break;
            case "signal_update":
                if (update.signal) {
                    setSignals((prev) => {
                        const filtered = prev.filter((s) => s.symbol !== update.signal.symbol);
                        return [...filtered, update.signal];
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
        if (!isConnected)
            return;
        const channels = [];
        // Subscribe to user-specific channels if userId provided
        if (userId) {
            channels.push(`trades:${userId}`, `positions:${userId}`, `portfolio:${userId}`);
        }
        // Subscribe to global channels
        channels.push("signals", "positions");
        channels.forEach((channel) => {
            const callback = (data) => {
                try {
                    const message = data;
                    // Determine update type from message
                    let updateType;
                    if (message.type === "position_update") {
                        updateType = message.data?.status === "OPEN" ? "position_opened" : "position_closed";
                    }
                    else if (message.type === "signal_update") {
                        updateType = "signal_update";
                    }
                    else if (message.type === "trade_executed") {
                        updateType = "trade_executed";
                    }
                    else {
                        updateType = message.type;
                    }
                    handleUpdate(updateType, message.data || message);
                }
                catch (err) {
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
    const getLatestUpdate = useCallback((type) => {
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
