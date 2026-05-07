import type { MarketTick } from "@trade/shared";
import { ProviderSupervisor, type ProviderSupervisorStatus } from "./provider-supervisor.js";

export { OKXTickerProvider } from "./okx-normalizer.js";
export { KrakenTickerProvider } from "./kraken-normalizer.js";

export interface MarketDataProvider {
  name: string;
  getTick(symbol: string): Promise<MarketTick>;
}

export interface PollingMarketDataSupervisorOptions {
  providers: MarketDataProvider[];
  primaryProvider: string;
  staleAfterMs: number;
  now?: () => number;
}

export interface PollingMarketDataResult {
  ticks: MarketTick[];
  errors: Array<{ provider: string; message: string }>;
  status: ProviderSupervisorStatus;
}

export class PollingMarketDataSupervisor {
  private readonly supervisor: ProviderSupervisor;
  private readonly now: () => number;

  constructor(private readonly options: PollingMarketDataSupervisorOptions) {
    this.now = options.now ?? Date.now;
    this.supervisor = new ProviderSupervisor({
      providers: options.providers.map((provider) => provider.name),
      primaryProvider: options.primaryProvider,
      staleAfterMs: options.staleAfterMs,
      now: this.now
    });
  }

  async poll(symbols: string[]): Promise<PollingMarketDataResult> {
    const ticks: MarketTick[] = [];
    const errors: Array<{ provider: string; message: string }> = [];

    for (const provider of this.options.providers) {
      for (const symbol of symbols) {
        const startedAt = this.now();
        try {
          const tick = await provider.getTick(symbol);
          ticks.push(tick);
          this.supervisor.recordTick(provider.name, {
            price: tick.price,
            latencyMs: Math.max(0, this.now() - startedAt),
            timestamp: tick.timestamp
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown provider error";
          errors.push({ provider: provider.name, message });
          this.supervisor.recordError(provider.name, message);
        }
      }
    }

    return {
      ticks,
      errors,
      status: this.supervisor.status()
    };
  }
}

export interface SimulatedMarketDataProviderOptions {
  name?: "simulated";
  prices: Record<string, number>;
  now?: () => number;
}

export class SimulatedMarketDataProvider implements MarketDataProvider {
  readonly name: "simulated";
  private readonly now: () => number;

  constructor(private readonly options: SimulatedMarketDataProviderOptions) {
    this.name = options.name ?? "simulated";
    this.now = options.now ?? Date.now;
  }

  async getTick(symbol: string): Promise<MarketTick> {
    const base = this.options.prices[symbol];
    if (!base) throw new Error(`No simulated price configured for ${symbol}`);
    const drift = Math.sin(this.now() / 30_000) * 0.01;
    return {
      symbol,
      price: roundMoney(base * (1 + drift)),
      change24hPct: roundPercent(drift * 100),
      timestamp: this.now(),
      source: this.name
    };
  }
}

export interface BinanceTickerProviderOptions {
  baseUrl?: string;
  fetch?: (url: string) => Promise<{
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
  }>;
}

export class BinanceTickerProvider implements MarketDataProvider {
  readonly name = "binance";
  private readonly baseUrl: string;
  private readonly fetchFn: NonNullable<BinanceTickerProviderOptions["fetch"]>;

  constructor(options: BinanceTickerProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://api.binance.com";
    this.fetchFn = options.fetch ?? fetch;
  }

  async getTick(symbol: string): Promise<MarketTick> {
    const binanceSymbol = toBinanceSymbol(symbol);
    const response = await this.fetchFn(`${this.baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(binanceSymbol)}`);
    if (!response.ok) {
      throw new Error(`Binance ticker request failed for ${symbol}: HTTP ${response.status ?? "unknown"}`);
    }

    const payload = await response.json();
    const tick = normalizeBinanceTicker(symbol, payload);
    if (!tick) throw new Error(`Invalid Binance ticker payload for ${symbol}`);
    return tick;
  }
}

export interface BybitTickerProviderOptions {
  baseUrl?: string;
  fetch?: (url: string) => Promise<{
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
  }>;
}

export class BybitTickerProvider implements MarketDataProvider {
  readonly name = "bybit";
  private readonly baseUrl: string;
  private readonly fetchFn: NonNullable<BybitTickerProviderOptions["fetch"]>;

  constructor(options: BybitTickerProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://api.bybit.com";
    this.fetchFn = options.fetch ?? fetch;
  }

  async getTick(symbol: string): Promise<MarketTick> {
    const bybitSymbol = toExchangeSymbol(symbol);
    const response = await this.fetchFn(
      `${this.baseUrl}/v5/market/tickers?category=spot&symbol=${encodeURIComponent(bybitSymbol)}`
    );
    if (!response.ok) {
      throw new Error(`Bybit ticker request failed for ${symbol}: HTTP ${response.status ?? "unknown"}`);
    }

    const payload = await response.json();
    if (isRecord(payload) && payload.retCode !== 0) {
      throw new Error(`Bybit ticker request failed for ${symbol}: ${String(payload.retMsg ?? "unknown error")}`);
    }
    const tick = normalizeBybitTicker(symbol, payload);
    if (!tick) throw new Error(`Invalid Bybit ticker payload for ${symbol}`);
    return tick;
  }
}

function normalizeBinanceTicker(symbol: string, payload: unknown): MarketTick | null {
  if (!isRecord(payload)) return null;
  const price = parseNumber(payload.lastPrice);
  const change24hPct = parseNumber(payload.priceChangePercent);
  const volume24h = parseNumber(payload.volume);
  const timestamp = parseNumber(payload.closeTime);
  if (price === undefined || timestamp === undefined) return null;

  return {
    symbol,
    price,
    change24hPct,
    volume24h,
    timestamp,
    source: "binance"
  };
}

function normalizeBybitTicker(symbol: string, payload: unknown): MarketTick | null {
  if (!isRecord(payload) || !isRecord(payload.result) || !Array.isArray(payload.result.list)) return null;
  const first = payload.result.list[0];
  if (!isRecord(first)) return null;
  const price = parseNumber(first.lastPrice);
  const changeFraction = parseNumber(first.price24hPcnt);
  const volume24h = parseNumber(first.volume24h);
  const timestamp = parseNumber(payload.time);
  if (price === undefined || timestamp === undefined) return null;

  return {
    symbol,
    price,
    change24hPct: changeFraction === undefined ? undefined : roundPercent(changeFraction * 100),
    volume24h,
    timestamp,
    source: "bybit"
  };
}

function toBinanceSymbol(symbol: string): string {
  return toExchangeSymbol(symbol);
}

function toExchangeSymbol(symbol: string): string {
  return symbol.replace(/[-_/]/g, "").toUpperCase();
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
