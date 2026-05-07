import type { MarketTick } from "@trade/shared";
import type { MarketDataProvider } from "./market-data-provider.js";

export interface OKXTickerProviderOptions {
  baseUrl?: string;
  fetch?: (url: string) => Promise<{
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
  }>;
}

export class OKXTickerProvider implements MarketDataProvider {
  readonly name = "okx";
  private readonly baseUrl: string;
  private readonly fetchFn: NonNullable<OKXTickerProviderOptions["fetch"]>;

  constructor(options: OKXTickerProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://www.okx.com";
    this.fetchFn = options.fetch ?? fetch;
  }

  async getTick(symbol: string): Promise<MarketTick> {
    const okxSymbol = toOKXSymbol(symbol);
    const response = await this.fetchFn(
      `${this.baseUrl}/api/v5/market/ticker?instId=${encodeURIComponent(okxSymbol)}`
    );
    if (!response.ok) {
      throw new Error(`OKX ticker request failed for ${symbol}: HTTP ${response.status ?? "unknown"}`);
    }

    const payload = await response.json();
    if (isRecord(payload) && payload.code !== "0") {
      throw new Error(`OKX ticker request failed for ${symbol}: ${String(payload.msg ?? "unknown error")}`);
    }
    const tick = normalizeOKXTicker(symbol, payload);
    if (!tick) throw new Error(`Invalid OKX ticker payload for ${symbol}`);
    return tick;
  }
}

export function normalizeOKXTicker(symbol: string, payload: unknown): MarketTick | null {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return null;
  const first = payload.data[0];
  if (!isRecord(first)) return null;

  const price = parseNumber(first.last);
  const open24h = parseNumber(first.open24h);
  const volume24h = parseNumber(first.vol24h);
  const timestamp = parseNumber(first.ts);
  if (price === undefined || timestamp === undefined) return null;

  const change24hPct = open24h !== undefined && open24h !== 0
    ? roundPercent(((price - open24h) / open24h) * 100)
    : undefined;

  return {
    symbol,
    price,
    change24hPct,
    volume24h,
    timestamp,
    source: "okx"
  };
}

function toOKXSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeOKXInstrument(symbol: string): string {
  return symbol.replace("/", "-").toUpperCase();
}

// WebSocket message normalizer
export function normalizeOKXMessage(message: unknown): MarketTick | null {
  if (!isRecord(message) || !isRecord(message.data)) {
    return null;
  }

  const data = message.data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  if (!isRecord(first)) {
    return null;
  }

  const instId = first.instId;
  const last = parseNumber(first.last);
  const vol24h = parseNumber(first.vol24h);
  const high24h = parseNumber(first.high24h);
  const low24h = parseNumber(first.low24h);
  const ts = parseNumber(first.ts);

  if (typeof instId !== "string" || last === undefined || ts === undefined) {
    return null;
  }

  return {
    exchange: "okx",
    symbol: normalizeOKXInstrument(instId),
    price: last,
    volume: vol24h,
    high: high24h,
    low: low24h,
    timestamp: ts,
    source: "okx"
  };
}

// Build OKX WebSocket subscription message
export function buildOKXSubscription(symbols: string[]): Record<string, unknown> {
  return {
    op: "subscribe",
    args: symbols.map((symbol) => ({
      channel: "tickers",
      instId: symbol,
    })),
  };
}
