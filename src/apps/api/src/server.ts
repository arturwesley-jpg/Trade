import { buildApp } from "./app.js";
import { Client } from "pg";
import { JsonFileTradingRepository, PostgresTradingRepository, runPostgresMigrations } from "@trade/trading-core";
import { TradingWebSocketServer } from "./websocket.js";
import { logger, metrics } from "@trade/shared";
import { alertingService } from "@trade/shared/monitoring";
import { healthChecker, registerPostgres, registerRedis } from "@trade/shared/health-check";
import { cache } from "@trade/shared/cache";
import { initializeNotifications } from "./services/notification-setup.js";
import { TradingEventStreamService } from "./services/trading-stream.js";
import { MarketStreamService } from "./services/market-stream.js";

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);

// Initialize logger for API service
logger.setContext({ service: "api" });

let pgClient: Client | undefined;

// Initialize Redis cache
try {
  await cache.connect();
  logger.info("Redis cache connected");
  registerRedis(healthChecker, cache);
} catch (error) {
  logger.warn("Redis cache connection failed, continuing without cache", error);
}

// Run database migrations if configured
if (process.env.DATABASE_URL) {
  logger.info("Running PostgreSQL migrations...");
  try {
    await runPostgresMigrations(process.env.DATABASE_URL);
    logger.info("Migrations completed successfully");

    // Create persistent client for auth
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    logger.info("PostgreSQL client connected");

    // Register PostgreSQL for health checks
    registerPostgres(healthChecker, pgClient);
  } catch (error) {
    logger.error("Migration failed", error);
    await alertingService.alert({
      severity: 'critical',
      message: 'Database migration failed',
      source: 'api-server',
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
}

// Build repository
const repository = await buildRepository();

// Build Fastify app
const app = await buildApp({
  liveTradingEnabled: process.env.ENABLE_LIVE_TRADING === "true",
  repository,
  adminToken: process.env.ADMIN_API_TOKEN,
  coingeckoApiKey: process.env.COINGECKO_API_KEY,
  pgClient,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-in-production",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-in-production",
  cryptoPanicApiKey: process.env.CRYPTOPANIC_API_KEY
});

// Initialize WebSocket server (before starting HTTP server)
const wsServer = new TradingWebSocketServer({
  server: app.server,
  path: "/ws",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "default-secret"
});
logger.info("WebSocket server initialized");

// Initialize notification system with WebSocket support
initializeNotifications(wsServer);

// Initialize trading event stream service
const tradingStream = new TradingEventStreamService({
  wsServer,
  repository
});

// Start streaming with 5 second updates
tradingStream.start(5000);
logger.info("Trading event stream initialized");

// Initialize market data stream service
const useSimulatedMarket = process.env.USE_SIMULATED_MARKET === "true";
let marketStream: MarketStreamService | undefined;

if (!useSimulatedMarket) {
  const symbols = (process.env.MARKET_SYMBOLS ?? "BTC-USDT,ETH-USDT,SOL-USDT")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  marketStream = new MarketStreamService({
    wsServer,
    symbols,
    primaryExchange: (process.env.PRIMARY_EXCHANGE as any) ?? "binance",
    enableMultiSource: process.env.ENABLE_MULTI_SOURCE === "true",
    cacheSize: Number(process.env.MARKET_CACHE_SIZE ?? 100),
    redisPubSub: process.env.REDIS_PUBSUB_ENABLED !== "false",
    onConsensusTick: (tick) => tradingStream.updateMarketPrice(tick)
  });

  // Add market stream stats endpoint
  app.get("/market/stream/stats", async () => {
    return { data: marketStream!.getStats() };
  });

  // Add endpoint to get recent ticks for a symbol
  app.get("/market/stream/recent/:symbol", async (request) => {
    const params = request.params as { symbol: string };
    const query = request.query as { limit?: string; mode?: "raw" | "consensus" };
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    return { data: marketStream!.getRecentTicks(params.symbol, limit, query.mode ?? "consensus") };
  });

  app.get("/market/providers/status", async () => {
    return { data: marketStream!.getProviderStatuses() };
  });

  app.get("/market/signals/:symbol", async (request) => {
    const params = request.params as { symbol: string };
    return { data: marketStream!.getSignal(params.symbol) };
  });

  app.get("/market/context", async () => {
    return { data: marketStream!.getMarketContext() };
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    await marketStream!.stop();
    await app.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully");
    await marketStream!.stop();
    await app.close();
    process.exit(0);
  });
}

// WebSocket stats endpoint
app.get("/ws/stats", async () => {
  return wsServer.getStats();
});

// Register metrics endpoint
app.get("/metrics", async () => {
  return await metrics.getMetrics();
});

// Start HTTP server
await app.listen({ host, port });
logger.info("HTTP server listening", { host, port });

// Start market data streaming after server is listening
if (marketStream) {
  await marketStream.start();
  logger.info("Market data streams started successfully");
} else {
  logger.info("Using simulated market data");

  // Simulate market tick broadcasts for demo purposes
  setInterval(() => {
    const btcPrice = 100_000 + Math.random() * 2000 - 1000;
    const ethPrice = 3_000 + Math.random() * 100 - 50;

    const btcTick = {
      symbol: "BTC-USDT",
      price: btcPrice,
      change24hPct: (Math.random() * 10 - 5),
      volume24h: Math.random() * 1_000_000_000,
      timestamp: Date.now(),
      source: "simulated" as const
    };

    const ethTick = {
      symbol: "ETH-USDT",
      price: ethPrice,
      change24hPct: (Math.random() * 10 - 5),
      volume24h: Math.random() * 500_000_000,
      timestamp: Date.now(),
      source: "simulated" as const
    };

    wsServer.broadcastMarketTick(btcTick);
    wsServer.broadcastMarketTick(ethTick);

    // Update trading stream with current prices for PnL calculations
    tradingStream.updateMarketPrice(btcTick);
    tradingStream.updateMarketPrice(ethTick);
  }, 2000);
}

async function buildRepository() {
  if (process.env.DATABASE_URL) {
    logger.info("Using PostgreSQL repository");
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    return PostgresTradingRepository.create(client, { maxMarketTicks: Number(process.env.MAX_MARKET_TICKS ?? 1_000) });
  }

  logger.warn("DATABASE_URL not set, falling back to in-memory repository");
  logger.warn("Data will not persist between restarts");
  return process.env.TRADE_STORE_PATH ? new JsonFileTradingRepository(process.env.TRADE_STORE_PATH) : undefined;
}
