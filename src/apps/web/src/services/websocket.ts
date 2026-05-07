import type { Candle } from "@trade/trading-core";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface MarketDataWebSocketOptions {
  url: string;
  onCandle?: (candle: Candle) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export class MarketDataWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeoutId: number | null = null;
  private state: ConnectionState = "disconnected";
  private shouldReconnect = false;

  private onCandle?: (candle: Candle) => void;
  private onError?: (error: Error) => void;
  private onStateChange?: (state: ConnectionState) => void;

  constructor(options: MarketDataWebSocketOptions) {
    this.url = options.url;
    this.onCandle = options.onCandle;
    this.onError = options.onError;
    this.onStateChange = options.onStateChange;
  }

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    this.setState("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[MarketDataWebSocket] Connected to", this.url);
        this.reconnectAttempts = 0;
        this.setState("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "candle" && message.data) {
            this.onCandle?.(message.data);
          }
        } catch (error) {
          const parseError = error instanceof Error ? error : new Error("Failed to parse candle data");
          console.error("[MarketDataWebSocket] Parse error:", parseError);
          this.onError?.(parseError);
        }
      };

      this.ws.onerror = (event) => {
        const error = new Error("WebSocket error occurred");
        console.error("[MarketDataWebSocket] Error:", event);
        this.setState("error");
        this.onError?.(error);
      };

      this.ws.onclose = (event) => {
        console.log("[MarketDataWebSocket] Closed:", event.code, event.reason);
        this.ws = null;

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error("[MarketDataWebSocket] Max reconnection attempts reached");
          this.setState("error");
          this.onError?.(new Error("Max reconnection attempts reached"));
        } else {
          this.setState("disconnected");
        }
      };
    } catch (error) {
      const connectionError = error instanceof Error ? error : new Error("Failed to create WebSocket");
      console.error("[MarketDataWebSocket] Connection error:", connectionError);
      this.setState("error");
      this.onError?.(connectionError);
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.setState("disconnected");
  }

  public getState(): ConnectionState {
    return this.state;
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  private scheduleReconnect(): void {
    this.setState("reconnecting");
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s)
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    const delay = Math.min(exponentialDelay, 30000);

    console.log(
      `[MarketDataWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeoutId = window.setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect();
    }, delay);
  }
}
