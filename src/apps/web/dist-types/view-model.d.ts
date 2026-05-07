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
export declare function buildPaperOrderPayload(symbol: string, price: number, idempotencyKey?: string): PaperOrderPayload;
export declare function formatSignalDirection(direction: TradingSignal["direction"]): "Observar LONG" | "Neutro";
export declare function formatSignalStatus(status?: TradingSignal["status"]): string;
export declare function getAccessiblePaperActionLabel(symbol: string): string;
export declare function resolvePageFromHash<TId extends string>(hash: string, allowedIds: TId[], fallback?: TId): TId;
export declare function resolveAppRouteFromHash<TId extends string>(hash: string, hubPageIds: readonly TId[]): "landing" | TId;
export declare function filterCommandItems<TItem extends CommandItem>(items: TItem[], query: string): TItem[];
export declare function summarizeMarketContext(ticks: MarketTick[], signals: Pick<TradingSignal, "direction">[]): MarketContextSummary;
export declare function formatCurrency(value: number): string;
export declare function formatPercent(value?: number): string;
export declare function classForChange(value?: number): "positive" | "negative" | "neutral";
export declare function formatWhaleEventType(type: WhaleEvent["type"]): string;
export declare function describeWhaleEvent(event: WhaleEvent): string;
export declare function formatAlertStatus(status: AlertEvent["status"]): string;
