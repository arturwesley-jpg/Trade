import {
  BinanceMarketStream,
  BybitMarketStream,
  CoinbaseMarketStream,
  CoinLoreClient,
  CoinMarketCapClient,
  CoinPaprikaClient,
  DefiLlamaClient,
  DexScreenerClient,
  KrakenMarketStream,
  OKXMarketStream,
  createEmptyMarketContext
} from "@trade/exchange";
import {
  RedisPublisher,
  type ConsensusTick,
  type MarketContextSnapshot,
  type MarketDataSource,
  type MarketTick,
  type ProviderQuote,
  type ProviderStatusSnapshot,
  type TradingSignal
} from "@trade/shared";
import { logger } from "@trade/shared/logger";
import type { TradingWebSocketServer } from "../websocket.js";
import { RealTimeConsensusService } from "./realtime-consensus.js";

export interface MarketStreamServiceOptions {
  wsServer: TradingWebSocketServer;
  symbols: string[];
  primaryExchange?: "binance" | "kraken" | "okx" | "bybit" | "coinbase";
  enableMultiSource?: boolean;
  cacheSize?: number;
  redisPubSub?: boolean;
  onConsensusTick?: (tick: ConsensusTick) => void;
}

interface TickCache<T> {
  ticks: T[];
  lastUpdate: number;
}

interface StreamStats {
  symbol: string;
  tickCount: number;
  lastTick: number;
  errors: number;
  source: string;
}

type ManagedStream = { connect: () => void; close: () => void };

const STREAM_PROVIDERS: MarketDataSource[] = ["binance", "bybit", "okx", "kraken", "coinbase"];
const REST_PROVIDER_SOURCES: MarketDataSource[] = ["coinlore", "coinpaprika", "coinmarketcap"];

export class MarketStreamService {
  private readonly wsServer: TradingWebSocketServer;
  private readonly symbols: string[];
  private readonly cacheSize: number;
  private readonly redisPubSub: boolean;
  private readonly primaryExchange: string;
  private readonly onConsensusTick?: (tick: ConsensusTick) => void;
  private readonly consensus: RealTimeConsensusService;
  private readonly restContext: MarketContextSnapshot = createEmptyMarketContext();
  private readonly streamFactories = new Map<MarketDataSource, () => ManagedStream>();
  private readonly streams = new Map<MarketDataSource, ManagedStream>();
  private readonly tickCache = new Map<string, TickCache<MarketTick>>();
  private readonly consensusCache = new Map<string, TickCache<ConsensusTick>>();
  private readonly stats = new Map<string, StreamStats>();
  private readonly providerStatusBySymbol = new Map<string, ProviderStatusSnapshot>();
  private readonly lastSignalBySymbol = new Map<string, TradingSignal>();
  private readonly restTimers: NodeJS.Timeout[] = [];
  private redisPublisher?: RedisPublisher;

  private readonly RATE_LIMIT_MS = 1000;
  private readonly MAX_CACHE_SIZE = 100;
  private readonly signalEmissionCooldown = new Map<string, number>();

  constructor(options: MarketStreamServiceOptions) {
    this.wsServer = options.wsServer;
    this.symbols = options.symbols;
    this.cacheSize = options.cacheSize ?? this.MAX_CACHE_SIZE;
    this.redisPubSub = options.redisPubSub ?? true;
    this.primaryExchange = options.primaryExchange ?? "binance";
    this.onConsensusTick = options.onConsensusTick;
    this.consensus = new RealTimeConsensusService({
      symbols: this.symbols,
      providers: [...STREAM_PROVIDERS, ...REST_PROVIDER_SOURCES],
      primaryProviders: ["binance", "bybit", "okx"],
      minSourcesForSignal: Number(process.env.MIN_SOURCES_FOR_SIGNAL ?? 3),
      maxSpreadOkPct: Number(process.env.MAX_SPREAD_OK_PCT ?? 0.35),
      websocketFreshnessMs: 30_000,
      restFreshnessMs: 600_000,
      staleAfterMs: Number(process.env.PROVIDER_STALE_AFTER_MS ?? 30_000)
    });

    for (const symbol of this.symbols) {
      this.tickCache.set(symbol, { ticks: [], lastUpdate: 0 });
      this.consensusCache.set(symbol, { ticks: [], lastUpdate: 0 });
      this.stats.set(symbol, {
        symbol,
        tickCount: 0,
        lastTick: 0,
        errors: 0,
        source: this.primaryExchange
      });
    }

    this.registerStreamFactories();
    logger.info({ symbols: this.symbols }, "MarketStreamService initialized");
  }

  async start(): Promise<void> {
    if (this.redisPubSub) {
      this.redisPublisher = new RedisPublisher({
        onError: (error) => logger.error({ err: error }, "Market stream Redis error")
      });
      try {
        await this.redisPublisher.connect();
      } catch (error) {
        logger.warn({ error }, "Redis publisher unavailable for market stream");
      }
    }

    for (const provider of STREAM_PROVIDERS) {
      this.startProviderStream(provider);
    }

    this.startRestPollers();
    logger.info("Market data streams started successfully");
  }

  private registerStreamFactories(): void {
    this.streamFactories.set("binance", () => new BinanceMarketStream({
      url: process.env.BINANCE_WS_URL ?? "wss://stream.binance.com:9443/ws",
      symbols: this.symbols,
      onTick: (tick) => this.handleProviderQuote(this.normalizeTick(tick)),
      onStatus: (message) => this.handleStatus("binance", message)
    }));
    this.streamFactories.set("bybit", () => new BybitMarketStream({
      url: process.env.BYBIT_WS_URL ?? "wss://stream.bybit.com/v5/public/spot",
      symbols: this.symbols,
      onTick: (tick) => this.handleProviderQuote(this.normalizeTick(tick)),
      onStatus: (message) => this.handleStatus("bybit", message)
    }));
    this.streamFactories.set("okx", () => new OKXMarketStream({
      url: process.env.OKX_WS_URL ?? "wss://ws.okx.com:8443/ws/v5/public",
      symbols: this.symbols,
      onTick: (tick) => this.handleProviderQuote(this.normalizeTick(tick)),
      onStatus: (message) => this.handleStatus("okx", message)
    }));
    this.streamFactories.set("kraken", () => new KrakenMarketStream({
      url: process.env.KRAKEN_WS_URL ?? "wss://ws.kraken.com",
      symbols: this.symbols.map(toKrakenSymbol),
      onTick: (tick) => this.handleProviderQuote(this.normalizeTick(tick)),
      onStatus: (message) => this.handleStatus("kraken", message)
    }));
    this.streamFactories.set("coinbase", () => new CoinbaseMarketStream({
      url: process.env.COINBASE_WS_URL ?? "wss://advanced-trade-ws.coinbase.com",
      symbols: this.symbols,
      onTick: (tick) => this.handleProviderQuote(this.normalizeTick(tick)),
      onStatus: (message) => this.handleStatus("coinbase", message)
    }));
  }

  private startProviderStream(provider: MarketDataSource): void {
    if (this.streams.has(provider)) return;
    const factory = this.streamFactories.get(provider);
    if (!factory) return;
    const stream = factory();
    this.streams.set(provider, stream);
    stream.connect();
  }

  private normalizeTick(tick: MarketTick): ProviderQuote {
    return {
      ...tick,
      symbol: normalizeSymbol(tick.symbol),
      exchange: tick.exchange ?? tick.source,
      latencyMs: Math.max(0, Date.now() - tick.timestamp)
    };
  }

  private async handleProviderQuote(quote: ProviderQuote): Promise<void> {
    const stats = this.stats.get(quote.symbol);
    if (stats) {
      stats.tickCount++;
      stats.lastTick = Date.now();
      stats.source = quote.source;
    }

    this.addToCache(this.tickCache, quote.symbol, quote);

    const { consensusTick, signal, providerStatus } = this.consensus.ingestQuote(quote);
    this.providerStatusBySymbol.set(quote.symbol, providerStatus);
    const shouldEmitSignal = this.shouldEmitSignal(signal);
    this.lastSignalBySymbol.set(quote.symbol, signal);

    await this.broadcastRawTick(quote);
    await this.publishJson("market:ticks.raw", quote);

    this.wsServer.broadcastToChannel("providers:status", providerStatus);
    await this.publishJson("market:provider-status", providerStatus);

    if (consensusTick) {
      this.addToCache(this.consensusCache, quote.symbol, consensusTick);
      this.onConsensusTick?.(consensusTick);
      await this.broadcastConsensusTick(consensusTick);
      await this.publishJson("market:ticks", consensusTick);
      await this.publishJson("market:ticks.consensus", consensusTick);
      await this.publishJson(`market:ticks.consensus.${quote.symbol}`, consensusTick);
    } else {
      await this.publishJson("market:ticks", quote);
    }

    if (shouldEmitSignal) {
      this.wsServer.broadcastSignalUpdate(signal);
      await this.publishJson("market:signals", signal);
    }
  }

  private handleStatus(provider: MarketDataSource, message: string): void {
    logger.info({ provider, message }, "Exchange stream status");
    if (!message.startsWith("error:") && message !== "closed") return;

    for (const symbol of this.symbols) {
      const status = this.consensus.recordProviderError(symbol, provider, message);
      this.providerStatusBySymbol.set(symbol, status);
      this.wsServer.broadcastToChannel("providers:status", status);
      void this.publishJson("market:provider-status", status);

      const stat = this.stats.get(symbol);
      if (stat) stat.errors++;
    }

    const existing = this.streams.get(provider);
    if (existing) {
      try {
        existing.close();
      } catch (error) {
        logger.error({ error, provider }, "Failed to close stream during reconnect");
      }
      this.streams.delete(provider);
    }

    const timer = setTimeout(() => this.startProviderStream(provider), 5000);
    this.restTimers.push(timer);
  }

  private startRestPollers(): void {
    const coinLore = new CoinLoreClient();
    const coinPaprika = new CoinPaprikaClient();
    const dexScreener = new DexScreenerClient();
    const defiLlama = new DefiLlamaClient();
    const coinMarketCap = new CoinMarketCapClient(process.env.CMC_API_KEY ?? "");
    const paprikaMap = buildCoinPaprikaMap(this.symbols);
    const dexQueries = (process.env.DEXSCREENER_QUERIES ?? "SOL/USDC,WETH/USDC,BTC/USDT")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    this.schedulePoller(async () => {
      const quotes = await coinLore.getQuotes(this.symbols);
      this.restContext.coinlore = quotes;
      this.restContext.updatedAt = Date.now();
      for (const quote of Object.values(quotes)) {
        await this.handleProviderQuote(quote);
      }
    }, Number(process.env.COINLORE_POLL_SECONDS ?? 60) * 1000);

    this.schedulePoller(async () => {
      const quotes = await coinPaprika.getTickersById(paprikaMap);
      this.restContext.coinpaprikaTickers = quotes;
      this.restContext.updatedAt = Date.now();
      for (const quote of Object.values(quotes)) {
        await this.handleProviderQuote(quote);
      }
    }, Number(process.env.COINPAPRIKA_TICKERS_POLL_SECONDS ?? 180) * 1000);

    this.schedulePoller(async () => {
      this.restContext.coinpaprikaGlobal = await coinPaprika.getGlobal();
      this.restContext.updatedAt = Date.now();
      await this.publishJson("market:context", this.restContext);
    }, Number(process.env.COINPAPRIKA_GLOBAL_POLL_SECONDS ?? 600) * 1000);

    this.schedulePoller(async () => {
      this.restContext.dexscreener = await dexScreener.search(dexQueries);
      this.restContext.updatedAt = Date.now();
      await this.publishJson("market:context", this.restContext);
    }, Number(process.env.DEXSCREENER_POLL_SECONDS ?? 120) * 1000);

    this.schedulePoller(async () => {
      this.restContext.defillama = await defiLlama.getProtocols();
      this.restContext.updatedAt = Date.now();
      await this.publishJson("market:context", this.restContext);
    }, Number(process.env.DEFILLAMA_POLL_SECONDS ?? 300) * 1000);

    if (process.env.CMC_API_KEY) {
      this.schedulePoller(async () => {
        this.restContext.coinmarketcap = await coinMarketCap.getQuotes(this.symbols.map((symbol) => symbol.split("-")[0]!));
        this.restContext.updatedAt = Date.now();
        await this.publishJson("market:context", this.restContext);
      }, Number(process.env.CMC_POLL_SECONDS ?? 300) * 1000);
    }
  }

  private schedulePoller(task: () => Promise<void>, intervalMs: number): void {
    const execute = async () => {
      try {
        await task();
      } catch (error) {
        logger.warn({ error }, "REST poller failed");
      }
    };
    void execute();
    const timer = setInterval(() => {
      void execute();
    }, intervalMs);
    this.restTimers.push(timer);
  }

  private addToCache<T extends MarketTick>(cacheMap: Map<string, TickCache<T>>, symbol: string, tick: T): void {
    const cache = cacheMap.get(symbol);
    if (!cache) return;
    cache.ticks.push(tick);
    cache.lastUpdate = Date.now();
    if (cache.ticks.length > this.cacheSize) {
      cache.ticks = cache.ticks.slice(-this.cacheSize);
    }
  }

  private async broadcastRawTick(tick: MarketTick): Promise<void> {
    this.wsServer.broadcastToChannel(`market_raw:${tick.symbol}`, tick);
  }

  private async broadcastConsensusTick(tick: ConsensusTick): Promise<void> {
    const lastEmit = this.signalEmissionCooldown.get(`tick:${tick.symbol}`) ?? 0;
    if (Date.now() - lastEmit < this.RATE_LIMIT_MS) return;
    this.signalEmissionCooldown.set(`tick:${tick.symbol}`, Date.now());
    this.wsServer.broadcastMarketTick(tick);
  }

  private shouldEmitSignal(signal: TradingSignal): boolean {
    const current = this.lastSignalBySymbol.get(signal.symbol);
    const lastEmit = this.signalEmissionCooldown.get(`signal:${signal.symbol}`) ?? 0;
    if (!current) {
      this.signalEmissionCooldown.set(`signal:${signal.symbol}`, Date.now());
      return true;
    }
    const changed = current.status !== signal.status || current.reason !== signal.reason || current.medianPrice !== signal.medianPrice;
    if (changed || Date.now() - lastEmit > 15_000) {
      this.signalEmissionCooldown.set(`signal:${signal.symbol}`, Date.now());
      return true;
    }
    return false;
  }

  private async publishJson(channel: string, payload: unknown): Promise<void> {
    if (!this.redisPublisher?.isConnected()) return;
    try {
      await this.redisPublisher.publish(channel, payload);
    } catch (error) {
      logger.error({ error, channel }, "Failed to publish market payload");
    }
  }

  getRecentTicks(symbol: string, limit?: number, mode: "raw" | "consensus" = "consensus"): Array<MarketTick | ConsensusTick> {
    const cache = mode === "raw" ? this.tickCache.get(symbol) : this.consensusCache.get(symbol);
    if (!cache) return [];
    return limit ? cache.ticks.slice(-limit) : cache.ticks;
  }

  getStats(): Array<StreamStats & { providerStatus?: ProviderStatusSnapshot | null }> {
    return Array.from(this.stats.values()).map((stat) => ({
      ...stat,
      providerStatus: this.providerStatusBySymbol.get(stat.symbol) ?? null
    }));
  }

  getSignals(): TradingSignal[] {
    return this.consensus.getSignals();
  }

  getSignal(symbol: string): TradingSignal | null {
    return this.consensus.getLatestSignal(symbol);
  }

  getProviderStatuses(): ProviderStatusSnapshot[] {
    return this.consensus.getProviderStatuses();
  }

  getMarketContext(): MarketContextSnapshot {
    return this.restContext;
  }

  getSymbols(): string[] {
    return this.symbols;
  }

  async stop(): Promise<void> {
    for (const timer of this.restTimers) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    this.restTimers.length = 0;

    for (const stream of this.streams.values()) {
      stream.close();
    }
    this.streams.clear();

    if (this.redisPublisher) {
      await this.redisPublisher.disconnect();
      this.redisPublisher = undefined;
    }
  }
}

function normalizeSymbol(symbol: string): string {
  if (symbol.includes("/")) {
    const [base, quote] = symbol.split("/");
    return `${base}-${quote}`.toUpperCase();
  }
  return symbol.toUpperCase();
}

function toKrakenSymbol(symbol: string): string {
  return symbol.replace("-", "/");
}

function buildCoinPaprikaMap(symbols: string[]): Record<string, string> {
  const explicit: Record<string, string> = {
    "btc-bitcoin": "BTC-USDT",
    "eth-ethereum": "ETH-USDT",
    "sol-solana": "SOL-USDT"
  };
  const result: Record<string, string> = {};
  for (const [id, symbol] of Object.entries(explicit)) {
    if (symbols.includes(symbol)) result[id] = symbol;
  }
  return result;
}
