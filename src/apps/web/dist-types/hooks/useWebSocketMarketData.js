/**
 * WebSocket Market Data Hook
 * Provides real-time market data updates via WebSocket connection
 */
import { useEffect, useState, useCallback, useRef } from "react";
export function useWebSocketMarketData({ symbol, interval = "1m", autoConnect = true, onMessage, onError }) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const [error, setError] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }
        try {
            // Use Binance WebSocket for demo (replace with your own WebSocket server)
            const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
            const ws = new WebSocket(wsUrl);
            ws.onopen = () => {
                console.log("WebSocket connected");
                setIsConnected(true);
                setError(null);
                reconnectAttemptsRef.current = 0;
            };
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Transform Binance data to our format
                    const message = {
                        type: "candle",
                        data: {
                            timestamp: data.k?.t || Date.now(),
                            open: parseFloat(data.k?.o || "0"),
                            high: parseFloat(data.k?.h || "0"),
                            low: parseFloat(data.k?.l || "0"),
                            close: parseFloat(data.k?.c || "0"),
                            volume: parseFloat(data.k?.v || "0")
                        }
                    };
                    setLastMessage(message);
                    onMessage?.(message);
                }
                catch (err) {
                    console.error("Failed to parse WebSocket message:", err);
                }
            };
            ws.onerror = (event) => {
                const err = new Error("WebSocket error");
                console.error("WebSocket error:", event);
                setError(err);
                onError?.(err);
            };
            ws.onclose = () => {
                console.log("WebSocket disconnected");
                setIsConnected(false);
                wsRef.current = null;
                // Attempt reconnection
                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    reconnectAttemptsRef.current++;
                    console.log(`Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, reconnectDelay);
                }
                else {
                    const err = new Error("Max reconnection attempts reached");
                    setError(err);
                    onError?.(err);
                }
            };
            wsRef.current = ws;
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error("Failed to connect");
            setError(error);
            onError?.(error);
        }
    }, [symbol, interval, onMessage, onError]);
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);
    const subscribe = useCallback((channel) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                method: "SUBSCRIBE",
                params: [channel],
                id: Date.now()
            }));
        }
    }, []);
    const unsubscribe = useCallback((channel) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                method: "UNSUBSCRIBE",
                params: [channel],
                id: Date.now()
            }));
        }
    }, []);
    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);
    return {
        isConnected,
        lastMessage,
        error,
        connect,
        disconnect,
        subscribe,
        unsubscribe
    };
}
