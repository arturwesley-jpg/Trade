export interface MarketTick {
    symbol: string;
    price: number;
    change24hPct?: number;
    volume24h?: number;
    bid?: number;
    ask?: number;
    medianPrice?: number;
    minPrice?: number;
    maxPrice?: number;
    spreadPct?: number;
    arbitragePct?: number;
    providerCount?: number;
    status?: "AGUARDANDO" | "SINAL FRACO" | "PRECO VALIDADO" | "SEM SINAL" | "ALERTA ARBITRAGEM";
    reason?: string;
    sources?: string[];
    timestamp: number;
    source: "binance" | "bingx" | "bybit" | "okx" | "kraken" | "coinbase" | "coinlore" | "coinpaprika" | "coinmarketcap" | "consensus" | "simulated";
}
export interface ApiSuccessResponse<T> {
    data: T;
}
export interface ApiErrorResponse {
    error: {
        message: string;
    };
}
export interface Position {
    id: string;
    orderIntentId: string;
    symbol: string;
    side: "LONG" | "SHORT";
    mode: "paper" | "demo" | "live";
    status: "OPEN" | "CLOSED";
    entryPrice: number;
    exitPrice?: number;
    marginUsdt: number;
    leverage: number;
    notional: number;
    quantity: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    pnlUsdt: number;
    openedAt: string;
    closedAt?: string;
}
export interface TradingSignal {
    id: string;
    symbol: string;
    direction: "WATCH_LONG" | "NEUTRAL";
    confidence: "low" | "medium" | "high";
    priceChangePct: number;
    shouldExecute: false;
    rationale: string;
    createdAt: string;
    status?: "AGUARDANDO" | "SINAL FRACO" | "PRECO VALIDADO" | "SEM SINAL" | "ALERTA ARBITRAGEM";
    reason?: string;
    medianPrice?: number;
    minPrice?: number;
    maxPrice?: number;
    spreadPct?: number;
    arbitragePct?: number;
    sources?: string[];
    providerCount?: number;
}
export interface ProviderHealth {
    provider: string;
    healthy: boolean;
    stale: boolean;
    price: number | null;
    latencyMs: number | null;
    updatedAt: number | null;
    lastError?: string;
}
export interface ProviderStatusSnapshot {
    symbol: string;
    recommendedProvider: string | null;
    failoverOrder: string[];
    dataQualityScore: number;
    disagreementScore: number;
    shouldEmitWait: boolean;
    providers: Record<string, ProviderHealth>;
    updatedAt: number;
}
export interface AlertEvent {
    id: string;
    type: "PRICE" | "TECHNICAL" | "WHALE" | "NEWS" | "SENTIMENT" | "RISK";
    status: "OPEN" | "ACKED" | "RESOLVED";
    title: string;
    message: string;
    severity: "low" | "medium" | "high";
    createdAt: string;
    resolvedAt?: string;
}
export interface SentimentSnapshot {
    score: number;
    label: string;
    updatedAt: string;
    source: "simulated" | "external";
}
export interface WhaleEvent {
    id: string;
    type: "EXCHANGE_INFLOW" | "EXCHANGE_OUTFLOW" | "ACCUMULATION" | "DISTRIBUTION" | "STABLECOIN_FLOW";
    symbol: string;
    valueUsd: number;
    severity: "low" | "medium" | "high";
    source: "simulated" | "external";
    timestamp: string;
}
export interface PaperSummary {
    openPositions: number;
    closedTrades: number;
    realizedPnlUsdt: number;
    unrealizedPnlUsdt: number;
    winRatePct?: number;
    updatedAt: string;
}
