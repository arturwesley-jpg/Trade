import type { MarketTick } from "@trade/shared";

export interface CoinbaseSubscription {
  type: "subscribe";
  product_ids: string[];
  channel: "ticker";
}

export function buildCoinbaseSubscription(symbols: string[]): CoinbaseSubscription {
  return {
    type: "subscribe",
    product_ids: symbols.map(toCoinbaseSymbol),
    channel: "ticker"
  };
}

export function normalizeCoinbaseMessage(message: unknown): MarketTick | null {
  if (!isRecord(message)) return null;
  if (message.type === "subscriptions" || message.channel !== "ticker") return null;

  const events = Array.isArray(message.events) ? message.events : [];
  for (const event of events) {
    if (!isRecord(event)) continue;
    const tickers = Array.isArray(event.tickers) ? event.tickers : [];
    for (const ticker of tickers) {
      if (!isRecord(ticker)) continue;
      const productId = typeof ticker.product_id === "string" ? ticker.product_id : "";
      const price = parseOptionalNumber(ticker.price);
      if (!productId || price === undefined) continue;

      return {
        symbol: fromCoinbaseSymbol(productId),
        price,
        bid: parseOptionalNumber(ticker.best_bid),
        ask: parseOptionalNumber(ticker.best_ask),
        volume24h: parseOptionalNumber(ticker.volume_24_h),
        timestamp: Date.now(),
        source: "coinbase"
      };
    }
  }

  return null;
}

function toCoinbaseSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function fromCoinbaseSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
