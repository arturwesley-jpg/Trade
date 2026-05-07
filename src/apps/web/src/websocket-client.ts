import { useEffect, useRef, useState } from "react";
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

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onMarketTick,
    onSignalUpdate,
    onPositionUpdate,
    onConnectionChange
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldConnectRef = useRef(true);

  const updateStatus = (newStatus: WebSocketStatus) => {
    setStatus(newStatus);
    onConnectionChange?.(newStatus);
  };

  const connect = () => {
    if (!shouldConnectRef.current) return;

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
          const message = JSON.parse(event.data) as WebSocketMessage;

          switch (message.type) {
            case "connection_ack":
              console.log("[WebSocket] Connection acknowledged:", message.data);
              break;
            case "market_tick":
              onMarketTick?.(message.data as MarketTick);
              break;
            case "signal_update":
              onSignalUpdate?.(message.data as TradingSignal);
              break;
            case "position_update":
              onPositionUpdate?.(message.data as Position);
              break;
            default:
              console.warn("[WebSocket] Unknown message type:", message);
          }
        } catch (error) {
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
          console.log(
            `[WebSocket] Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          updateStatus("disconnected");
        }
      };
    } catch (error) {
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
