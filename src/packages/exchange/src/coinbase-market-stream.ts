import WebSocket from "ws";
import type { MarketTick } from "@trade/shared";
import { buildCoinbaseSubscription, normalizeCoinbaseMessage } from "./coinbase-normalizer.js";

export interface CoinbaseMarketStreamOptions {
  url: string;
  symbols: string[];
  onTick: (tick: MarketTick) => void;
  onStatus?: (message: string) => void;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export class CoinbaseMarketStream {
  private socket?: WebSocket;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private intentionallyClosed = false;

  constructor(private readonly options: CoinbaseMarketStreamOptions) {
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 30000;
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.socket = new WebSocket(this.options.url);

    this.socket.on("open", () => {
      this.reconnectAttempts = 0;
      this.options.onStatus?.(`connected:${this.options.url}`);
      this.socket?.send(JSON.stringify(buildCoinbaseSubscription(this.options.symbols)));
    });

    this.socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString("utf8"));
        const tick = normalizeCoinbaseMessage(message);
        if (tick) this.options.onTick(tick);
      } catch (error) {
        this.options.onStatus?.(`parse-error:${error instanceof Error ? error.message : "unknown"}`);
      }
    });

    this.socket.on("close", () => {
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );

    this.reconnectAttempts++;
    this.options.onStatus?.(`reconnecting-in:${delay}ms`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
