export interface CoinGeckoMarketData {
  symbol: string;
  marketCapUsd: number;
  volume24hUsd: number;
  priceUsd: number;
  priceChange24hPct: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number | null;
  lastUpdated: string;
}

export interface CoinGeckoProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class CoinGeckoProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: CoinGeckoProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.coingecko.com/api/v3";
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetchMarketData(symbol: string): Promise<CoinGeckoMarketData> {
    const coinId = this.symbolToCoinId(symbol);
    const url = `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;

    const headers: Record<string, string> = {
      "Accept": "application/json"
    };

    if (this.apiKey) {
      headers["x-cg-pro-api-key"] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        symbol: symbol.toUpperCase(),
        marketCapUsd: data.market_data?.market_cap?.usd ?? 0,
        volume24hUsd: data.market_data?.total_volume?.usd ?? 0,
        priceUsd: data.market_data?.current_price?.usd ?? 0,
        priceChange24hPct: data.market_data?.price_change_percentage_24h ?? 0,
        circulatingSupply: data.market_data?.circulating_supply ?? 0,
        totalSupply: data.market_data?.total_supply ?? 0,
        maxSupply: data.market_data?.max_supply ?? null,
        lastUpdated: data.market_data?.last_updated ?? new Date().toISOString()
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private symbolToCoinId(symbol: string): string {
    const normalized = symbol.toUpperCase().replace("-USDT", "").replace("-USD", "");
    const mapping: Record<string, string> = {
      "BTC": "bitcoin",
      "ETH": "ethereum",
      "BNB": "binancecoin",
      "SOL": "solana",
      "ADA": "cardano",
      "XRP": "ripple",
      "DOT": "polkadot",
      "DOGE": "dogecoin",
      "AVAX": "avalanche-2",
      "MATIC": "matic-network"
    };
    return mapping[normalized] ?? normalized.toLowerCase();
  }
}
