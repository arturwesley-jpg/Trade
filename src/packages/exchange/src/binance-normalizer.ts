import type { MarketTick } from "@trade/shared";

export interface BinanceSubscription {
  method: "SUBSCRIBE";
  params: string[];
  id: number;
}

export function buildBinanceSubscription(symbols: string[]): BinanceSubscription {
  const streams = symbols.map((symbol) => {
    const binanceSymbol = toBinanceSymbol(symbol);
    return `${binanceSymbol.toLowerCase()}@ticker`;
  });

  return {
    method: "SUBSCRIBE",
    params: streams,
    id: Date.now()
  };
}

export function normalizeBinanceMessage(message: unknown): MarketTick | null {
  if (!isRecord(message)) return null;

  // Skip subscription confirmation messages
  if ("result" in message || "id" in message) return null;

  const data = isRecord(message.data) ? message.data : undefined;
  if (!data) return null;

  const symbolRaw = typeof data.s === "string" ? data.s : "";
  if (!symbolRaw) return null;

  const symbol = fromBinanceSymbol(symbolRaw);
  const price = parseOptionalNumber(data.c);
  if (price === undefined) return null;

  return {
    symbol,
    price,
    change24hPct: parseOptionalNumber(data.P),
    volume24h: parseOptionalNumber(data.v),
    timestamp: parseOptionalNumber(data.E) ?? Date.now(),
    source: "binance"
  };
}

function toBinanceSymbol(symbol: string): string {
  return symbol.replace(/[-_/]/g, "").toUpperCase();
}

function fromBinanceSymbol(binanceSymbol: string): string {
  // Convert BTCUSDT -> BTC-USDT
  const match = binanceSymbol.match(/^([A-Z]+)(USDT|BUSD|USDC)$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return binanceSymbol;
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
