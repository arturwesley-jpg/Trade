export type TradeMode = "paper" | "demo" | "live";
export type TradeSide = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "CLOSED";
export type MarketDataSource =
  | "binance"
  | "bingx"
  | "bybit"
  | "okx"
  | "kraken"
  | "coinbase"
  | "coinlore"
  | "coinpaprika"
  | "coinmarketcap"
  | "consensus"
  | "simulated";
export type SignalStatus = "AGUARDANDO" | "SINAL FRACO" | "PRECO VALIDADO" | "SEM SINAL" | "ALERTA ARBITRAGEM";

export interface MarketTick {
  symbol: string;
  price: number;
  change24hPct?: number;
  volume24h?: number;
  volume?: number;
  high?: number;
  low?: number;
  bid?: number;
  ask?: number;
  marketCap?: number;
  timestamp: number;
  source: MarketDataSource;
  exchange?: string;
  priceChange24h?: number;
}

export interface ProviderQuote extends MarketTick {
  latencyMs?: number;
  healthy?: boolean;
  stale?: boolean;
}

export interface ConsensusTick extends MarketTick {
  source: "consensus";
  sources: MarketDataSource[];
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  spreadPct: number;
  arbitragePct?: number;
  providerCount: number;
  status: SignalStatus;
  reason: string;
}

export interface ProviderStatusSnapshot {
  symbol: string;
  recommendedProvider: string | null;
  failoverOrder: string[];
  dataQualityScore: number;
  disagreementScore: number;
  shouldEmitWait: boolean;
  providers: Record<string, {
    provider: string;
    healthy: boolean;
    stale: boolean;
    price: number | null;
    latencyMs: number | null;
    updatedAt: number | null;
    lastError?: string;
  }>;
  updatedAt: number;
}

export interface MarketContextSnapshot {
  coinpaprikaGlobal?: Record<string, unknown>;
  coinpaprikaTickers?: Record<string, unknown>;
  coinlore?: Record<string, unknown>;
  dexscreener?: Record<string, unknown>;
  defillama?: Record<string, unknown>;
  coinmarketcap?: Record<string, unknown>;
  updatedAt: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorDetail {
  code:
    | "VALIDATION_ERROR"
    | "PAPER_ONLY_ENDPOINT"
    | "ORDER_REJECTED"
    | "POSITION_NOT_FOUND"
    | "INVALID_MARKET_QUERY"
    | "INVALID_CLOSE_PAYLOAD"
    | "INVALID_SYMBOL"
    | "SYMBOL_NOT_FOUND"
    | "UNAUTHORIZED"
    | "INTERNAL_ERROR"
    | "REGISTRATION_FAILED"
    | "LOGIN_FAILED"
    | "REFRESH_FAILED"
    | "LOGOUT_FAILED"
    | "BACKTEST_NOT_FOUND"
    | "BACKTEST_FAILED";
  message: string;
  correlationId: string;
  issues?: unknown[];
}

export type ApiErrorCode = ApiErrorDetail["code"];

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export interface HealthResponse {
  status: "ok";
  mode: "paper";
  liveTradingEnabled: boolean;
}

export interface PaperOrderRequest extends OrderRequest {
  idempotencyKey: string;
}

export interface MarketSnapshot {
  ticks: MarketTick[];
  updatedAt: string;
}

export interface SentimentSnapshot {
  score: number;
  label: string;
  updatedAt: string;
  source: "simulated" | "external";
  warning?: string;
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

export interface OrderRequest {
  symbol: string;
  side: TradeSide;
  mode: TradeMode;
  entryPrice: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  marginUsdt: number;
  leverage: number;
}

export interface OpenPaperOrderRequest extends OrderRequest {
  idempotencyKey: string;
}

export interface OrderIntent extends OrderRequest {
  id: string;
  idempotencyKey: string;
  createdAt: string;
  status: "CREATED" | "REJECTED" | "EXECUTED" | "DEDUPED";
  rejectionReasons?: string[];
}

export interface Position {
  id: string;
  orderIntentId: string;
  symbol: string;
  side: TradeSide;
  mode: TradeMode;
  status: PositionStatus;
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

export interface Trade {
  id: string;
  positionId: string;
  symbol: string;
  side: TradeSide;
  mode: TradeMode;
  entryPrice: number;
  exitPrice: number;
  pnlUsdt: number;
  marginUsdt: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
}

export interface AuditEvent {
  id: string;
  type:
    | "ORDER_INTENT_CREATED"
    | "ORDER_INTENT_REJECTED"
    | "ORDER_INTENT_DEDUPED"
    | "PAPER_POSITION_OPENED"
    | "PAPER_POSITION_CLOSED"
    | "RISK_CHECK_FAILED";
  correlationId: string;
  timestamp: string;
  payload: Record<string, unknown>;
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
  status?: SignalStatus;
  reason?: string;
  medianPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  spreadPct?: number;
  arbitragePct?: number;
  sources?: MarketDataSource[];
  providerCount?: number;
}

export interface RiskLimits {
  allowedSymbols: string[];
  maxPaperLeverage: number;
  maxLiveLeverage: number;
  maxRiskPctPerTrade: number;
  maxOpenPositions: number;
  maxDailyLossPct: number;
  maxMonthlyDrawdownPct: number;
  longOnly: boolean;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  allowedSymbols: ["BTC-USDT", "ETH-USDT"],
  maxPaperLeverage: 4,
  maxLiveLeverage: 2,
  maxRiskPctPerTrade: 2,
  maxOpenPositions: 3,
  maxDailyLossPct: 3,
  maxMonthlyDrawdownPct: 10,
  longOnly: true
};
