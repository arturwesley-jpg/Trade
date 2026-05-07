import {
  CoinGeckoProvider,
  type CoinGeckoMarketData,
  RSSNewsProvider,
  type NewsItem,
  DeFiLlamaProvider,
  type DeFiLlamaProtocolData
} from "@trade/trading-core";

export interface DataAggregatorOptions {
  coingeckoApiKey?: string;
  cacheTimeMs?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface FundamentalsData {
  symbol: string;
  marketCapUsd: number;
  volume24hUsd: number;
  priceUsd: number;
  priceChange24hPct: number;
  source: "coingecko" | "simulated";
  warning?: string;
  lastUpdated: string;
}

export interface NewsData {
  items: NewsItem[];
  source: "rss" | "simulated";
  warning?: string;
  lastUpdated: string;
}

export interface OnchainData {
  symbol: string;
  tvlUsd: number;
  change1d: number | null;
  change7d: number | null;
  source: "defillama" | "simulated";
  warning?: string;
  lastUpdated: string;
}

export class DataAggregator {
  private readonly coingeckoProvider: CoinGeckoProvider;
  private readonly rssNewsProvider: RSSNewsProvider;
  private readonly defillamaProvider: DeFiLlamaProvider;
  private readonly cacheTimeMs: number;

  private fundamentalsCache = new Map<string, CacheEntry<FundamentalsData>>();
  private newsCache: CacheEntry<NewsData> | null = null;
  private onchainCache = new Map<string, CacheEntry<OnchainData>>();

  constructor(options: DataAggregatorOptions = {}) {
    this.coingeckoProvider = new CoinGeckoProvider({
      apiKey: options.coingeckoApiKey
    });
    this.rssNewsProvider = new RSSNewsProvider();
    this.defillamaProvider = new DeFiLlamaProvider();
    this.cacheTimeMs = options.cacheTimeMs ?? 5 * 60 * 1000; // 5 minutes
  }

  async fetchFundamentals(symbol: string): Promise<FundamentalsData> {
    const cached = this.fundamentalsCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeMs) {
      return cached.data;
    }

    try {
      const data = await this.coingeckoProvider.fetchMarketData(symbol);
      const result: FundamentalsData = {
        symbol: data.symbol,
        marketCapUsd: data.marketCapUsd,
        volume24hUsd: data.volume24hUsd,
        priceUsd: data.priceUsd,
        priceChange24hPct: data.priceChange24hPct,
        source: "coingecko",
        lastUpdated: data.lastUpdated
      };

      this.fundamentalsCache.set(symbol, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      const fallback = this.getSimulatedFundamentals(symbol);
      fallback.warning = `CoinGecko API failed: ${error instanceof Error ? error.message : "Unknown error"}. Using simulated data.`;
      return fallback;
    }
  }

  async fetchNews(): Promise<NewsData> {
    if (this.newsCache && Date.now() - this.newsCache.timestamp < this.cacheTimeMs) {
      return this.newsCache.data;
    }

    try {
      const items = await this.rssNewsProvider.fetchNews();

      if (items.length === 0) {
        throw new Error("No news items fetched from RSS feeds");
      }

      const result: NewsData = {
        items,
        source: "rss",
        lastUpdated: new Date().toISOString()
      };

      this.newsCache = {
        data: result,
        timestamp: Date.now()
      };

      return result;
    } catch (error) {
      const fallback = this.getSimulatedNews();
      fallback.warning = `RSS feeds failed: ${error instanceof Error ? error.message : "Unknown error"}. Using simulated data.`;
      return fallback;
    }
  }

  async fetchOnchainData(symbol: string): Promise<OnchainData> {
    const cached = this.onchainCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeMs) {
      return cached.data;
    }

    try {
      const protocolSlug = this.defillamaProvider.symbolToProtocolSlug(symbol);
      const data = await this.defillamaProvider.fetchProtocolTVL(protocolSlug);

      const result: OnchainData = {
        symbol: data.symbol || symbol,
        tvlUsd: data.tvlUsd,
        change1d: data.change1d,
        change7d: data.change7d,
        source: "defillama",
        lastUpdated: data.lastUpdated
      };

      this.onchainCache.set(symbol, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      const fallback = this.getSimulatedOnchainData(symbol);
      fallback.warning = `DeFiLlama API failed: ${error instanceof Error ? error.message : "Unknown error"}. Using simulated data.`;
      return fallback;
    }
  }

  clearCache(): void {
    this.fundamentalsCache.clear();
    this.newsCache = null;
    this.onchainCache.clear();
  }

  private getSimulatedFundamentals(symbol: string): FundamentalsData {
    const normalized = symbol.toUpperCase().replace("-USDT", "").replace("-USD", "");

    const simulatedData: Record<string, Partial<FundamentalsData>> = {
      "BTC": {
        marketCapUsd: 1_900_000_000_000,
        volume24hUsd: 45_000_000_000,
        priceUsd: 100_000,
        priceChange24hPct: 2.5
      },
      "ETH": {
        marketCapUsd: 360_000_000_000,
        volume24hUsd: 18_000_000_000,
        priceUsd: 3_000,
        priceChange24hPct: 3.2
      }
    };

    const data = simulatedData[normalized] ?? {
      marketCapUsd: 1_000_000_000,
      volume24hUsd: 50_000_000,
      priceUsd: 100,
      priceChange24hPct: 0
    };

    return {
      symbol: normalized,
      marketCapUsd: data.marketCapUsd!,
      volume24hUsd: data.volume24hUsd!,
      priceUsd: data.priceUsd!,
      priceChange24hPct: data.priceChange24hPct!,
      source: "simulated",
      lastUpdated: new Date().toISOString()
    };
  }

  private getSimulatedNews(): NewsData {
    return {
      items: [
        {
          title: "Simulated: Bitcoin ETF inflows reach new highs",
          link: "https://example.com/simulated-1",
          publishedAt: new Date().toISOString(),
          source: "simulated",
          description: "Simulated news item for testing purposes"
        },
        {
          title: "Simulated: Ethereum network upgrade scheduled",
          link: "https://example.com/simulated-2",
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
          source: "simulated",
          description: "Simulated news item for testing purposes"
        }
      ],
      source: "simulated",
      lastUpdated: new Date().toISOString()
    };
  }

  private getSimulatedOnchainData(symbol: string): OnchainData {
    const normalized = symbol.toUpperCase().replace("-USDT", "").replace("-USD", "");

    const simulatedData: Record<string, Partial<OnchainData>> = {
      "BTC": {
        tvlUsd: 25_000_000_000,
        change1d: 1.5,
        change7d: 5.2
      },
      "ETH": {
        tvlUsd: 50_000_000_000,
        change1d: 2.1,
        change7d: 8.5
      }
    };

    const data = simulatedData[normalized] ?? {
      tvlUsd: 1_000_000_000,
      change1d: 0,
      change7d: 0
    };

    return {
      symbol: normalized,
      tvlUsd: data.tvlUsd!,
      change1d: data.change1d!,
      change7d: data.change7d!,
      source: "simulated",
      lastUpdated: new Date().toISOString()
    };
  }
}
