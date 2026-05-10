import type {
  AlertEvent,
  ApiErrorResponse,
  ApiSuccessResponse,
  MarketTick,
  PaperSummary,
  Position,
  ProviderStatusSnapshot,
  SentimentSnapshot,
  TradingSignal,
  WhaleEvent
} from "./shared-types.js";
import type { PaperOrderPayload } from "./view-model.js";
import type {
  Backtest,
  BacktestWithMetrics,
  CreateBacktestRequest
} from "@trade/shared";
import { API_BASE_URL } from "./config/api";

export const apiBaseUrl = API_BASE_URL;

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

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 30000; // 30 seconds

export async function fetchHealth() {
  return requestJson<Health>("/health");
}

export async function fetchMarketTicks() {
  try {
    return await requestJson<MarketTick[]>("/market/ticker");
  } catch {
    return fetchMarketTicksFromBinance();
  }
}

export async function fetchSignals() {
  return requestJson<TradingSignal[]>("/signals");
}

export async function fetchProviderStatuses() {
  return requestJson<ProviderStatusSnapshot[]>("/market/providers/status");
}

export async function fetchPositions() {
  return requestJson<Position[]>("/positions");
}

export async function fetchAlerts() {
  return requestJson<AlertEvent[]>("/alerts");
}

export async function fetchSentimentSnapshot() {
  return requestJson<SentimentSnapshot>("/sentiment/fear-greed");
}

export async function fetchWhaleEvents() {
  return requestJson<WhaleEvent[]>("/whales/events");
}

export async function fetchPaperSummary() {
  return requestJson<PaperSummary>("/paper/summary");
}

export async function openPaperOrder(payload: PaperOrderPayload) {
  return requestJson<unknown>("/orders/paper", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

// New specific API functions for backtests and metrics
export async function getBacktests(): Promise<BacktestWithMetrics[]> {
  return requestJsonWithRetry<BacktestWithMetrics[]>("/backtests");
}

export async function createBacktest(params: CreateBacktestRequest): Promise<Backtest> {
  return requestJsonWithRetry<Backtest>("/backtests", {
    body: JSON.stringify(params),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

export async function getMetrics(): Promise<PerformanceMetrics> {
  return requestJsonWithRetry<PerformanceMetrics>("/metrics/performance");
}

// Helper function to create timeout promise
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error: ApiFailure = {
        message: `Request timeout after ${timeoutMs}ms`,
        code: "TIMEOUT",
        isTimeout: true
      };
      reject(error);
    }, timeoutMs);
  });
}

// Helper function to check if error is retryable
function isRetryableError(error: ApiFailure): boolean {
  // Retry on network errors, timeouts, and 5xx server errors
  if (error.isNetworkError || error.isTimeout) {
    return true;
  }
  if (error.statusCode && error.statusCode >= 500 && error.statusCode < 600) {
    return true;
  }
  // Also retry on 429 (rate limit)
  if (error.statusCode === 429) {
    return true;
  }
  return false;
}

// Helper function to calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY * Math.pow(2, attempt);
}

// Helper function to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Wrapper function with retry logic and exponential backoff
export async function requestJsonWithRetry<T>(
  path: string,
  init?: RequestInit,
  retryCount = 0
): Promise<T> {
  try {
    return await Promise.race([
      requestJson<T>(path, init),
      createTimeoutPromise(REQUEST_TIMEOUT)
    ]);
  } catch (error) {
    const apiError = error as ApiFailure;

    // If we haven't exceeded max retries and error is retryable, retry
    if (retryCount < MAX_RETRIES && isRetryableError(apiError)) {
      const delay = getRetryDelay(retryCount);
      await sleep(delay);
      return requestJsonWithRetry<T>(path, init, retryCount + 1);
    }

    // Otherwise, throw the error
    throw apiError;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = localStorage.getItem("accessToken");
  const headers = new Headers(init?.headers);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers
    });
  } catch (error) {
    // Network error (no response received)
    const networkError: ApiFailure = {
      message: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
      isNetworkError: true
    };
    throw networkError;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof (payload as ApiErrorResponse | null)?.error?.message === "string"
        ? (payload as ApiErrorResponse).error.message
        : typeof payload?.message === "string"
          ? payload.message
          : `HTTP ${response.status}`;

    const apiError: ApiFailure = {
      message,
      code: (payload as any)?.error?.code || (payload as any)?.code,
      statusCode: response.status
    };
    throw apiError;
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiSuccessResponse<T>).data;
  }

  return payload as T;
}

async function fetchMarketTicksFromBinance(): Promise<MarketTick[]> {
  const symbols = ["BTCUSDT", "ETHUSDT"];

  const responses = await Promise.all(
    symbols.map(async (symbol) => {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`Binance ticker failed for ${symbol}: HTTP ${response.status}`);
      }
      return response.json() as Promise<{
        symbol: string;
        lastPrice: string;
        priceChangePercent: string;
        volume: string;
        closeTime: number;
      }>;
    })
  );

  return responses.map((ticker) => ({
    symbol: ticker.symbol.replace("USDT", "-USDT"),
    price: Number(ticker.lastPrice),
    change24hPct: Number(ticker.priceChangePercent),
    volume24h: Number(ticker.volume),
    timestamp: ticker.closeTime ?? Date.now(),
    source: "binance" as const
  }));
}
