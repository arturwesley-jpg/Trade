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
export declare function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn;
