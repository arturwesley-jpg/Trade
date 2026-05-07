import {
  BinanceTickerProvider,
  BybitTickerProvider,
  type MarketDataProvider,
  OKXTickerProvider,
  KrakenTickerProvider,
  PollingMarketDataSupervisor,
  ProviderSupervisor,
  SimulatedMarketDataProvider
} from "@trade/exchange";
import type { MarketTick } from "@trade/shared";
import { RedisPublisher, logger, metrics, healthChecker } from "@trade/shared";
import { Client } from "pg";
import { JsonFileTradingRepository, PaperExecutor, PositionMonitor, PostgresTradingRepository } from "@trade/trading-core";

// Initialize logger for worker service
const workerLogger = logger;
workerLogger.setContext({ service: "worker" });

export function resolveProviderNames(rawProviders: string | undefined, useSimulatedFeed: boolean): string[] {
  return (rawProviders ?? (useSimulatedFeed ? "simulated" : "binance,bybit,okx,kraken"))
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
}

function createTickLogger(
  repository: Awaited<ReturnType<typeof buildRepository>>,
  supervisor: ProviderSupervisor,
  redisPublisher: RedisPublisherLike,
  publishLegacyMarketAlias: boolean,
  positionMonitor: PositionMonitor | null
) {
  return (tick: MarketTick): void => {
  repository?.saveMarketTick(tick);
  supervisor.recordTick(tick.source, {
    price: tick.price,
    latencyMs: Math.max(0, Date.now() - tick.timestamp),
    timestamp: tick.timestamp
  });
  console.log(JSON.stringify({ event: "market_tick", tick, providerStatus: supervisor.status() }));

  // Check positions for auto-close
  if (positionMonitor) {
    const priceMap = new Map([[tick.symbol, tick.price]]);
    positionMonitor.checkPositions(priceMap).then((events) => {
      for (const event of events) {
        console.log(JSON.stringify({ event: "position_auto_closed", data: event }));
      }
    }).catch((error) => {
      console.error("Position monitor error:", error);
    });
  }

  // Publish to Redis
  if (redisPublisher.isConnected()) {
    redisPublisher.publish("market:ticks.raw", tick).catch((error) => {
      console.error("Failed to publish tick to Redis:", error);
    });
    if (publishLegacyMarketAlias) {
      redisPublisher.publish("market:ticks", tick).catch((error) => {
        console.error("Failed to publish tick to Redis:", error);
      });
    }
  }
  };
}

export function buildPollingProviders(providerNames: string[], symbols: string[]): MarketDataProvider[] {
  const prices = Object.fromEntries(symbols.map((symbol) => [
    symbol,
    symbol.startsWith("BTC") ? 100_000 : symbol.startsWith("ETH") ? 3_000 : 150
  ]));
  const providers = providerNames.flatMap((providerName): MarketDataProvider[] => {
    if (providerName === "binance") return [new BinanceTickerProvider()];
    if (providerName === "bybit") return [new BybitTickerProvider()];
    if (providerName === "okx") return [new OKXTickerProvider()];
    if (providerName === "kraken") return [new KrakenTickerProvider()];
    if (providerName === "simulated") return [new SimulatedMarketDataProvider({ prices })];
    console.log(JSON.stringify({ event: "market_provider_ignored", provider: providerName }));
    return [];
  });
  return providers.length ? providers : [new SimulatedMarketDataProvider({ prices })];
}

async function buildRepository() {
  const options = { maxMarketTicks: Number(process.env.MAX_MARKET_TICKS ?? 1_000) };
  if (process.env.DATABASE_URL) {
    workerLogger.info("Using PostgreSQL repository");
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    // Register PostgreSQL for health checks
    healthChecker.register("postgres", async () => {
      try {
        const start = Date.now();
        await client.query("SELECT 1");
        const responseTime = Date.now() - start;

        return {
          status: responseTime < 100 ? "healthy" : "degraded",
          message: `PostgreSQL responding in ${responseTime}ms`,
          metadata: { responseTime }
        };
      } catch (error) {
        return {
          status: "unhealthy",
          message: error instanceof Error ? error.message : "PostgreSQL connection failed"
        };
      }
    });

    return PostgresTradingRepository.create(client, options);
  }
  workerLogger.warn("DATABASE_URL not set, falling back to file-based repository");
  return storePath ? new JsonFileTradingRepository(storePath, options) : null;
}

type PollingSupervisorLike = {
  poll: (symbols: string[]) => Promise<{ ticks: MarketTick[]; errors: unknown[]; status: unknown }>;
};

type RedisPublisherLike = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: () => boolean;
  publish: (channel: string, payload: unknown) => Promise<void>;
};

type StartWorkerOptions = {
  symbols: string[];
  providerNames: string[];
  pollIntervalMs: number;
  publishLegacyMarketAlias?: boolean;
  redisPublisher?: RedisPublisherLike;
  onSignal?: (event: "SIGINT" | "SIGTERM", listener: () => void | Promise<void>) => void;
  setIntervalFn?: (callback: () => void, delayMs: number) => unknown;
  createPollingSupervisor?: (providers: MarketDataProvider[]) => PollingSupervisorLike;
};

export async function startWorker(options: StartWorkerOptions) {
  const repository = await buildRepository();
  const redisPublisher = options.redisPublisher ?? new RedisPublisher({
    onError: (error) => {
      workerLogger.error({ err: error }, "Redis publisher error");
    }
  });
  const supervisor = new ProviderSupervisor({
    providers: ["binance", "bybit", "okx", "kraken", "simulated"],
    primaryProvider: options.providerNames.includes("simulated") ? "simulated" : "binance",
    staleAfterMs: Number(process.env.PROVIDER_STALE_AFTER_MS ?? 10_000)
  });

  const paperExecutor = repository ? new PaperExecutor(repository, {
    accountEquity: Number(process.env.ACCOUNT_EQUITY ?? 10000),
    currentDailyLoss: 0,
    currentMonthlyDrawdownPct: 0,
    openPositions: 0,
    liveTradingEnabled: false
  }) : null;

  const positionMonitor = (repository && paperExecutor) ? new PositionMonitor(repository, paperExecutor, {
    enabled: process.env.POSITION_MONITOR_ENABLED !== "false"
  }) : null;

  const logTick = createTickLogger(
    repository,
    supervisor,
    redisPublisher,
    options.publishLegacyMarketAlias === true,
    positionMonitor
  );

  try {
    await redisPublisher.connect();
    console.log("Redis publisher connected successfully");
  } catch (error) {
    console.warn("Redis publisher failed to connect, continuing without Redis:", error);
  }

  const providers = buildPollingProviders(options.providerNames, options.symbols);
  const pollingSupervisor = options.createPollingSupervisor?.(providers) ?? new PollingMarketDataSupervisor({
    providers,
    primaryProvider: providers[0]?.name ?? "simulated",
    staleAfterMs: Number(process.env.PROVIDER_STALE_AFTER_MS ?? 10_000)
  });

  const setIntervalFn = options.setIntervalFn ?? setInterval;
  setIntervalFn(() => {
    void pollingSupervisor.poll(options.symbols).then((result) => {
      for (const tick of result.ticks) logTick(tick);
      for (const error of result.errors) {
        console.log(JSON.stringify({ event: "market_provider_error", error, providerStatus: result.status }));
      }
    }).catch((error) => {
      console.error("Market polling failed:", error);
    });
  }, options.pollIntervalMs);

  const onSignal = options.onSignal ?? ((event, listener) => {
    process.on(event, () => {
      void listener();
    });
  });

  onSignal("SIGINT", async () => {
    console.log("Shutting down worker...");
    await redisPublisher.disconnect();
    process.exit(0);
  });

  onSignal("SIGTERM", async () => {
    console.log("Shutting down worker...");
    await redisPublisher.disconnect();
    process.exit(0);
  });
}

const storePath = process.env.TRADE_STORE_PATH;
const symbols = (process.env.MARKET_SYMBOLS ?? "BTC-USDT,ETH-USDT,SOL-USDT")
  .split(",")
  .map((symbol) => symbol.trim())
  .filter(Boolean);
const useSimulatedFeed = process.env.USE_SIMULATED_MARKET === "true";
const providerNames = resolveProviderNames(process.env.MARKET_REST_PROVIDERS, useSimulatedFeed);
const pollIntervalMs = Number(process.env.MARKET_POLL_INTERVAL_MS ?? 1_000);
const publishLegacyMarketAlias = process.env.WORKER_PUBLISH_MARKET_ALIAS === "true";

if (import.meta.url === new URL(process.argv[1] ?? "", "file://").href) {
  await startWorker({
    symbols,
    providerNames,
    pollIntervalMs,
    publishLegacyMarketAlias
  });
}
