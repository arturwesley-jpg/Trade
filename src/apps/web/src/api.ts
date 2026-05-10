import type {
  AlertEvent,
  ApiErrorResponse,
  ApiSuccessResponse,
  MarketTick,
  PaperSummary,
  Position,
  ProviderStatusSnapshot,
  NewsIntelligenceSnapshot,
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
const NEWS_CACHE_TTL_MS = 3 * 60 * 1000;
const SIGNALS_CACHE_TTL_MS = 60 * 1000;
const WHALES_CACHE_TTL_MS = 45 * 1000;
let newsCache: { data: NewsIntelligenceSnapshot; updatedAt: number } | null = null;
let signalsCache: { data: TradingSignal[]; updatedAt: number } | null = null;
let whalesCache: { data: WhaleEvent[]; updatedAt: number } | null = null;

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
  if (signalsCache && Date.now() - signalsCache.updatedAt < SIGNALS_CACHE_TTL_MS) {
    return signalsCache.data;
  }
  try {
    const data = await requestJson<TradingSignal[]>("/signals");
    signalsCache = { data, updatedAt: Date.now() };
    return data;
  } catch {
    const data = await fetchSignalsFromBinance();
    signalsCache = { data, updatedAt: Date.now() };
    return data;
  }
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
  if (whalesCache && Date.now() - whalesCache.updatedAt < WHALES_CACHE_TTL_MS) {
    return whalesCache.data;
  }
  try {
    const data = await requestJson<WhaleEvent[]>("/whales/events");
    whalesCache = { data, updatedAt: Date.now() };
    return data;
  } catch {
    const data = await fetchWhaleEventsFromBinance();
    whalesCache = { data, updatedAt: Date.now() };
    return data;
  }
}

export async function fetchPaperSummary() {
  return requestJson<PaperSummary>("/paper/summary");
}

export async function fetchNewsIntelligence() {
  if (newsCache && Date.now() - newsCache.updatedAt < NEWS_CACHE_TTL_MS) {
    return newsCache.data;
  }

  try {
    const data = await requestJson<NewsIntelligenceSnapshot>("/market/news-intelligence");
    newsCache = { data, updatedAt: Date.now() };
    return data;
  } catch {
    const data = await fetchNewsIntelligenceFromPublicFeeds();
    newsCache = { data, updatedAt: Date.now() };
    return data;
  }
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

async function fetchNewsIntelligenceFromPublicFeeds(): Promise<NewsIntelligenceSnapshot> {
  const feeds: Array<{ source: string; url: string }> = [
    { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
    { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
    { source: "Decrypt", url: "https://decrypt.co/feed" },
    { source: "The Block", url: "https://www.theblock.co/rss.xml" },
    { source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/" },
    { source: "BeInCrypto", url: "https://beincrypto.com/feed/" },
    { source: "NewsBTC", url: "https://www.newsbtc.com/feed/" },
    { source: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
    { source: "AMBCrypto", url: "https://ambcrypto.com/feed/" },
    { source: "U.Today", url: "https://u.today/rss" },
    { source: "Blockworks", url: "https://blockworks.co/feed/" },
    { source: "Messari", url: "https://messari.io/rss" }
  ];

  const bullish = ["surge", "rally", "breakout", "bullish", "approval", "adoption", "inflow", "accumulation", "ath", "recovery"];
  const bearish = ["crash", "dump", "selloff", "bearish", "outflow", "liquidation", "hack", "ban", "lawsuit", "decline"];

  function scoreTitle(title: string): { sentiment: "BULLISH" | "BEARISH" | "NEUTRAL"; score: number } {
    const t = title.toLowerCase();
    let score = 0;
    for (const k of bullish) if (t.includes(k)) score += 12;
    for (const k of bearish) if (t.includes(k)) score -= 12;
    if (score >= 15) return { sentiment: "BULLISH", score: Math.min(100, score) };
    if (score <= -15) return { sentiment: "BEARISH", score: Math.max(-100, score) };
    return { sentiment: "NEUTRAL", score };
  }

  const articles = (
    await Promise.all(
      feeds.map(async (feed) => {
        try {
          const proxied = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
          const response = await fetch(proxied);
          if (!response.ok) return [];
          const payload = await response.json() as { items?: Array<{ title?: string; link?: string; pubDate?: string }> };
          const items = (payload.items ?? []).slice(0, 4);
          return items.map((item) => {
            const title = item.title?.trim() ?? `${feed.source} update`;
            const link = item.link?.trim() ?? "";
            const publishedRaw = item.pubDate?.trim() ?? new Date().toISOString();
            const parsedDate = Date.parse(publishedRaw);
            const publishedAt = Number.isNaN(parsedDate) ? new Date().toISOString() : new Date(parsedDate).toISOString();
            const scored = scoreTitle(title);
            return {
              title,
              link,
              source: feed.source,
              publishedAt,
              sentiment: scored.sentiment,
              score: scored.score
            };
          });
        } catch {
          return [];
        }
      })
    )
  ).flat();

  const dedup = new Map<string, (typeof articles)[number]>();
  for (const article of articles) {
    const key = article.link || `${article.source}:${article.title}`;
    if (!dedup.has(key)) dedup.set(key, article);
  }
  const items = Array.from(dedup.values())
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 40);

  const bullishCount = items.filter((x) => x.sentiment === "BULLISH").length;
  const bearishCount = items.filter((x) => x.sentiment === "BEARISH").length;
  const neutralCount = items.filter((x) => x.sentiment === "NEUTRAL").length;
  const averageScore = items.length ? items.reduce((sum, x) => sum + x.score, 0) / items.length : 0;
  const sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = averageScore >= 10 ? "BULLISH" : averageScore <= -10 ? "BEARISH" : "NEUTRAL";
  const confidence = Math.min(100, Math.round((Math.abs(averageScore) + items.length) * 1.6));

  return {
    generatedAt: new Date().toISOString(),
    channelCount: feeds.length,
    totalArticles: items.length,
    sentiment,
    confidence,
    bullishCount,
    bearishCount,
    neutralCount,
    averageScore: Number(averageScore.toFixed(2)),
    topSignals: items.slice(0, 5).map((x) => `${x.source}: ${x.title}`),
    items
  };
}

async function fetchSignalsFromBinance(): Promise<TradingSignal[]> {
  const symbols = ["BTCUSDT", "ETHUSDT"];
  const now = Date.now();

  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=80`);
      if (!response.ok) {
        throw new Error(`Failed to fetch klines for ${symbol}`);
      }
      const klines = await response.json() as Array<[number, string, string, string, string, string]>;
      const closes = klines.map((k) => Number(k[4]));
      const current = closes[closes.length - 1] ?? 0;
      const prev = closes[closes.length - 2] ?? current;
      const changePct = prev > 0 ? ((current - prev) / prev) * 100 : 0;
      const sma20 = average(closes.slice(-20));
      const sma50 = average(closes.slice(-50));
      const rsi14 = computeRsi(closes.slice(-15));

      const bullishSignals = Number(current > sma20) + Number(sma20 > sma50) + Number(rsi14 > 52) + Number(changePct > 0);
      const bearishSignals = 4 - bullishSignals;
      const direction: TradingSignal["direction"] = bullishSignals >= 3 ? "WATCH_LONG" : "NEUTRAL";
      const confidenceValue = Math.max(0, Math.min(1, 0.45 + bullishSignals * 0.12 - bearishSignals * 0.04));
      const confidence: TradingSignal["confidence"] =
        confidenceValue >= 0.75 ? "high" : confidenceValue >= 0.55 ? "medium" : "low";

      return {
        id: `binance-${symbol}-${now}`,
        symbol: symbol.replace("USDT", "-USDT"),
        direction,
        confidence,
        priceChangePct: Number(changePct.toFixed(3)),
        shouldExecute: false,
        rationale: `Confluencia: preco ${current > sma20 ? "acima" : "abaixo"} da SMA20, SMA20 ${sma20 > sma50 ? "acima" : "abaixo"} da SMA50, RSI ${rsi14.toFixed(1)}.`,
        createdAt: new Date(now).toISOString(),
        status: direction === "WATCH_LONG" ? "PRECO VALIDADO" : "SEM SINAL",
        reason: direction === "WATCH_LONG" ? "Confluencia tecnica favoravel (Binance 15m)" : "Confluencia incompleta"
      } satisfies TradingSignal;
    })
  );

  return rows;
}

async function fetchWhaleEventsFromBinance(): Promise<WhaleEvent[]> {
  const symbols = ["BTCUSDT", "ETHUSDT"];
  const minNotional = 500_000;

  const events = (
    await Promise.all(
      symbols.map(async (symbol) => {
        const response = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=1000`);
        if (!response.ok) {
          throw new Error(`Failed to fetch aggTrades for ${symbol}`);
        }
        const trades = await response.json() as Array<{
          a: number; // agg id
          p: string; // price
          q: string; // qty
          T: number; // time
          m: boolean; // buyer maker
        }>;

        return trades
          .map((t) => {
            const price = Number(t.p);
            const qty = Number(t.q);
            const valueUsd = price * qty;
            if (!Number.isFinite(valueUsd) || valueUsd < minNotional) {
              return null;
            }
            const severity: WhaleEvent["severity"] = valueUsd >= 5_000_000 ? "high" : valueUsd >= 1_500_000 ? "medium" : "low";
            const type: WhaleEvent["type"] = t.m ? "DISTRIBUTION" : "ACCUMULATION";
            return {
              id: `${symbol}-${t.a}`,
              type,
              symbol: symbol.replace("USDT", "-USDT"),
              valueUsd,
              severity,
              source: "external" as const,
              timestamp: new Date(t.T).toISOString()
            } satisfies WhaleEvent;
          })
          .filter((x): x is WhaleEvent => x !== null);
      })
    )
  )
    .flat()
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 40);

  return events;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeRsi(closes: number[]): number {
  if (closes.length < 2) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / (closes.length - 1);
  const avgLoss = losses / (closes.length - 1);
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
