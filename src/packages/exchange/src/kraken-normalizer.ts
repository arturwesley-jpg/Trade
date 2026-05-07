import type { MarketTick } from "@trade/shared";
import type { MarketDataProvider } from "./market-data-provider.js";

export interface KrakenTickerProviderOptions {
  baseUrl?: string;
  fetch?: (url: string) => Promise<{
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
  }>;
}

export class KrakenTickerProvider implements MarketDataProvider {
  readonly name = "kraken";
  private readonly baseUrl: string;
  private readonly fetchFn: NonNullable<KrakenTickerProviderOptions["fetch"]>;

  constructor(options: KrakenTickerProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://api.kraken.com";
    this.fetchFn = options.fetch ?? fetch;
  }

  async getTick(symbol: string): Promise<MarketTick> {
    const krakenSymbol = toKrakenRestPair(symbol);
    const url = `${this.baseUrl}/0/public/Ticker?pair=${krakenSymbol}`;
    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(`Kraken ticker request failed for ${symbol}: HTTP ${response.status ?? "unknown"}`);
    }

    const data = await response.json();
    const tick = normalizeKrakenTicker(symbol, krakenSymbol, data);
    if (!tick) throw new Error(`Invalid Kraken ticker payload for ${symbol}`);
    return tick;
  }
}

export function normalizeKrakenTicker(symbol: string, krakenSymbol: string, payload: unknown): MarketTick | null {
  if (!isRecord(payload) || !isRecord(payload.result)) {
    return null;
  }

  const result = payload.result;
  const tickerData = result[krakenSymbol];

  if (!isRecord(tickerData)) {
    return null;
  }

  const c = tickerData.c;
  const v = tickerData.v;
  const o = tickerData.o;

  if (!Array.isArray(c) || !Array.isArray(v) || !Array.isArray(o)) {
    return null;
  }

  const price = parseFloat(String(c[0]));
  const volume24h = parseFloat(String(v[1]));
  const open = parseFloat(String(o[0]));

  if (isNaN(price) || isNaN(volume24h) || isNaN(open) || open === 0) {
    return null;
  }

  const change24hPct = Number((((price - open) / open) * 100).toFixed(2));

  return {
    symbol,
    price,
    change24hPct,
    volume24h,
    timestamp: Date.now(),
    source: "kraken"
  };
}

// WebSocket message normalizer
export function normalizeKrakenMessage(message: unknown): MarketTick | null {
  if (!Array.isArray(message) || message.length < 4) {
    return null;
  }

  const [channelId, data, channelName, pair] = message;

  if (typeof channelName !== "string" || !channelName.startsWith("ticker")) {
    return null;
  }

  if (!isRecord(data)) {
    return null;
  }

  const c = data.c;
  const v = data.v;
  const h = data.h;
  const l = data.l;

  if (!Array.isArray(c) || !Array.isArray(v) || !Array.isArray(h) || !Array.isArray(l)) {
    return null;
  }

  const price = parseFloat(String(c[0]));
  const volume = parseFloat(String(v[1]));
  const high = parseFloat(String(h[1]));
  const low = parseFloat(String(l[1]));

  if (isNaN(price) || isNaN(volume) || isNaN(high) || isNaN(low)) {
    return null;
  }

  return {
    exchange: "kraken",
    symbol: normalizeKrakenSymbol(String(pair)),
    price,
    volume,
    timestamp: Date.now(),
    high,
    low,
    source: "kraken"
  };
}

// Build Kraken WebSocket subscription message
export function buildKrakenSubscription(symbols: string[]): Record<string, unknown> {
  return {
    event: "subscribe",
    pair: symbols,
    subscription: {
      name: "ticker",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeKrakenSymbol(symbol: string): string {
  return symbol.replace("/", "-").toUpperCase();
}

function toKrakenRestPair(symbol: string): string {
  const normalized = symbol.replace("/", "-").toUpperCase();
  const explicitMap: Record<string, string> = {
    "BTC-USDT": "XXBTZUSD",
    "ETH-USDT": "XETHZUSD",
    "BTC-USD": "XXBTZUSD",
    "ETH-USD": "XETHZUSD"
  };

  return explicitMap[normalized] ?? normalized.replace("-", "");
}
