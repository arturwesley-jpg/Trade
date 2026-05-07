import type { MarketTick } from "@trade/shared";

export type BingXChannel = "ticker" | "trade" | "depth20" | "kline_1min";

export interface BingXSubscription {
  id: string;
  reqType: "sub";
  dataType: string;
}

export function buildBingXSubscription(symbol: string, channel: BingXChannel): BingXSubscription {
  return {
    id: `${symbol}:${channel}`,
    reqType: "sub",
    dataType: `${symbol}@${channel}`
  };
}

export function normalizeBingXMessage(message: unknown): MarketTick | null {
  if (!isRecord(message)) return null;
  if ("ping" in message || "pong" in message || "code" in message) return null;

  const dataType = typeof message.dataType === "string" ? message.dataType : "";
  const data = isRecord(message.data) ? message.data : undefined;
  if (!dataType || !data) return null;

  const [symbol, channel] = dataType.split("@");
  if (!symbol || !channel) return null;

  const price = parseOptionalNumber(data.c) ?? parseOptionalNumber(data.p) ?? parseOptionalNumber(data.price);
  if (price === undefined) return null;

  return {
    symbol,
    price,
    change24hPct: parseOptionalNumber(data.P),
    volume24h: parseOptionalNumber(data.v),
    timestamp: parseOptionalNumber(data.E) ?? parseOptionalNumber(data.T) ?? Date.now(),
    source: "bingx"
  };
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
