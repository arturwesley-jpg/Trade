import WebSocket from "ws";
import type { MarketTick } from "@trade/shared";
import { normalizeKrakenMessage, buildKrakenSubscription } from "./kraken-normalizer.js";

export interface KrakenMarketStreamOptions {
  url: string;
  symbols: string[];
  onTick: (tick: MarketTick) => void;
  onStatus?: (message: string) => void;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export class KrakenMarketStream {
  private socket?: WebSocket;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private intentionallyClosed = false;

  constructor(private readonly options: KrakenMarketStreamOptions) {
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 30000;
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.socket = new WebSocket(this.options.url);

    this.socket.on("open", () => {
      this.reconnectAttempts = 0;
      this.options.onStatus?.(`connected:${this.options.url}`);

      const subscription = buildKrakenSubscription(this.options.symbols);
      this.socket?.send(JSON.stringify(subscription));

      // Kraken requires ping to keep connection alive
      this.startPingInterval();
    });

    this.socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString("utf8"));

        // Handle pong response
        if (isRecord(message) && message.event === "pong") {
          return;
        }

        const tick = normalizeKrakenMessage(message);
        if (tick) this.options.onTick(tick);
      } catch (error) {
        this.options.onStatus?.(`parse-error:${error instanceof Error ? error.message : "unknown"}`);
      }
    });

    this.socket.on("close", () => {
      this.stopPingInterval();
      this.options.onStatus?.("closed");
      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.socket.on("error", (error) => {
      this.options.onStatus?.(`error:${error.message}`);
    });
  }

  close(): void {
    this.intentionallyClosed = true;
    this.stopPingInterval();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
  }

  private startPingInterval(): void {
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ event: "ping" }));
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );

    this.reconnectAttempts++;
    this.options.onStatus?.(`reconnecting-in:${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
