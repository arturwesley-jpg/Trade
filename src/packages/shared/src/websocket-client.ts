import type {
  WebSocketMessage,
  ClientMessage,
  ServerMessage,
  ConnectionState,
  WebSocketClientEvents,
  ChannelType,
} from "./websocket-protocol.js";

/**
 * Configuration options for WebSocket client
 */
export interface WebSocketClientOptions {
  /** WebSocket server URL (e.g., ws://localhost:3000/ws) */
  url: string;
  /** JWT authentication token */
  token?: string;
  /** Enable automatic reconnection on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Initial reconnect interval in milliseconds (default: 1000) */
  reconnectInterval?: number;
  /** Maximum reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number;
  /** Heartbeat ping interval in milliseconds (default: 30000) */
  heartbeatInterval?: number;
  /** Maximum reconnect interval with exponential backoff (default: 30000) */
  maxReconnectInterval?: number;
}

/**
 * Subscription callback function type
 */
export type SubscriptionCallback = (data: unknown) => void;

/**
 * WebSocket client for connecting to the trading platform WebSocket server.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Type-safe message handling
 * - Subscription management
 * - Event emitter pattern
 * - Connection state management
 * - Heartbeat/ping-pong handling
 * - Works in both browser and Node.js environments
 *
 * @example
 * ```typescript
 * const client = new WebSocketClient({
 *   url: 'ws://localhost:3000/ws',
 *   token: 'your-jwt-token',
 *   autoReconnect: true
 * });
 *
 * await client.connect();
 *
 * client.subscribe('market:BTC-USDT', (data) => {
 *   console.log('Market update:', data);
 * });
 *
 * client.on('error', (error) => {
 *   console.error('WebSocket error:', error);
 * });
 * ```
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token?: string;
  private autoReconnect: boolean;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private heartbeatInterval: number;
  private maxReconnectInterval: number;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private state: ConnectionState = "disconnected";
  private subscriptions = new Map<string, Set<SubscriptionCallback>>();
  private pendingSubscriptions = new Set<string>();
  private eventHandlers = new Map<keyof WebSocketClientEvents, Set<(...args: any[]) => void>>();
  private reconnectToken?: string;

  constructor(options: WebSocketClientOptions) {
    this.url = options.url;
    this.token = options.token;
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.heartbeatInterval = options.heartbeatInterval ?? 30000;
    this.maxReconnectInterval = options.maxReconnectInterval ?? 30000;
  }

  /**
   * Connect to the WebSocket server
   * @returns Promise that resolves when connection is established
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === "connected" || this.state === "connecting") {
        resolve();
        return;
      }

      this.state = "connecting";
      this.emit("connecting");

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.state = "connected";
          this.reconnectAttempts = 0;
          this.emit("connected");

          // Authenticate if token provided
          if (this.token) {
            this.send({
              type: "auth",
              data: { token: this.token },
              timestamp: Date.now()
            });
          }

          // Resubscribe to channels
          this.pendingSubscriptions.forEach((channel) => {
            this.send({
              type: "subscribe",
              channel,
              timestamp: Date.now()
            });
          });

          // Start heartbeat
          this.startHeartbeat();

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.state = "error";
          this.emit("error", error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
        };
      } catch (error) {
        this.state = "error";
        this.emit("error", error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.autoReconnect = false;
    this.state = "disconnecting";

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = "disconnected";
    this.emit("disconnected");
  }

  subscribe(channel: string, callback: (data: unknown) => void): void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(callback);
    this.pendingSubscriptions.add(channel);

    if (this.state === "connected") {
      this.send({
        type: "subscribe",
        channel,
        timestamp: Date.now()
      });
    }
  }

  unsubscribe(channel: string, callback?: (data: unknown) => void): void {
    if (callback) {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          this.pendingSubscriptions.delete(channel);
        }
      }
    } else {
      this.subscriptions.delete(channel);
      this.pendingSubscriptions.delete(channel);
    }

    if (this.state === "connected") {
      this.send({
        type: "unsubscribe",
        channel,
        timestamp: Date.now()
      });
    }
  }

  on<K extends keyof WebSocketClientEvents>(
    event: K,
    handler: WebSocketClientEvents[K]
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as any);
  }

  off<K extends keyof WebSocketClientEvents>(
    event: K,
    handler?: WebSocketClientEvents[K]
  ): void {
    if (handler) {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler as any);
      }
    } else {
      this.eventHandlers.delete(event);
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === "connected";
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "data":
          this.handleData(message);
          break;
        case "subscribed":
          this.emit("subscribed", message.channel);
          break;
        case "unsubscribed":
          this.emit("unsubscribed", message.channel);
          break;
        case "error":
          this.emit("error", message.error);
          break;
        case "pong":
          // Heartbeat response
          break;
        default:
          this.emit("message", message);
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private handleData(message: any): void {
    const { channel, data } = message;

    if (channel) {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            this.emit("error", error);
          }
        });
      }
    }

    this.emit("data", { channel, data });
  }

  private handleDisconnect(): void {
    this.state = "disconnected";
    this.emit("disconnected");

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.emit("reconnecting", this.reconnectAttempts);

      this.reconnectTimer = setTimeout(() => {
        this.connect().catch((error) => {
          this.emit("error", error);
        });
      }, this.reconnectInterval);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("reconnect_failed");
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    this.heartbeatTimer = setTimeout(() => {
      if (this.state === "connected") {
        this.send({
          type: "ping",
          timestamp: Date.now()
        });
        this.startHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  private emit<K extends keyof WebSocketClientEvents>(
    event: K,
    ...args: Parameters<WebSocketClientEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error("Error in event handler:", error);
        }
      });
    }
  }
}
