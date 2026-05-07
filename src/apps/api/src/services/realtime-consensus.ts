import { createId, type ConsensusTick, type MarketDataSource, type ProviderQuote, type ProviderStatusSnapshot, type TradingSignal } from "@trade/shared";
import { ProviderSupervisor, type ProviderSupervisorStatus } from "@trade/exchange";

export interface RealTimeConsensusOptions {
  symbols: string[];
  providers: MarketDataSource[];
  primaryProviders?: MarketDataSource[];
  websocketFreshnessMs?: number;
  restFreshnessMs?: number;
  minSourcesForSignal?: number;
  maxSpreadOkPct?: number;
  staleAfterMs?: number;
  now?: () => number;
}

const WEBSOCKET_SOURCES = new Set<MarketDataSource>(["binance", "bingx", "bybit", "okx", "kraken", "coinbase"]);

export class RealTimeConsensusService {
  private readonly now: () => number;
  private readonly quotes = new Map<string, Map<MarketDataSource, ProviderQuote>>();
  private readonly supervisors = new Map<string, ProviderSupervisor>();
  private readonly latestSignals = new Map<string, TradingSignal>();
  private readonly latestConsensus = new Map<string, ConsensusTick>();
  private readonly latestStatuses = new Map<string, ProviderStatusSnapshot>();
  private readonly providers: MarketDataSource[];
  private readonly primaryProviders: Set<MarketDataSource>;
  private readonly websocketFreshnessMs: number;
  private readonly restFreshnessMs: number;
  private readonly minSourcesForSignal: number;
  private readonly maxSpreadOkPct: number;

  constructor(private readonly options: RealTimeConsensusOptions) {
    this.now = options.now ?? Date.now;
    this.providers = options.providers;
    this.primaryProviders = new Set(options.primaryProviders ?? ["binance", "bybit", "okx"]);
    this.websocketFreshnessMs = options.websocketFreshnessMs ?? 30_000;
    this.restFreshnessMs = options.restFreshnessMs ?? 600_000;
    this.minSourcesForSignal = options.minSourcesForSignal ?? 3;
    this.maxSpreadOkPct = options.maxSpreadOkPct ?? 0.35;

    for (const symbol of options.symbols) {
      this.quotes.set(symbol, new Map());
      this.supervisors.set(symbol, new ProviderSupervisor({
        providers: this.providers,
        primaryProvider: this.primaryProviders.values().next().value ?? "binance",
        staleAfterMs: options.staleAfterMs ?? this.websocketFreshnessMs,
        now: this.now
      }));
    }
  }

  ingestQuote(quote: ProviderQuote): { consensusTick: ConsensusTick | null; signal: TradingSignal; providerStatus: ProviderStatusSnapshot } {
    const symbolQuotes = this.ensureSymbolQuotes(quote.symbol);
    symbolQuotes.set(quote.source, quote);

    const supervisor = this.ensureSupervisor(quote.symbol);
    supervisor.recordTick(quote.source, {
      price: quote.price,
      latencyMs: quote.latencyMs ?? Math.max(0, this.now() - quote.timestamp),
      timestamp: quote.timestamp
    });

    const providerStatus = this.buildProviderStatus(quote.symbol, supervisor.status());
    this.latestStatuses.set(quote.symbol, providerStatus);

    const freshQuotes = this.getFreshQuotes(quote.symbol);
    const signal = this.buildSignal(quote.symbol, freshQuotes);
    this.latestSignals.set(quote.symbol, signal);

    const consensusTick = signal.medianPrice === undefined
      ? null
      : {
          symbol: quote.symbol,
          price: signal.medianPrice,
          medianPrice: signal.medianPrice,
          minPrice: signal.minPrice ?? signal.medianPrice,
          maxPrice: signal.maxPrice ?? signal.medianPrice,
          spreadPct: signal.spreadPct ?? 0,
          arbitragePct: signal.arbitragePct,
          providerCount: signal.providerCount ?? 0,
          status: signal.status ?? "AGUARDANDO",
          reason: signal.reason ?? signal.rationale,
          sources: signal.sources ?? [],
          timestamp: this.now(),
          source: "consensus",
          volume24h: this.average(freshQuotes.map((item) => item.volume24h).filter(isNumber)),
          bid: this.max(freshQuotes.map((item) => item.bid).filter(isNumber)),
          ask: this.min(freshQuotes.map((item) => item.ask).filter(isNumber)),
          change24hPct: this.average(freshQuotes.map((item) => item.change24hPct).filter(isNumber))
        };

    if (consensusTick) {
      this.latestConsensus.set(quote.symbol, consensusTick);
    }

    return { consensusTick, signal, providerStatus };
  }

  recordProviderError(symbol: string, provider: MarketDataSource, message: string): ProviderStatusSnapshot {
    const supervisor = this.ensureSupervisor(symbol);
    supervisor.recordError(provider, message);
    const snapshot = this.buildProviderStatus(symbol, supervisor.status());
    this.latestStatuses.set(symbol, snapshot);
    return snapshot;
  }

  getLatestSignal(symbol: string): TradingSignal | null {
    return this.latestSignals.get(symbol) ?? null;
  }

  getSignals(): TradingSignal[] {
    return Array.from(this.latestSignals.values());
  }

  getLatestConsensusTick(symbol: string): ConsensusTick | null {
    return this.latestConsensus.get(symbol) ?? null;
  }

  getProviderStatuses(): ProviderStatusSnapshot[] {
    return Array.from(this.latestStatuses.values());
  }

  getProviderStatus(symbol: string): ProviderStatusSnapshot | null {
    return this.latestStatuses.get(symbol) ?? null;
  }

  private getFreshQuotes(symbol: string): ProviderQuote[] {
    const symbolQuotes = this.ensureSymbolQuotes(symbol);
    const now = this.now();
    return Array.from(symbolQuotes.values()).filter((quote) => {
      const maxAge = WEBSOCKET_SOURCES.has(quote.source) ? this.websocketFreshnessMs : this.restFreshnessMs;
      return now - quote.timestamp <= maxAge && quote.price > 0;
    });
  }

  private buildSignal(symbol: string, quotes: ProviderQuote[]): TradingSignal {
    const prices = quotes.map((quote) => quote.price).filter(isNumber);
    if (prices.length < this.minSourcesForSignal) {
      return {
        id: createId("signal"),
        symbol,
        direction: "NEUTRAL",
        confidence: "low",
        priceChangePct: 0,
        shouldExecute: false,
        rationale: `fontes validas: ${prices.length}`,
        createdAt: new Date(this.now()).toISOString(),
        status: "AGUARDANDO",
        reason: `fontes validas: ${prices.length}`,
        providerCount: prices.length,
        sources: quotes.map((quote) => quote.source)
      };
    }

    const sorted = [...prices].sort((left, right) => left - right);
    const medianPrice = sorted[Math.floor(sorted.length / 2)] ?? prices[0]!;
    const minPrice = sorted[0]!;
    const maxPrice = sorted[sorted.length - 1]!;
    const spreadPct = medianPrice > 0 ? ((maxPrice - minPrice) / medianPrice) * 100 : 0;
    const bestBid = this.max(quotes.map((quote) => quote.bid).filter(isNumber));
    const bestAsk = this.min(quotes.map((quote) => quote.ask).filter(isNumber));
    const arbitragePct = bestBid !== undefined && bestAsk !== undefined && bestBid > bestAsk
      ? ((bestBid - bestAsk) / medianPrice) * 100
      : 0;
    const sources = quotes.map((quote) => quote.source);
    const primaryConfirmation = sources.filter((source) => this.primaryProviders.has(source)).length >= 2;

    let status: TradingSignal["status"] = "PRECO VALIDADO";
    let reason = `consenso ok; spread ${spreadPct.toFixed(3)}%`;
    let confidence: TradingSignal["confidence"] = "high";

    if (spreadPct > this.maxSpreadOkPct) {
      status = "SEM SINAL";
      reason = `divergencia alta entre fontes: ${spreadPct.toFixed(3)}%`;
      confidence = "low";
    } else if (!primaryConfirmation) {
      status = "SINAL FRACO";
      reason = "sem confirmacao suficiente entre Binance/Bybit/OKX";
      confidence = "medium";
    } else if (arbitragePct > 0.05) {
      status = "ALERTA ARBITRAGEM";
      reason = `best_bid > best_ask em ~${arbitragePct.toFixed(3)}%`;
      confidence = "medium";
    }

    return {
      id: createId("signal"),
      symbol,
      direction: status === "PRECO VALIDADO" ? "WATCH_LONG" : "NEUTRAL",
      confidence,
      priceChangePct: 0,
      shouldExecute: false,
      rationale: reason,
      createdAt: new Date(this.now()).toISOString(),
      status,
      reason,
      medianPrice,
      minPrice,
      maxPrice,
      spreadPct: round(spreadPct),
      arbitragePct: round(arbitragePct),
      sources,
      providerCount: quotes.length
    };
  }

  private buildProviderStatus(symbol: string, status: ProviderSupervisorStatus): ProviderStatusSnapshot {
    return {
      symbol,
      recommendedProvider: status.recommendedProvider,
      failoverOrder: status.failoverOrder,
      providers: status.providers,
      dataQualityScore: status.dataQualityScore,
      disagreementScore: status.disagreementScore,
      shouldEmitWait: status.shouldEmitWait,
      updatedAt: this.now()
    };
  }

  private ensureSymbolQuotes(symbol: string): Map<MarketDataSource, ProviderQuote> {
    const existing = this.quotes.get(symbol);
    if (existing) return existing;
    const created = new Map<MarketDataSource, ProviderQuote>();
    this.quotes.set(symbol, created);
    return created;
  }

  private ensureSupervisor(symbol: string): ProviderSupervisor {
    const existing = this.supervisors.get(symbol);
    if (existing) return existing;
    const created = new ProviderSupervisor({
      providers: this.providers,
      primaryProvider: this.primaryProviders.values().next().value ?? "binance",
      staleAfterMs: this.websocketFreshnessMs,
      now: this.now
    });
    this.supervisors.set(symbol, created);
    return created;
  }

  private average(values: number[]): number | undefined {
    if (values.length === 0) return undefined;
    return round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private min(values: number[]): number | undefined {
    return values.length ? Math.min(...values) : undefined;
  }

  private max(values: number[]): number | undefined {
    return values.length ? Math.max(...values) : undefined;
  }
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
