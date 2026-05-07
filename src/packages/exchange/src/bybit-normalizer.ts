import type { MarketTick } from "@trade/shared";

export interface BybitSubscription {
  op: "subscribe";
  args: string[];
}

export function buildBybitSubscription(symbols: string[]): BybitSubscription {
  const topics = symbols.map((symbol) => {
    const bybitSymbol = toBybitSymbol(symbol);
    return `tickers.${bybitSymbol}`;
  });

  return {
    op: "subscribe",
    args: topics
  };
}

export function normalizeBybitMessage(message: unknown): MarketTick | null {
  if (!isRecord(message)) return null;

  // Skip subscription confirmation messages
  if (message.op === "subscribe" || message.success !== undefined) return null;

  const topic = typeof message.topic === "string" ? message.topic : "";
  const data = isRecord(message.data) ? message.data : undefined;

  if (!topic || !data) return null;

  // Extract symbol from topic like "tickers.BTCUSDT"
  const symbolMatch = topic.match(/^tickers\.(.+)$/);
  if (!symbolMatch) return null;

  const symbol = fromBybitSymbol(symbolMatch[1]);
  const price = parseOptionalNumber(data.lastPrice);
  if (price === undefined) return null;

  const changeFraction = parseOptionalNumber(data.price24hPcnt);

  return {
    symbol,
    price,
    change24hPct: changeFraction !== undefined ? roundPercent(changeFraction * 100) : undefined,
    volume24h: parseOptionalNumber(data.volume24h),
    timestamp: parseOptionalNumber(data.ts) ?? Date.now(),
    source: "bybit"
  };
}

function toBybitSymbol(symbol: string): string {
  return symbol.replace(/[-_/]/g, "").toUpperCase();
}

function fromBybitSymbol(bybitSymbol: string): string {
  // Convert BTCUSDT -> BTC-USDT
  const match = bybitSymbol.match(/^([A-Z]+)(USDT|USDC)$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return bybitSymbol;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
