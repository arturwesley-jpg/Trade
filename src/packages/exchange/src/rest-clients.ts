import type { MarketContextSnapshot, ProviderQuote } from "@trade/shared";

interface HttpResponse {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}

type FetchFn = (url: string) => Promise<HttpResponse>;

export interface FetchClientOptions {
  fetch?: FetchFn;
}

export class CoinLoreClient {
  private readonly fetchFn: FetchFn;

  constructor(options: FetchClientOptions = {}) {
    this.fetchFn = options.fetch ?? fetch;
  }

  async getQuotes(symbols: string[]): Promise<Record<string, ProviderQuote>> {
    const assetsResponse = await this.fetchFn("https://api.coinlore.net/api/assets/");
    if (!assetsResponse.ok) throw new Error(`CoinLore assets failed: HTTP ${assetsResponse.status ?? "unknown"}`);
    const assets = await assetsResponse.json();
    if (!Array.isArray(assets)) return {};

    const wanted = new Set(symbols.map((symbol) => baseAsset(symbol)));
    const idByAsset = new Map<string, string>();

    for (const asset of assets) {
      if (!isRecord(asset)) continue;
      const symbol = typeof asset.symbol === "string" ? asset.symbol.toUpperCase() : "";
      const id = typeof asset.id === "string" ? asset.id : typeof asset.id === "number" ? String(asset.id) : "";
      if (wanted.has(symbol) && id && !idByAsset.has(symbol)) {
        idByAsset.set(symbol, id);
      }
    }

    if (idByAsset.size === 0) return {};

    const tickerResponse = await this.fetchFn(
      `https://api.coinlore.net/api/ticker/?id=${encodeURIComponent(Array.from(idByAsset.values()).join(","))}`
    );
    if (!tickerResponse.ok) throw new Error(`CoinLore ticker failed: HTTP ${tickerResponse.status ?? "unknown"}`);
    const rows = await tickerResponse.json();
    if (!Array.isArray(rows)) return {};

    const symbolById = new Map<string, string>();
    for (const symbol of symbols) {
      const base = baseAsset(symbol);
      const id = idByAsset.get(base);
      if (id) symbolById.set(id, symbol);
    }

    const quotes: Record<string, ProviderQuote> = {};
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const id = typeof row.id === "string" ? row.id : typeof row.id === "number" ? String(row.id) : "";
      const symbol = symbolById.get(id);
      const price = parseNumber(row.price_usd);
      if (!symbol || price === undefined) continue;
      quotes[symbol] = {
        symbol,
        price,
        volume24h: parseNumber(row.volume24),
        marketCap: parseNumber(row.market_cap_usd),
        timestamp: Date.now(),
        source: "coinlore"
      };
    }
    return quotes;
  }
}

export class CoinPaprikaClient {
  private readonly fetchFn: FetchFn;

  constructor(options: FetchClientOptions = {}) {
    this.fetchFn = options.fetch ?? fetch;
  }

  async getTickersById(mapping: Record<string, string>): Promise<Record<string, ProviderQuote>> {
    const response = await this.fetchFn("https://api.coinpaprika.com/v1/tickers?quotes=USD");
    if (!response.ok) throw new Error(`CoinPaprika tickers failed: HTTP ${response.status ?? "unknown"}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) return {};

    const quotes: Record<string, ProviderQuote> = {};
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const id = typeof row.id === "string" ? row.id : "";
      const symbol = mapping[id];
      const usd = isRecord(row.quotes) && isRecord(row.quotes.USD) ? row.quotes.USD : undefined;
      const price = usd ? parseNumber(usd.price) : undefined;
      if (!symbol || price === undefined) continue;
      quotes[symbol] = {
        symbol,
        price,
        volume24h: usd ? parseNumber(usd.volume_24h) : undefined,
        marketCap: usd ? parseNumber(usd.market_cap) : undefined,
        timestamp: Date.now(),
        source: "coinpaprika"
      };
    }
    return quotes;
  }

  async getGlobal(): Promise<Record<string, unknown>> {
    const response = await this.fetchFn("https://api.coinpaprika.com/v1/global");
    if (!response.ok) throw new Error(`CoinPaprika global failed: HTTP ${response.status ?? "unknown"}`);
    const payload = await response.json();
    return isRecord(payload) ? payload : {};
  }
}

export class DexScreenerClient {
  private readonly fetchFn: FetchFn;

  constructor(options: FetchClientOptions = {}) {
    this.fetchFn = options.fetch ?? fetch;
  }

  async search(queries: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const query of queries) {
      const response = await this.fetchFn(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error(`DexScreener failed for ${query}: HTTP ${response.status ?? "unknown"}`);
      const payload = await response.json();
      result[query] = payload;
    }
    return result;
  }
}

export class DefiLlamaClient {
  private readonly fetchFn: FetchFn;

  constructor(options: FetchClientOptions = {}) {
    this.fetchFn = options.fetch ?? fetch;
  }

  async getProtocols(): Promise<Record<string, unknown>> {
    const response = await this.fetchFn("https://api.llama.fi/protocols");
    if (!response.ok) throw new Error(`DefiLlama failed: HTTP ${response.status ?? "unknown"}`);
    const payload = await response.json();
    return { protocols: Array.isArray(payload) ? payload : [] };
  }
}

export class CoinMarketCapClient {
  constructor(private readonly apiKey: string, _options: FetchClientOptions = {}) {
  }

  async getQuotes(symbols: string[]): Promise<Record<string, unknown>> {
    if (!this.apiKey) return {};
    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbols.join(","))}&convert=USD`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": this.apiKey,
          Accept: "application/json"
        }
      }
    );
    if (!response.ok) throw new Error(`CoinMarketCap failed: HTTP ${response.status ?? "unknown"}`);
    const payload = await response.json();
    return isRecord(payload) ? payload : {};
  }
}

export function createEmptyMarketContext(): MarketContextSnapshot {
  return { updatedAt: Date.now() };
}

function baseAsset(symbol: string): string {
  return symbol.split("-")[0]?.toUpperCase() ?? symbol.toUpperCase();
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
