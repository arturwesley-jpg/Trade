import type { AlertEvent, MarketTick, PaperSummary, Position, ProviderStatusSnapshot, SentimentSnapshot, TradingSignal, WhaleEvent } from "./shared-types.js";
import type { PaperOrderPayload } from "./view-model.js";
import type { Backtest, BacktestWithMetrics, CreateBacktestRequest } from "@trade/shared";
export declare const apiBaseUrl: any;
export interface Health {
    status: string;
    mode: string;
    liveTradingEnabled: boolean;
}
export interface ApiFailure {
    message: string;
    code?: string;
    statusCode?: number;
    isTimeout?: boolean;
    isNetworkError?: boolean;
}
export interface PerformanceMetrics {
    totalReturn: number;
    totalReturnPct: number;
    sharpeRatio?: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    winRate: number;
    totalTrades: number;
}
export declare function fetchHealth(): Promise<Health>;
export declare function fetchMarketTicks(): Promise<MarketTick[]>;
export declare function fetchSignals(): Promise<TradingSignal[]>;
export declare function fetchProviderStatuses(): Promise<ProviderStatusSnapshot[]>;
export declare function fetchPositions(): Promise<Position[]>;
export declare function fetchAlerts(): Promise<AlertEvent[]>;
export declare function fetchSentimentSnapshot(): Promise<SentimentSnapshot>;
export declare function fetchWhaleEvents(): Promise<WhaleEvent[]>;
export declare function fetchPaperSummary(): Promise<PaperSummary>;
export declare function openPaperOrder(payload: PaperOrderPayload): Promise<unknown>;
export declare function getBacktests(): Promise<BacktestWithMetrics[]>;
export declare function createBacktest(params: CreateBacktestRequest): Promise<Backtest>;
export declare function getMetrics(): Promise<PerformanceMetrics>;
export declare function requestJsonWithRetry<T>(path: string, init?: RequestInit, retryCount?: number): Promise<T>;
