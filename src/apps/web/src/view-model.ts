import type { AlertEvent, MarketTick, TradingSignal, WhaleEvent } from "./shared-types.js";

export interface PaperOrderPayload {
  idempotencyKey: string;
  symbol: string;
  side: "LONG";
  mode: "paper";
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  marginUsdt: number;
  leverage: number;
}

export interface MarketContextSummary {
  label: "Atenção compradora" | "Pressão vendedora" | "Neutro ativo";
  score: number;
  averageChangePct: number;
  watchLongCount: number;
}

export interface CommandItem<TId extends string = string> {
  id: TId;
  label: string;
  keywords: string[];
}

export function buildPaperOrderPayload(
  symbol: string,
  price: number,
  idempotencyKey = `${symbol}-${Date.now()}`
): PaperOrderPayload {
  return {
    idempotencyKey,
    symbol,
    side: "LONG",
    mode: "paper",
    entryPrice: price,
    stopLossPrice: roundMoney(price * 0.98),
    takeProfitPrice: roundMoney(price * 1.04),
    marginUsdt: 100,
    leverage: 2
  };
}

export function formatSignalDirection(direction: TradingSignal["direction"]) {
  return direction === "WATCH_LONG" ? "Observar LONG" : "Neutro";
}

export function formatSignalStatus(status?: TradingSignal["status"]) {
  if (!status) return "Sem status";
  const labels: Record<NonNullable<TradingSignal["status"]>, string> = {
    AGUARDANDO: "Aguardando",
    "SINAL FRACO": "Sinal fraco",
    "PRECO VALIDADO": "Preco validado",
    "SEM SINAL": "Sem sinal",
    "ALERTA ARBITRAGEM": "Arbitragem"
  };
  return labels[status];
}

export function getAccessiblePaperActionLabel(symbol: string) {
  return `Simular LONG paper para ${symbol}`;
}

export function resolvePageFromHash<TId extends string>(hash: string, allowedIds: TId[], fallback = "dashboard" as TId): TId {
  const normalized = hash.replace("#", "");
  return allowedIds.includes(normalized as TId) ? (normalized as TId) : fallback;
}

export function resolveAppRouteFromHash<TId extends string>(hash: string, hubPageIds: readonly TId[]): "landing" | TId {
  const normalized = hash.replace("#", "");
  if (!normalized) return "landing";
  return hubPageIds.includes(normalized as TId) ? (normalized as TId) : "landing";
}

export function filterCommandItems<TItem extends CommandItem>(items: TItem[], query: string): TItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    const haystack = [item.label, ...item.keywords].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}

export function summarizeMarketContext(
  ticks: MarketTick[],
  signals: Pick<TradingSignal, "direction">[]
): MarketContextSummary {
  const averageChangePct = ticks.length
    ? roundPercent(ticks.reduce((total, tick) => total + (tick.change24hPct ?? 0), 0) / ticks.length)
    : 0;
  const watchLongCount = signals.filter((signal) => signal.direction === "WATCH_LONG").length;
  const rawScore = 50 + averageChangePct * 10 + watchLongCount * 2;
  const score = clamp(Math.round(rawScore), 0, 100);

  return {
    label: score >= 60 ? "Atenção compradora" : score <= 40 ? "Pressão vendedora" : "Neutro ativo",
    score,
    averageChangePct,
    watchLongCount
  };
}

export function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 10_000 ? 0 : 2,
    style: "currency"
  });
}

export function formatPercent(value = 0) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${roundPercent(value).toFixed(2)}%`;
}

export function classForChange(value = 0) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export function formatWhaleEventType(type: WhaleEvent["type"]) {
  const labels: Record<WhaleEvent["type"], string> = {
    ACCUMULATION: "Acumulacao",
    DISTRIBUTION: "Distribuicao",
    EXCHANGE_INFLOW: "Entrada em exchange",
    EXCHANGE_OUTFLOW: "Saida de exchange",
    STABLECOIN_FLOW: "Fluxo de stablecoins"
  };
  return labels[type];
}

export function describeWhaleEvent(event: WhaleEvent) {
  const impact: Record<WhaleEvent["type"], string> = {
    ACCUMULATION: "possivel acumulacao",
    DISTRIBUTION: "possivel distribuicao",
    EXCHANGE_INFLOW: "possivel pressao de venda",
    EXCHANGE_OUTFLOW: "possivel retirada de oferta",
    STABLECOIN_FLOW: "liquidez em movimento"
  };
  return `${event.symbol} ${impact[event.type]}`;
}

export function formatAlertStatus(status: AlertEvent["status"]) {
  const labels: Record<AlertEvent["status"], string> = {
    ACKED: "ciente",
    OPEN: "ativo",
    RESOLVED: "resolvido"
  };
  return labels[status];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
