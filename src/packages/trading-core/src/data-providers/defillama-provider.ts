export interface DeFiLlamaProtocolData {
  name: string;
  symbol: string;
  tvlUsd: number;
  chainTvls: Record<string, number>;
  change1h: number | null;
  change1d: number | null;
  change7d: number | null;
  mcap: number | null;
  lastUpdated: string;
}

export interface DeFiLlamaProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class DeFiLlamaProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: DeFiLlamaProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://api.llama.fi";
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetchProtocolTVL(protocolSlug: string): Promise<DeFiLlamaProtocolData> {
    const url = `${this.baseUrl}/protocol/${protocolSlug}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`DeFiLlama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        name: data.name ?? protocolSlug,
        symbol: data.symbol ?? "",
        tvlUsd: data.tvl ?? 0,
        chainTvls: data.chainTvls ?? {},
        change1h: data.change_1h ?? null,
        change1d: data.change_1d ?? null,
        change7d: data.change_7d ?? null,
        mcap: data.mcap ?? null,
        lastUpdated: new Date().toISOString()
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchChainTVL(chain: string): Promise<{ chain: string; tvlUsd: number; lastUpdated: string }> {
    const url = `${this.baseUrl}/v2/historicalChainTvl/${chain}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`DeFiLlama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const latest = data && data.length > 0 ? data[data.length - 1] : null;

      return {
        chain,
        tvlUsd: latest?.tvl ?? 0,
        lastUpdated: new Date().toISOString()
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  symbolToProtocolSlug(symbol: string): string {
    const normalized = symbol.toUpperCase().replace("-USDT", "").replace("-USD", "");
    const mapping: Record<string, string> = {
      "BTC": "bitcoin",
      "ETH": "ethereum",
      "BNB": "binance-coin",
      "SOL": "solana",
      "AVAX": "avalanche",
      "MATIC": "polygon"
    };
    return mapping[normalized] ?? normalized.toLowerCase();
  }
}
