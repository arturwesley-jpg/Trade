/**
 * Historical Data Fetcher
 * Fetches historical OHLCV data from multiple sources with caching
 */

import { promises as fs } from "fs";
import { join } from "path";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TimeInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface HistoricalDataFetcherConfig {
  cacheDir?: string;
  useCache?: boolean;
}

export interface FetchHistoricalCandlesParams {
  symbol: string;
  interval: string;
  startDate: Date;
  endDate: Date;
}

export class HistoricalDataFetcher {
  private cacheDir: string;
  private useCache: boolean;

  constructor(config: HistoricalDataFetcherConfig = {}) {
    this.cacheDir = config.cacheDir || ".cache/historical-data";
    this.useCache = config.useCache ?? true;
  }

  async fetchHistoricalCandles(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<Candle[]>;
  async fetchHistoricalCandles(params: FetchHistoricalCandlesParams): Promise<Candle[]>;
  async fetchHistoricalCandles(
    symbolOrParams: string | FetchHistoricalCandlesParams,
    interval?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Candle[]> {
    let symbol: string;
    let intervalStr: string;
    let start: Date;
    let end: Date;

    if (typeof symbolOrParams === "string") {
      symbol = symbolOrParams;
      intervalStr = interval!;
      start = startDate!;
      end = endDate!;
    } else {
      symbol = symbolOrParams.symbol;
      intervalStr = symbolOrParams.interval;
      start = symbolOrParams.startDate;
      end = symbolOrParams.endDate;
    }

    // Try to load from cache
    if (this.useCache) {
      const cached = await this.loadFromCache(symbol, intervalStr, start, end);
      if (cached) {
        return cached;
      }
    }

    // Generate mock data (in production, this would fetch from exchange)
    const candles = this.generateMockCandles(symbol, intervalStr, start, end);

    // Save to cache
    if (this.useCache) {
      await this.saveToCache(symbol, intervalStr, start, end, candles);
    }

    return candles;
  }

  private async loadFromCache(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<Candle[] | null> {
    try {
      const cacheKey = this.getCacheKey(symbol, interval, startDate, endDate);
      const cachePath = join(this.cacheDir, cacheKey);
      const data = await fs.readFile(cachePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async saveToCache(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date,
    candles: Candle[]
  ): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const cacheKey = this.getCacheKey(symbol, interval, startDate, endDate);
      const cachePath = join(this.cacheDir, cacheKey);
      await fs.writeFile(cachePath, JSON.stringify(candles));
    } catch (error) {
      // Ignore cache write errors
    }
  }

  private getCacheKey(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): string {
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];
    return `${symbol}_${interval}_${startStr}_${endStr}.json`;
  }

  private generateMockCandles(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): Candle[] {
    const candles: Candle[] = [];
    const intervalMs = this.getIntervalMs(interval);
    const basePrice = 40000;

    let currentTime = startDate.getTime();
    const endTime = endDate.getTime();

    while (currentTime <= endTime) {
      const price = basePrice + Math.random() * 1000;
      candles.push({
        timestamp: currentTime,
        open: price,
        high: price + Math.random() * 500,
        low: price - Math.random() * 500,
        close: price + (Math.random() - 0.5) * 200,
        volume: 1000000 + Math.random() * 500000
      });

      currentTime += intervalMs;
    }

    return candles;
  }

  private getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      "1m": 60_000,
      "5m": 300_000,
      "15m": 900_000,
      "1h": 3_600_000,
      "4h": 14_400_000,
      "1d": 86_400_000
    };
    return map[interval] ?? 3_600_000;
  }
}

export interface HistoricalDataOptions {
  symbol: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  startTime: number;
  endTime: number;
  limit?: number;
}

export interface HistoricalDataSource {
  name: string;
  fetchCandles(options: HistoricalDataOptions): Promise<Candle[]>;
}

/**
 * BingX Historical Data Source
 */
export class BingXHistoricalDataSource implements HistoricalDataSource {
  readonly name = "bingx";
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: { baseUrl?: string; fetch?: typeof fetch } = {}) {
    this.baseUrl = options.baseUrl ?? "https://open-api.bingx.com";
    this.fetchFn = options.fetch ?? fetch;
  }

  async fetchCandles(options: HistoricalDataOptions): Promise<Candle[]> {
    const symbol = this.toBingXSymbol(options.symbol);
    const interval = this.toBingXInterval(options.interval);
    const limit = options.limit ?? 1000;

    const url = new URL(`${this.baseUrl}/openApi/swap/v2/quote/klines`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("startTime", options.startTime.toString());
    url.searchParams.set("endTime", options.endTime.toString());
    url.searchParams.set("limit", limit.toString());

    const response = await this.fetchFn(url.toString());
    if (!response.ok) {
      throw new Error(`BingX API error: ${response.status}`);
    }

    const data = await response.json();
    if (!isRecord(data) || data.code !== 0 || !Array.isArray(data.data)) {
      throw new Error("Invalid BingX response");
    }

    return data.data.map((item: any) => ({
      timestamp: Number(item.time),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume)
    }));
  }

  private toBingXSymbol(symbol: string): string {
    return symbol.replace(/[-_/]/g, "").toUpperCase();
  }

  private toBingXInterval(interval: string): string {
    const map: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d"
    };
    return map[interval] ?? "1h";
  }
}

/**
 * Binance Historical Data Source
 */
export class BinanceHistoricalDataSource implements HistoricalDataSource {
  readonly name = "binance";
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: { baseUrl?: string; fetch?: typeof fetch } = {}) {
    this.baseUrl = options.baseUrl ?? "https://api.binance.com";
    this.fetchFn = options.fetch ?? fetch;
  }

  async fetchCandles(options: HistoricalDataOptions): Promise<Candle[]> {
    const symbol = this.toBinanceSymbol(options.symbol);
    const interval = this.toBinanceInterval(options.interval);
    const limit = options.limit ?? 1000;

    const url = new URL(`${this.baseUrl}/api/v3/klines`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("startTime", options.startTime.toString());
    url.searchParams.set("endTime", options.endTime.toString());
    url.searchParams.set("limit", limit.toString());

    const response = await this.fetchFn(url.toString());
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Invalid Binance response");
    }

    return data.map((item: any[]) => ({
      timestamp: Number(item[0]),
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5])
    }));
  }

  private toBinanceSymbol(symbol: string): string {
    return symbol.replace(/[-_/]/g, "").toUpperCase();
  }

  private toBinanceInterval(interval: string): string {
    const map: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d"
    };
    return map[interval] ?? "1h";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
