import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { ProviderSupervisor } from "@trade/exchange";
import type {
  ApiErrorDetail,
  ApiErrorResponse,
  ApiSuccessResponse,
  HealthResponse,
  MarketTick,
  PaperOrderRequest,
  Position,
  ProviderStatusSnapshot,
  Trade,
  AuditEvent,
  AlertEvent,
  SentimentSnapshot,
  TradingSignal,
  WhaleEvent,
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  CreateBacktestRequest,
  BacktestListResponse,
  BacktestWithMetrics
} from "@trade/shared";
import { RedisSubscriber } from "@trade/shared";
import {
  calculatePaperMetrics,
  computeFearGreedIndex,
  evaluateSignal,
  InMemoryTradingRepository,
  PaperExecutor,
  scoreNewsSentiment,
  scoreOnchainEvents,
  generateRealSignal,
  generateSignalDetails,
  type Candle,
  type TradingRepository,
  HistoricalDataFetcher,
  StrategyRunner,
  type BacktestMetrics,
  createSMACrossoverStrategy,
  TimeSeriesAnalyzer,
  RiskAnalyzer,
  type TradeMetrics,
  PaperTradingService
} from "@trade/trading-core";
import { MetricsCalculator } from "@trade/trading-core/metrics/metrics-calculator.js";
import { DataAggregator } from "./data-aggregator.js";
import {
  AuthService,
  AuthRepository,
  JwtService,
  PasswordService,
  createAuthMiddleware,
  createOptionalAuthMiddleware
} from "./auth/index.js";
import {
  BacktestService,
  BacktestRepository
} from "./backtest/index.js";
import { registerSentimentRoutes } from "./routes/sentiment.js";
import { registerWhaleRoutes } from "./routes/whale.js";
import { SentimentService } from "@trading-bot/sentiment";
import type { Client } from "pg";

const paperOrderSchema = z.object({
  idempotencyKey: z.string().min(4),
  symbol: z.enum(["BTC-USDT", "ETH-USDT"]),
  side: z.enum(["LONG", "SHORT"]),
  mode: z.enum(["paper", "demo", "live"]),
  entryPrice: z.number().positive(),
  stopLossPrice: z.number().positive(),
  takeProfitPrice: z.number().positive().optional(),
  marginUsdt: z.number().positive(),
  leverage: z.number().positive()
});

const backtestRunSchema = z.object({
  symbol: z.enum(["BTC-USDT", "ETH-USDT"]),
  startDate: z.string(),
  endDate: z.string(),
  interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]),
  initialCapital: z.number().positive().default(10000),
  feeRate: z.number().min(0).max(1).default(0.001),
  slippageRate: z.number().min(0).max(1).default(0.0005),
  strategy: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.object({
      newsScoreWeight: z.number().optional(),
      onchainScoreWeight: z.number().optional(),
      fundamentalScoreWeight: z.number().optional(),
      fearGreedWeight: z.number().optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      maxLeverage: z.number().positive().optional(),
      riskPerTrade: z.number().positive().optional(),
      stopLossAtr: z.number().positive().optional(),
      takeProfitAtr: z.number().positive().optional()
    }).optional()
  })
});

export interface AppOptions {
  liveTradingEnabled?: boolean;
  accountEquity?: number;
  repository?: RuntimeTradingRepository;
  adminToken?: string;
  coingeckoApiKey?: string;
  bingxApiKey?: string;
  bingxApiSecret?: string;
  pgClient?: Client;
  jwtAccessSecret?: string;
  jwtRefreshSecret?: string;
  disableRedisSubscriber?: boolean;
  cryptoPanicApiKey?: string;
  enablePaperTradingV2?: boolean;
}

type RuntimeTradingRepository = TradingRepository & {
  positions(): Position[];
  trades(): Trade[];
  auditEvents(): AuditEvent[];
  marketTicks(): MarketTick[];
};

// In-memory storage for backtest results
const backtestResults = new Map<string, {
  id: string;
  status: "running" | "completed" | "failed";
  metrics?: BacktestMetrics;
  config: any;
  createdAt: string;
  completedAt?: string;
  error?: string;
}>();

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: false });
  const repo: RuntimeTradingRepository = options.repository ?? new InMemoryTradingRepository();
  const dataAggregator = new DataAggregator({
    coingeckoApiKey: options.coingeckoApiKey
  });

  // Initialize auth services if pgClient is provided
  let authService: AuthService | undefined;
  let authMiddleware: ReturnType<typeof createAuthMiddleware> | undefined;
  let optionalAuthMiddleware: ReturnType<typeof createOptionalAuthMiddleware> | undefined;
  let backtestService: BacktestService | undefined;
  let sentimentService: SentimentService | undefined;
  let paperTradingService: PaperTradingService | undefined;

  if (options.pgClient && options.jwtAccessSecret && options.jwtRefreshSecret) {
    const authRepository = new AuthRepository(options.pgClient);
    const jwtService = new JwtService({
      accessTokenSecret: options.jwtAccessSecret,
      refreshTokenSecret: options.jwtRefreshSecret,
      accessTokenExpiresIn: "15m",
      refreshTokenExpiresIn: "7d"
    });
    const passwordService = new PasswordService(10);

    authService = new AuthService({
      authRepository,
      jwtService,
      passwordService
    });

    authMiddleware = createAuthMiddleware({ jwtService });
    optionalAuthMiddleware = createOptionalAuthMiddleware({ jwtService });

    // Initialize backtest service
    const backtestRepository = new BacktestRepository(options.pgClient);
    const historicalDataFetcher = new HistoricalDataFetcher({
      useCache: true
    });

    backtestService = new BacktestService({
      backtestRepository,
      historicalDataFetcher
    });
  }

  // Initialize sentiment service if API key is provided
  if (options.cryptoPanicApiKey) {
    sentimentService = new SentimentService({
      cryptoPanicApiKey: options.cryptoPanicApiKey,
    });
  }

  // Initialize enhanced paper trading service
  if (options.enablePaperTradingV2) {
    paperTradingService = new PaperTradingService(
      {
        makerFeePct: 0.075,
        takerFeePct: 0.075,
        slippagePct: 0.05,
        monitorIntervalMs: 5000,
        enableAutoClose: true
      },
      options.accountEquity ?? 10000
    );
    paperTradingService.start();
  }

  const marketTicks: MarketTick[] = [
    {
      symbol: "BTC-USDT",
      price: 100_000,
      change24hPct: 0,
      volume24h: 0,
      timestamp: Date.now(),
      source: "simulated"
    },
    {
      symbol: "ETH-USDT",
      price: 3_000,
      change24hPct: 0,
      volume24h: 0,
      timestamp: Date.now(),
      source: "simulated"
    }
  ];
  let hasReceivedRealTick = false;
  const liveSignals: TradingSignal[] = [];
  const liveProviderStatuses = new Map<string, ProviderStatusSnapshot>();
  let redisSubscriber: RedisSubscriber | null = null;

  if (!options.disableRedisSubscriber) {
    redisSubscriber = new RedisSubscriber({
      onTick: (tick: MarketTick) => {
        if (!hasReceivedRealTick) {
          marketTicks.length = 0;
          hasReceivedRealTick = true;
        }

        const existingIndex = marketTicks.findIndex((t) => t.symbol === tick.symbol);
        if (existingIndex >= 0) {
          marketTicks[existingIndex] = tick;
        } else {
          marketTicks.push(tick);
        }

        if (marketTicks.length > 100) {
          marketTicks.shift();
        }

        // Update paper trading service with new prices
        if (paperTradingService) {
          paperTradingService.updateMarketPrice(tick.symbol, tick.price);
        }
      },
      onMessage: (channel, payload) => {
        if (channel === "market:signals" && isTradingSignal(payload)) {
          const existingIndex = liveSignals.findIndex((signal) => signal.symbol === payload.symbol);
          if (existingIndex >= 0) {
            liveSignals[existingIndex] = payload;
          } else {
            liveSignals.push(payload);
          }
        }

        if (channel === "market:provider-status" && isProviderStatus(payload)) {
          liveProviderStatuses.set(payload.symbol, payload);
        }
      },
      onError: (error) => console.error("Redis subscriber error:", error)
    });

    const subscriber = redisSubscriber;
    void subscriber.connect()
      .then(async () => {
        await subscriber.subscribe("market:ticks");
        await subscriber.subscribe("market:ticks.consensus");
        await subscriber.subscribe("market:signals");
        await subscriber.subscribe("market:provider-status");
      })
      .then(() => console.log("Redis subscriber connected and listening to market channels"))
      .catch((error) => console.warn("Redis subscriber failed to connect, using simulated ticks:", error));
  }

  const executor = new PaperExecutor(repo, {
    accountEquity: options.accountEquity ?? 10_000,
    currentDailyLoss: 0,
    currentMonthlyDrawdownPct: 0,
    openPositions: 0,
    liveTradingEnabled: options.liveTradingEnabled ?? false
  });

  // Security middleware
  void app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  });

  void app.register(rateLimit, {
    max: 100,
    timeWindow: "15 minutes",
    errorResponseBuilder: (request, context) => ({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
        correlationId: request.id
      }
    })
  });

  void app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
  });

  // Authentication endpoints
  if (authService) {
    const registerSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional()
    });

    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string()
    });

    const refreshTokenSchema = z.object({
      refreshToken: z.string()
    });

    app.post<{ Body: RegisterRequest }>("/auth/register", async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid registration data", parsed.error.issues);
      }

      try {
        const user = await authService!.register(parsed.data);
        return reply.status(201).send(ok(user));
      } catch (error) {
        return sendError(reply, request.id, 400, "REGISTRATION_FAILED", error instanceof Error ? error.message : "Registration failed");
      }
    });

    app.post<{ Body: LoginRequest }>("/auth/login", async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid login data", parsed.error.issues);
      }

      try {
        const ipAddress = request.ip;
        const userAgent = request.headers["user-agent"];

        const result = await authService!.login({
          ...parsed.data,
          ipAddress,
          userAgent
        });

        return ok(result);
      } catch (error) {
        return sendError(reply, request.id, 401, "LOGIN_FAILED", error instanceof Error ? error.message : "Login failed");
      }
    });

    app.post<{ Body: RefreshTokenRequest }>("/auth/refresh", async (request, reply) => {
      const parsed = refreshTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid refresh token data", parsed.error.issues);
      }

      try {
        const result = await authService!.refreshAccessToken(parsed.data.refreshToken);
        return ok(result);
      } catch (error) {
        return sendError(reply, request.id, 401, "REFRESH_FAILED", error instanceof Error ? error.message : "Token refresh failed");
      }
    });

    app.post("/auth/logout", { preHandler: authMiddleware }, async (request, reply) => {
      const body = z.object({ refreshToken: z.string() }).safeParse(request.body);
      if (!body.success) {
        return sendError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid logout data", body.error.issues);
      }

      try {
        await authService!.logout(body.data.refreshToken);
        return ok({ message: "Logged out successfully" });
      } catch (error) {
        return sendError(reply, request.id, 400, "LOGOUT_FAILED", error instanceof Error ? error.message : "Logout failed");
      }
    });

    app.get("/auth/me", { preHandler: authMiddleware }, async (request, reply) => {
      try {
        const user = await authService!.verifyAccessToken(request.headers.authorization!.split(" ")[1]);
        return ok(user);
      } catch (error) {
        return sendError(reply, request.id, 401, "UNAUTHORIZED", error instanceof Error ? error.message : "Unauthorized");
      }
    });
  }

  // Backtest endpoints
  if (backtestService && authMiddleware) {
    const createBacktestSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      symbol: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      interval: z.string(),
      initialCapital: z.number().positive(),
      feeRate: z.number().min(0),
      slippageRate: z.number().min(0),
      strategyName: z.string(),
      strategyDescription: z.string().optional(),
      strategyParameters: z.record(z.any()).optional()
    });

    app.post<{ Body: CreateBacktestRequest }>("/backtests", { preHandler: authMiddleware }, async (request, reply) => {
      const parsed = createBacktestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid backtest data", parsed.error.issues);
      }

      try {
        const backtest = await backtestService!.createBacktest({
          ...parsed.data,
          userId: request.user!.userId
        });

        // Run backtest asynchronously
        backtestService!.runBacktest(backtest.id, {
          symbol: backtest.symbol,
          startDate: backtest.startDate,
          endDate: backtest.endDate,
          interval: backtest.interval,
          initialCapital: backtest.initialCapital,
          feeRate: backtest.feeRate,
          slippageRate: backtest.slippageRate
        }).catch((error) => {
          console.error(`Backtest ${backtest.id} failed:`, error);
        });

        return reply.status(201).send(ok(backtest));
      } catch (error) {
        return sendError(reply, request.id, 500, "BACKTEST_FAILED", error instanceof Error ? error.message : "Failed to create backtest");
      }
    });

    app.get("/backtests", { preHandler: authMiddleware }, async (request, reply) => {
      const query = z.object({
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(100).optional(),
        status: z.enum(["pending", "running", "completed", "failed"]).optional()
      }).safeParse(request.query);

      if (!query.success) {
        return sendError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid query parameters", query.error.issues);
      }

      try {
        const result = await backtestService!.getBacktestsByUserId(
          request.user!.userId,
          query.data
        );

        return ok<BacktestListResponse>({
          backtests: result.backtests,
          total: result.total,
          page: query.data.page ?? 1,
          pageSize: query.data.pageSize ?? 20
        });
      } catch (error) {
        return sendError(reply, request.id, 500, "INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch backtests");
      }
    });

    app.get<{ Params: { id: string } }>("/backtests/:id", { preHandler: authMiddleware }, async (request, reply) => {
      try {
        const backtest = await backtestService!.getBacktestById(request.params.id);

        if (!backtest) {
          return sendError(reply, request.id, 404, "BACKTEST_NOT_FOUND", "Backtest not found");
        }

        if (backtest.userId !== request.user!.userId) {
          return sendError(reply, request.id, 401, "UNAUTHORIZED", "Not authorized to access this backtest");
        }

        return ok(backtest);
      } catch (error) {
        return sendError(reply, request.id, 500, "INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch backtest");
      }
    });

    app.get<{ Params: { id: string } }>("/backtests/:id/trades", { preHandler: authMiddleware }, async (request, reply) => {
      try {
        const backtest = await backtestService!.getBacktestById(request.params.id);

        if (!backtest) {
          return sendError(reply, request.id, 404, "BACKTEST_NOT_FOUND", "Backtest not found");
        }

        if (backtest.userId !== request.user!.userId) {
          return sendError(reply, request.id, 401, "UNAUTHORIZED", "Not authorized to access this backtest");
        }

        const trades = await backtestService!.getBacktestTrades(request.params.id);
        return ok(trades);
      } catch (error) {
        return sendError(reply, request.id, 500, "INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch backtest trades");
      }
    });
  }

  app.get("/health", async () =>
    ok<HealthResponse>({
      status: "ok",
      mode: "paper",
      liveTradingEnabled: options.liveTradingEnabled ?? false
    })
  );

  app.get("/positions", async () => ok(repo.positions()));
  app.get("/trades", async () => ok(repo.trades()));
  app.get("/audit", async () => ok(repo.auditEvents()));
  app.get("/market/ticker", async (request, reply) => {
    const query = z.object({ symbol: z.string().optional() }).safeParse(request.query);
    if (!query.success) {
      return sendError(reply, request.id, 400, "INVALID_MARKET_QUERY", "Invalid market query", query.error.issues);
    }
    const symbol = query.data.symbol;
    const ticks = latestTicksBySymbol(repo.marketTicks()).length ? latestTicksBySymbol(repo.marketTicks()) : marketTicks;
    return ok(symbol ? ticks.find((tick) => tick.symbol === symbol) ?? null : ticks);
  });
  app.get("/signals", async () => {
    if (liveSignals.length > 0) {
      return ok(liveSignals);
    }

    const now = Date.now();
    const ticks = latestTicksBySymbol(repo.marketTicks()).length ? latestTicksBySymbol(repo.marketTicks()) : marketTicks;

    return ok(
      ticks.map((tick, index) => {
        // Generate candles from recent price (simulated for now)
        const candles = generateSimulatedCandles(tick.price, 50);

        // Use simulated scores for news, onchain, and fundamental
        const signal = generateRealSignal({
          symbol: tick.symbol,
          candles,
          currentPrice: tick.price,
          newsScore: 55,
          onchainScore: 52,
          fundamentalScore: 60,
          fearGreedScore: 50,
          marketStructureScore: 50,
          providerReliabilityScore: 85,
          dataQualityScore: 75,
          providerDisagreementScore: 10
        });

        return {
          ...signal,
          createdAt: new Date(now - index * 1000).toISOString()
        };
      })
    );
  });
  app.get("/signals/:symbol", async (request, reply) => {
    const params = z.object({ symbol: z.string() }).safeParse(request.params);
    if (!params.success) {
      return sendError(reply, request.id, 400, "INVALID_MARKET_QUERY", "Invalid signal symbol", params.error.issues);
    }
    const liveSignal = liveSignals.find((signal) => signal.symbol === params.data.symbol);
    if (liveSignal) return ok(liveSignal);
    const tick = marketTicks.find((item) => item.symbol === params.data.symbol);
    if (!tick) return ok(null);
    return ok(
      evaluateSignal({
        symbol: tick.symbol,
        prices: [tick.price * 1.01, tick.price],
        thresholdPct: 2
      })
    );
  });

  app.get("/providers/status", async () =>
    ok(
      liveProviderStatuses.size
        ? Array.from(liveProviderStatuses.values())
        : { symbol: "simulated", source: "simulated", ...buildProviderStatus() }
    )
  );

  app.get("/fear-greed", async () => ok({ source: "simulated", ...buildFearGreedSnapshot() }));

  app.get("/sentiment/fear-greed", async () => {
    try {
      // Try to fetch real fundamentals data for BTC to enhance fear-greed calculation
      const btcData = await dataAggregator.fetchFundamentals("BTC-USDT");
      const snapshot = buildFearGreedSnapshot();

      // Adjust score based on real price change if available
      let adjustedScore = snapshot.fearGreedScore;
      if (btcData.source === "coingecko" && btcData.priceChange24hPct !== 0) {
        // Positive price change increases greed, negative increases fear
        adjustedScore = Math.max(0, Math.min(100, adjustedScore + btcData.priceChange24hPct * 2));
      }

      const label = adjustedScore < 25 ? "extreme-fear" :
                    adjustedScore < 45 ? "fear" :
                    adjustedScore < 55 ? "neutral" :
                    adjustedScore < 75 ? "greed" : "extreme-greed";

      return ok<SentimentSnapshot>({
        score: Math.round(adjustedScore),
        label,
        updatedAt: new Date().toISOString(),
        source: btcData.source === "coingecko" ? "external" : "simulated",
        ...(btcData.warning && { warning: btcData.warning })
      });
    } catch (error) {
      const snapshot = buildFearGreedSnapshot();
      return ok<SentimentSnapshot>({
        score: snapshot.fearGreedScore,
        label: snapshot.label,
        updatedAt: new Date().toISOString(),
        source: "simulated"
      });
    }
  });

  app.get("/whales/events", async () =>
    ok<WhaleEvent[]>([
      {
        id: "whale-sim-1",
        type: "EXCHANGE_OUTFLOW",
        symbol: "BTC",
        valueUsd: 5_000_000,
        severity: "medium",
        source: "simulated",
        timestamp: new Date().toISOString()
      }
    ])
  );

  app.get("/news", async () => {
    const newsData = await dataAggregator.fetchNews();
    return ok({
      source: newsData.source,
      items: newsData.items.map(item => ({
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt,
        link: item.link,
        description: item.description
      })),
      sentiment: scoreNewsSentiment(newsData.items.map(item => ({
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt
      }))),
      warning: newsData.warning
    });
  });

  app.get("/onchain/events", async () => {
    const events = [
      {
        classification: "EXCHANGE_OUTFLOW" as const,
        valueUsd: 5_000_000,
        asset: "BTC",
        confidence: 60
      }
    ];
    return ok({ source: "simulated", events, score: scoreOnchainEvents(events) });
  });

  app.get("/fundamentals/:symbol", async (request, reply) => {
    const params = z.object({ symbol: z.string() }).safeParse(request.params);
    if (!params.success) {
      return sendError(reply, request.id, 400, "INVALID_SYMBOL", "Invalid symbol", params.error.issues);
    }
    const data = await dataAggregator.fetchFundamentals(params.data.symbol);
    return ok(data);
  });

  app.get("/onchain/:symbol", async (request, reply) => {
    const params = z.object({ symbol: z.string() }).safeParse(request.params);
    if (!params.success) {
      return sendError(reply, request.id, 400, "INVALID_SYMBOL", "Invalid symbol", params.error.issues);
    }
    const data = await dataAggregator.fetchOnchainData(params.data.symbol);
    return ok(data);
  });

  app.get("/alerts", async () =>
    ok<AlertEvent[]>([
      {
        id: "alert-sim-1",
        type: "RISK",
        status: "OPEN",
        title: "Aguardar confirmacao",
        message: "Dados simulados ate provider real e persistencia serem conectados.",
        severity: "medium",
        createdAt: new Date().toISOString()
      }
    ])
  );

  app.get("/paper-trading/status", async () =>
    ok({
      source: "memory",
      metrics: calculatePaperMetrics(
        repo.trades().map((trade) => ({
          pnl: trade.pnlUsdt,
          pnlPercentage: trade.entryPrice > 0 ? (trade.pnlUsdt / trade.entryPrice) * 100 : 0,
          openedAt: trade.openedAt,
          closedAt: trade.closedAt ?? undefined
        }))
      ),
      openPositions: repo.positions().filter((position) => position.status === "OPEN").length
    })
  );

  app.get("/paper-trading/trades", async () => ok(repo.trades()));

  app.get("/paper/summary", async () => {
    const positions = repo.positions();
    const trades = repo.trades();
    return ok({
      openPositions: positions.filter((position) => position.status === "OPEN").length,
      closedTrades: trades.length,
      realizedPnlUsdt: roundMoney(trades.reduce((sum, trade) => sum + trade.pnlUsdt, 0)),
      unrealizedPnlUsdt: roundMoney(positions.reduce((sum, position) => sum + position.pnlUsdt, 0)),
      winRatePct: calculatePaperMetrics(
        trades.map((trade) => ({
          pnl: trade.pnlUsdt,
          pnlPercentage: trade.entryPrice > 0 ? (trade.pnlUsdt / trade.entryPrice) * 100 : 0,
          openedAt: trade.openedAt,
          closedAt: trade.closedAt ?? undefined
        }))
      ).winRate,
      updatedAt: new Date().toISOString()
    });
  });

  app.get("/admin/audit-logs", async (request, reply) => {
    const denied = requireAdmin(request.headers["x-admin-token"], options.adminToken);
    if (denied) return sendError(reply, request.id, 401, "UNAUTHORIZED", denied);
    return ok({
      source: "memory",
      auditLogs: repo.auditEvents()
    });
  });

  app.get("/admin/performance", async (request, reply) => {
    const denied = requireAdmin(request.headers["x-admin-token"], options.adminToken);
    if (denied) return sendError(reply, request.id, 401, "UNAUTHORIZED", denied);
    return ok({
      source: "memory",
      metrics: calculatePaperMetrics(
        repo.trades().map((trade) => ({
          pnl: trade.pnlUsdt,
          pnlPercentage: trade.entryPrice > 0 ? (trade.pnlUsdt / trade.entryPrice) * 100 : 0,
          openedAt: trade.openedAt,
          closedAt: trade.closedAt ?? undefined
        }))
      )
    });
  });

  app.post<{ Body: PaperOrderRequest }>("/orders/paper", async (request, reply) => {
    const parsed = paperOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        request.id,
        400,
        "VALIDATION_ERROR",
        "Invalid paper order payload",
        parsed.error.issues
      );
    }

    if (parsed.data.mode !== "paper") {
      return sendError(reply, request.id, 400, "PAPER_ONLY_ENDPOINT", "Only paper mode is accepted by this MVP endpoint");
    }

    try {
      const before = repo.positions().length;
      const result = await executor.open(parsed.data);
      const after = repo.positions().length;
      return reply.status(after === before ? 200 : 201).send(ok(result));
    } catch (error) {
      return sendError(
        reply,
        request.id,
        400,
        "ORDER_REJECTED",
        error instanceof Error ? error.message : "Order rejected"
      );
    }
  });

  app.post("/orders/:id/close", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ exitPrice: z.number().positive() }).safeParse(request.body);
    if (!body.success) {
      return sendError(reply, request.id, 400, "INVALID_CLOSE_PAYLOAD", "Invalid close payload", body.error.issues);
    }

    try {
      const position = await executor.close(params.id, body.data.exitPrice);
      return reply.send(ok({ position }));
    } catch (error) {
      return sendError(
        reply,
        request.id,
        404,
        "POSITION_NOT_FOUND",
        error instanceof Error ? error.message : "Position not found"
      );
    }
  });

  app.get("/signals/:symbol/details", async (request, reply) => {
    const params = z.object({ symbol: z.enum(["BTC-USDT", "ETH-USDT"]) }).safeParse(request.params);
    if (!params.success) {
      return sendError(reply, request.id, 400, "INVALID_SYMBOL", "Invalid symbol", params.error.issues);
    }

    const ticks = latestTicksBySymbol(repo.marketTicks()).length ? latestTicksBySymbol(repo.marketTicks()) : marketTicks;
    const tick = ticks.find((t) => t.symbol === params.data.symbol);

    if (!tick) {
      return sendError(reply, request.id, 404, "SYMBOL_NOT_FOUND", "Symbol not found");
    }

    // Generate candles from recent price (simulated for now)
    const candles = generateSimulatedCandles(tick.price, 50);

    // Generate detailed signal with breakdown
    const signalDetails = generateSignalDetails({
      symbol: tick.symbol,
      candles,
      currentPrice: tick.price,
      newsScore: 55,
      onchainScore: 52,
      fundamentalScore: 60,
      fearGreedScore: 50,
      marketStructureScore: 50,
      providerReliabilityScore: 85,
      dataQualityScore: 75,
      providerDisagreementScore: 10
    });

    return ok(signalDetails);
  });

  // Backtesting endpoints
  app.post("/backtest/run", async (request, reply) => {
    const parsed = backtestRunSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid backtest configuration", parsed.error.issues);
    }

    const backtestId = `bt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const config = parsed.data;

    // Store initial result
    backtestResults.set(backtestId, {
      id: backtestId,
      status: "running",
      config,
      createdAt: new Date().toISOString()
    });

    // Run backtest asynchronously
    (async () => {
      try {
        const historicalDataFetcher = new HistoricalDataFetcher({
          useCache: true
        });
        const strategyParams = config.strategy.parameters ?? {};
        const strategy = createSMACrossoverStrategy({
          fastPeriod: Number(strategyParams.stopLossAtr ?? 20),
          slowPeriod: Number(strategyParams.takeProfitAtr ?? 50)
        });

        const runner = new StrategyRunner({
          symbol: config.symbol,
          startDate: new Date(config.startDate),
          endDate: new Date(config.endDate),
          initialCapital: config.initialCapital,
          feeRate: config.feeRate,
          slippageRate: config.slippageRate,
          maxLeverage: Number(strategyParams.maxLeverage ?? 4),
          riskPerTrade: Number(strategyParams.riskPerTrade ?? 2),
          stopLossAtr: Number(strategyParams.stopLossAtr ?? 2),
          takeProfitAtr: Number(strategyParams.takeProfitAtr ?? 3)
        });
        const candles = await historicalDataFetcher.fetchHistoricalCandles(
          config.symbol,
          config.interval,
          new Date(config.startDate),
          new Date(config.endDate)
        );

        const result = await runner.runBacktest(candles, strategy);

        backtestResults.set(backtestId, {
          id: backtestId,
          status: "completed",
          metrics: {
            totalReturn: result.totalReturn,
            totalReturnPct: result.totalReturnPct,
            winRate: result.winRate,
            profitFactor: result.profitFactor,
            maxDrawdown: result.maxDrawdown,
            maxDrawdownPct: result.maxDrawdownPct,
            sharpeRatio: result.sharpeRatio,
            totalTrades: result.totalTrades
          },
          config,
          createdAt: backtestResults.get(backtestId)!.createdAt,
          completedAt: new Date().toISOString()
        });
      } catch (error) {
        backtestResults.set(backtestId, {
          id: backtestId,
          status: "failed",
          config,
          createdAt: backtestResults.get(backtestId)!.createdAt,
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    })();

    return reply.status(202).send(ok({ backtestId, status: "running" }));
  });

  app.get("/backtest/results/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const result = backtestResults.get(params.id);

    if (!result) {
      return sendError(reply, request.id, 404, "POSITION_NOT_FOUND", "Backtest not found");
    }

    return ok(result);
  });

  app.get("/backtest/history", async () => {
    const history = Array.from(backtestResults.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50); // Return last 50 backtests

    return ok(history);
  });

  // Metrics endpoints
  let metricsCache: {
    performance?: any;
    risk?: any;
    equityCurve?: any;
    tradesAnalysis?: any;
    timestamp: number;
  } = { timestamp: 0 };

  const METRICS_CACHE_TTL = 60_000; // 1 minute

  app.get("/metrics/performance", async () => {
    const now = Date.now();
    if (metricsCache.performance && now - metricsCache.timestamp < METRICS_CACHE_TTL) {
      return ok(metricsCache.performance);
    }

    const trades = repo.trades();
    const tradeMetrics: TradeMetrics[] = trades.map(trade => ({
      pnl: trade.pnlUsdt,
      pnlPercentage: trade.entryPrice > 0 ? (trade.pnlUsdt / trade.entryPrice) * 100 : 0,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt ?? trade.openedAt
    }));

    const calculator = new MetricsCalculator({
      initialCapital: options.accountEquity ?? 10_000,
      riskFreeRate: 0.02
    });

    const metrics = calculator.calculate(tradeMetrics);

    metricsCache.performance = {
      ...metrics,
      updatedAt: new Date().toISOString()
    };
    metricsCache.timestamp = now;

    return ok(metricsCache.performance);
  });

  app.get("/metrics/risk", async () => {
    const now = Date.now();
    if (metricsCache.risk && now - metricsCache.timestamp < METRICS_CACHE_TTL) {
      return ok(metricsCache.risk);
    }

    const trades = repo.trades();
    const tradeMetrics: TradeMetrics[] = trades.map(trade => ({
      pnl: trade.pnlUsdt,
      pnlPercentage: trade.entryPrice > 0 ? (trade.pnlUsdt / trade.entryPrice) * 100 : 0,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt ?? trade.openedAt
    }));

    const openPositions = repo.positions().filter(p => p.status === "OPEN");

    const analyzer = new RiskAnalyzer({
      initialCapital: options.accountEquity ?? 10_000,
      riskFreeRate: 0.02
    });

    const riskMetrics = analyzer.analyze(
      tradeMetrics,
      undefined, // No benchmark data for now
      openPositions
    );

    metricsCache.risk = {
      ...riskMetrics,
      updatedAt: new Date().toISOString()
    };
    metricsCache.timestamp = now;

    return ok(metricsCache.risk);
  });

  app.get("/metrics/equity-curve", async () => {
    const now = Date.now();
    if (metricsCache.equityCurve && now - metricsCache.timestamp < METRICS_CACHE_TTL) {
      return ok(metricsCache.equityCurve);
    }

    const trades = repo.trades();
    const tradeMetrics: TradeMetrics[] = trades.map(trade => ({
      pnl: trade.pnlUsdt,
      pnlPercentage: trade.entryPrice > 0 ? (trade.pnlUsdt / trade.entryPrice) * 100 : 0,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt ?? trade.openedAt
    }));

    const timeSeriesAnalyzer = new TimeSeriesAnalyzer({
      initialCapital: options.accountEquity ?? 10_000,
      rollingWindowDays: 30
    });

    const analytics = timeSeriesAnalyzer.analyze(tradeMetrics);

    metricsCache.equityCurve = {
      equityCurve: analytics.equityCurve,
      rollingMetrics: analytics.rollingMetrics,
      drawdownPeriods: analytics.drawdownPeriods,
      updatedAt: new Date().toISOString()
    };
    metricsCache.timestamp = now;

    return ok(metricsCache.equityCurve);
  });

  app.get("/metrics/trades-analysis", async () => {
    const now = Date.now();
    if (metricsCache.tradesAnalysis && now - metricsCache.timestamp < METRICS_CACHE_TTL) {
      return ok(metricsCache.tradesAnalysis);
    }

    const trades = repo.trades();
    const tradeMetrics: TradeMetrics[] = trades.map(trade => ({
      pnl: trade.pnlUsdt,
      pnlPercentage: trade.entryPrice > 0 ? (trade.pnlUsdt / trade.entryPrice) * 100 : 0,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt ?? trade.openedAt
    }));

    const timeSeriesAnalyzer = new TimeSeriesAnalyzer({
      initialCapital: options.accountEquity ?? 10_000,
      rollingWindowDays: 30
    });

    const analytics = timeSeriesAnalyzer.analyze(tradeMetrics);

    // Group trades by symbol
    const tradesBySymbol = new Map<string, typeof trades>();
    for (const trade of trades) {
      if (!tradesBySymbol.has(trade.symbol)) {
        tradesBySymbol.set(trade.symbol, []);
      }
      tradesBySymbol.get(trade.symbol)!.push(trade);
    }

    const symbolAnalysis = Array.from(tradesBySymbol.entries()).map(([symbol, symbolTrades]) => {
      const totalPnl = symbolTrades.reduce((sum, t) => sum + t.pnlUsdt, 0);
      const winningTrades = symbolTrades.filter(t => t.pnlUsdt > 0);
      const winRate = (winningTrades.length / symbolTrades.length) * 100;

      return {
        symbol,
        totalTrades: symbolTrades.length,
        totalPnl: roundMoney(totalPnl),
        winRate: roundMoney(winRate),
        averagePnl: roundMoney(totalPnl / symbolTrades.length)
      };
    });

    metricsCache.tradesAnalysis = {
      monthlyReturns: analytics.monthlyReturns,
      weeklyReturns: analytics.weeklyReturns,
      symbolAnalysis,
      recentTrades: trades
        .slice(-20)
        .reverse()
        .map(t => ({
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          pnl: roundMoney(t.pnlUsdt),
          pnlPercentage: roundMoney(t.entryPrice > 0 ? (t.pnlUsdt / t.entryPrice) * 100 : 0),
          openedAt: t.openedAt,
          closedAt: t.closedAt
        })),
      updatedAt: new Date().toISOString()
    };
    metricsCache.timestamp = now;

    return ok(metricsCache.tradesAnalysis);
  });

  // Graceful shutdown
  app.addHook("onClose", async () => {
    if (redisSubscriber) {
      await redisSubscriber.disconnect();
    }
    if (paperTradingService) {
      paperTradingService.stop();
    }
  });

  // Register sentiment routes (must be done before returning)
  if (sentimentService) {
    registerSentimentRoutes(app, { sentimentService });
  }

  // Register whale routes
  registerWhaleRoutes(app, { db: options.db });

  // Register paper trading v2 routes
  if (paperTradingService) {
    const { registerPaperTradingRoutes } = await import("./routes/paper-trading.js");
    registerPaperTradingRoutes(app, { paperTradingService });
  }

  // Register tax reporting routes
  const taxRoutes = await import("./routes/tax.js");
  app.register(async (instance) => {
    instance.register(taxRoutes.default, { prefix: "/api/tax" });
  });

  return app;
}

function generateSimulatedCandles(currentPrice: number, count: number): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  for (let i = count - 1; i >= 0; i--) {
    const volatility = 0.02;
    const trend = -0.0005 * i;
    const randomFactor = (Math.random() - 0.5) * volatility;

    const close = currentPrice * (1 + trend + randomFactor);
    const open = close * (1 + (Math.random() - 0.5) * volatility * 0.5);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.3);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.3);
    const volume = 1000000 + Math.random() * 500000;

    candles.push({
      open,
      high,
      low,
      close,
      volume,
      timestamp: now - i * hourMs
    });
  }

  return candles;
}

function buildFearGreedSnapshot() {
  return computeFearGreedIndex({
    volatilityScore: 42,
    momentumScore: 61,
    volumeScore: 58,
    btcDominanceScore: 55,
    fundingScore: 52,
    openInterestScore: 50,
    newsSentimentScore: 48,
    onchainScore: 54,
    stablecoinFlowScore: 57,
    technicalScore: 56,
    correlationStressScore: 35,
    dataQualityScore: 80
  });
}

function buildProviderStatus() {
  const now = Date.now();
  const supervisor = new ProviderSupervisor({
    providers: ["binance", "bybit", "okx", "kraken"],
    primaryProvider: "binance",
    staleAfterMs: 10_000,
    now: () => now
  });
  supervisor.recordTick("binance", { price: 100_000, latencyMs: 90, timestamp: now });
  supervisor.recordTick("bybit", { price: 100_080, latencyMs: 130, timestamp: now });
  supervisor.recordTick("okx", { price: 99_970, latencyMs: 170, timestamp: now });
  supervisor.recordTick("kraken", { price: 100_020, latencyMs: 230, timestamp: now });
  return supervisor.status();
}

function latestTicksBySymbol(ticks: MarketTick[]): MarketTick[] {
  const bySymbol = new Map<string, MarketTick>();
  for (const tick of ticks) {
    const current = bySymbol.get(tick.symbol);
    if (!current || tick.timestamp >= current.timestamp) {
      bySymbol.set(tick.symbol, tick);
    }
  }
  return [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTradingSignal(value: unknown): value is TradingSignal {
  return isRecord(value) && typeof value.symbol === "string" && typeof value.createdAt === "string";
}

function isProviderStatus(value: unknown): value is ProviderStatusSnapshot {
  return isRecord(value) && typeof value.symbol === "string" && isRecord(value.providers);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireAdmin(headerValue: unknown, adminToken: string | undefined): string | null {
  if (!adminToken) return "Admin token is not configured";
  const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return token === adminToken ? null : "Admin token is missing or invalid";
}

function ok<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}

function sendError(
  reply: FastifyReply,
  correlationId: string,
  statusCode: number,
  code: ApiErrorDetail["code"],
  message: string,
  issues?: unknown[]
) {
  return reply.status(statusCode).send({
    error: {
      code,
      message,
      correlationId,
      ...(issues ? { issues } : {})
    }
  } satisfies ApiErrorResponse);
}
