import { useState, useEffect, useCallback, useRef } from "react";
import { WebSocketClient } from "@trade/shared/websocket-client";
import type { ConnectionState } from "@trade/shared/websocket-protocol";

export interface UseWebSocketOptions {
  url: string;
  token?: string;
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onReconnecting?: (attempt: number) => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  state: ConnectionState;
  error: Error | null;
  reconnectAttempts: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channel: string, callback: (data: unknown) => void) => void;
  unsubscribe: (channel: string, callback?: (data: unknown) => void) => void;
  client: WebSocketClient | null;
}

/**
 * Base WebSocket hook with automatic connection management and reconnection
 *
 * Features:
 * - Automatic connection on mount (configurable)
 * - Automatic reconnection with exponential backoff
 * - Subscription management with cleanup
 * - Connection state tracking
 * - Error handling
 *
 * @example
 * ```tsx
 * const { isConnected, subscribe, unsubscribe } = useWebSocket({
 *   url: 'ws://localhost:3000/ws',
 *   token: 'auth-token',
 *   autoConnect: true
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const clientRef = useRef<WebSocketClient | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const client = new WebSocketClient({
      url: options.url,
      token: options.token,
      autoReconnect: options.autoReconnect ?? true,
      reconnectInterval: options.reconnectInterval,
      maxReconnectAttempts: options.maxReconnectAttempts,
      heartbeatInterval: options.heartbeatInterval
    });

    client.on("connecting", () => {
      setIsConnecting(true);
      setIsConnected(false);
      setState("connecting");
      setError(null);
    });

    client.on("connected", () => {
      setIsConnecting(false);
      setIsConnected(true);
      setState("connected");
      setError(null);
      setReconnectAttempts(0);
      optionsRef.current.onConnected?.();
    });

    client.on("disconnected", () => {
      setIsConnecting(false);
      setIsConnected(false);
      setState("disconnected");
      optionsRef.current.onDisconnected?.();
    });

    client.on("error", (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsConnecting(false);
      setState("error");
      optionsRef.current.onError?.(error);
    });

    client.on("reconnecting", (attempt: number) => {
      setReconnectAttempts(attempt);
      optionsRef.current.onReconnecting?.(attempt);
    });

    clientRef.current = client;

    if (options.autoConnect !== false) {
      client.connect().catch((err) => {
        setError(err);
      });
    }

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [options.url, options.token, options.autoConnect, options.autoReconnect, options.reconnectInterval, options.maxReconnectAttempts, options.heartbeatInterval]);

  const connect = useCallback(() => {
    if (clientRef.current) {
      return clientRef.current.connect();
    }
    return Promise.reject(new Error("WebSocket client not initialized"));
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  const subscribe = useCallback((channel: string, callback: (data: unknown) => void) => {
    if (clientRef.current) {
      clientRef.current.subscribe(channel, callback);
    }
  }, []);

  const unsubscribe = useCallback((channel: string, callback?: (data: unknown) => void) => {
    if (clientRef.current) {
      clientRef.current.unsubscribe(channel, callback);
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    state,
    error,
    reconnectAttempts,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    client: clientRef.current
  };
}
