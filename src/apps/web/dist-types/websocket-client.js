import { useEffect, useRef, useState } from "react";
export function useWebSocket(options) {
    const { url, reconnectInterval = 3000, maxReconnectAttempts = 10, onMarketTick, onSignalUpdate, onPositionUpdate, onConnectionChange } = options;
    const [status, setStatus] = useState("connecting");
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const shouldConnectRef = useRef(true);
    const updateStatus = (newStatus) => {
        setStatus(newStatus);
        onConnectionChange?.(newStatus);
    };
    const connect = () => {
        if (!shouldConnectRef.current)
            return;
        try {
            updateStatus("connecting");
            const ws = new WebSocket(url);
            wsRef.current = ws;
            ws.onopen = () => {
                console.log("[WebSocket] Connected to", url);
                reconnectAttemptsRef.current = 0;
                updateStatus("connected");
            };
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    switch (message.type) {
                        case "connection_ack":
                            console.log("[WebSocket] Connection acknowledged:", message.data);
                            break;
                        case "market_tick":
                            onMarketTick?.(message.data);
                            break;
                        case "signal_update":
                            onSignalUpdate?.(message.data);
                            break;
                        case "position_update":
                            onPositionUpdate?.(message.data);
                            break;
                        default:
                            console.warn("[WebSocket] Unknown message type:", message);
                    }
                }
                catch (error) {
                    console.error("[WebSocket] Failed to parse message:", error);
                }
            };
            ws.onerror = (error) => {
                console.error("[WebSocket] Error:", error);
                updateStatus("error");
            };
            ws.onclose = () => {
                console.log("[WebSocket] Connection closed");
                wsRef.current = null;
                if (shouldConnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    updateStatus("disconnected");
                    reconnectAttemptsRef.current++;
                    console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
                    reconnectTimeoutRef.current = window.setTimeout(() => {
                        connect();
                    }, reconnectInterval);
                }
                else {
                    updateStatus("disconnected");
                }
            };
        }
        catch (error) {
            console.error("[WebSocket] Failed to connect:", error);
            updateStatus("error");
        }
    };
    const disconnect = () => {
        shouldConnectRef.current = false;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        updateStatus("disconnected");
    };
    useEffect(() => {
        shouldConnectRef.current = true;
        connect();
        return () => {
            disconnect();
        };
    }, [url]);
    return {
        status,
        isConnected: status === "connected",
        disconnect
    };
}
