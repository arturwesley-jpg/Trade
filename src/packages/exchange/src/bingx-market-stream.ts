import { gunzipSync } from "node:zlib";
import WebSocket from "ws";
import type { MarketTick } from "@trade/shared";
import { buildBingXSubscription, normalizeBingXMessage, type BingXChannel } from "./bingx-normalizer.js";

export interface BingXMarketStreamOptions {
  url: string;
  symbols: string[];
  channels?: BingXChannel[];
  onTick: (tick: MarketTick) => void;
  onStatus?: (message: string) => void;
}

export class BingXMarketStream {
  private socket?: WebSocket;

  constructor(private readonly options: BingXMarketStreamOptions) {}

  connect(): void {
    this.socket = new WebSocket(this.options.url);
    const channels = this.options.channels ?? ["ticker"];

    this.socket.on("open", () => {
      this.options.onStatus?.(`connected:${this.options.url}`);
      for (const symbol of this.options.symbols) {
        for (const channel of channels) {
          this.socket?.send(JSON.stringify(buildBingXSubscription(symbol, channel)));
        }
      }
    });

    this.socket.on("message", (raw) => {
      const message = decodeMessage(raw);
      if (message && typeof message === "object" && "ping" in message) {
        this.socket?.send(JSON.stringify({ pong: (message as { ping: unknown }).ping }));
        return;
      }
      const tick = normalizeBingXMessage(message);
      if (tick) this.options.onTick(tick);
    });

    this.socket.on("close", () => this.options.onStatus?.("closed"));
    this.socket.on("error", (error) => this.options.onStatus?.(`error:${error.message}`));
  }

  close(): void {
    this.socket?.close();
  }
}

function decodeMessage(raw: WebSocket.RawData): unknown {
  const buffer = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw as Buffer);
  const text = tryGunzip(buffer) ?? buffer.toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryGunzip(buffer: Buffer): string | null {
  try {
    return gunzipSync(buffer).toString("utf8");
  } catch {
    return null;
  }
}
