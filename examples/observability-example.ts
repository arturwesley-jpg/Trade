/**
 * Exemplo de integração do sistema de observabilidade
 *
 * Este arquivo demonstra como integrar logging, métricas, health checks e alertas
 * em uma aplicação real.
 */

import {
  logger,
  createLogger,
  metrics,
  healthCheck,
  alerting
} from "@trade/shared";
import Fastify from "fastify";
import { Pool } from "pg";
import Redis from "ioredis";

// ============================================================================
// 1. SETUP INICIAL
// ============================================================================

const app = Fastify();
const apiLogger = createLogger("api-example");

// Setup PostgreSQL
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost/trade",
  max: 20,
});

// Setup Redis
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Registrar dependências no health check
healthCheck.registerPostgres(pgPool);
healthCheck.registerRedis(redis);

// Registrar função de envio de alertas (simulado)
alerting.registerSendFunction(async (message) => {
  console.log("📨 ALERT:", message);
  // Em produção: await bot.telegram.sendMessage(chatId, message);
});

// ============================================================================
// 2. MIDDLEWARE DE LOGGING E MÉTRICAS
// ============================================================================

app.addHook("onRequest", async (request, reply) => {
  // Adicionar timestamp e requestId
  (request as any).startTime = Date.now();
  (request as any).requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Configurar contexto do logger para esta request
  apiLogger.setContext({
    requestId: (request as any).requestId,
    method: request.method,
    path: request.url,
  });

  apiLogger.debug("Request received");
});

app.addHook("onResponse", async (request, reply) => {
  const duration = Date.now() - (request as any).startTime;
  const method = request.method;
  const path = request.routerPath || request.url;
  const status = reply.statusCode.toString();

  // Log da request
  apiLogger.logAPI(method, path, reply.statusCode, duration);

  // Métricas
  metrics.apiRequestTotal.inc({ method, path, status });
  metrics.apiRequestDuration.observe({ method, path }, duration);

  if (reply.statusCode >= 400) {
    metrics.apiErrorTotal.inc({
      method,
      path,
      error_type: reply.statusCode >= 500 ? "server_error" : "client_error"
    });
  }

  // Limpar contexto
  apiLogger.clearContext();
});

// ============================================================================
// 3. ERROR HANDLER
// ============================================================================

app.setErrorHandler(async (error, request, reply) => {
  const method = request.method;
  const path = request.routerPath || request.url;

  apiLogger.error("Request failed", error, {
    method,
    path,
    statusCode: error.statusCode || 500,
  });

  metrics.apiErrorTotal.inc({
    method,
    path,
    error_type: error.name || "UnknownError",
  });

  // Alertar erros 500
  if (!error.statusCode || error.statusCode >= 500) {
    await alerting.warning(
      "API Error",
      `${method} ${path} failed: ${error.message}`,
      { stack: error.stack }
    );
  }

  reply.status(error.statusCode || 500).send({
    error: error.message,
    requestId: (request as any).requestId,
  });
});

// ============================================================================
// 4. HEALTH CHECK ENDPOINTS
// ============================================================================

app.get("/health", async (req, res) => {
  const alive = await healthCheck.liveness();
  res.status(alive ? 200 : 503).send({ alive });
});

app.get("/health/ready", async (req, res) => {
  const ready = await healthCheck.readiness();
  res.status(ready ? 200 : 503).send({ ready });
});

app.get("/health/detailed", async (req, res) => {
  const health = await healthCheck.detailed();
  const statusCode = health.status === "healthy" ? 200 :
                     health.status === "degraded" ? 200 : 503;
  res.status(statusCode).send(health);
});

// ============================================================================
// 5. METRICS ENDPOINT
// ============================================================================

app.get("/metrics", async (req, res) => {
  res.header("Content-Type", "text/plain");
  res.send(await metrics.getMetrics());
});

// ============================================================================
// 6. EXEMPLO DE ENDPOINTS COM OBSERVABILIDADE
// ============================================================================

// Endpoint simples
app.get("/api/ping", async (req, res) => {
  apiLogger.info("Ping received");
  return { pong: true, timestamp: new Date().toISOString() };
});

// Endpoint com query ao banco de dados
app.get("/api/positions", async (req, res) => {
  const startTime = Date.now();

  try {
    // Simular query ao banco
    const result = await pgPool.query("SELECT * FROM positions WHERE user_id = $1", [1]);

    const duration = Date.now() - startTime;

    // Métricas de database
    metrics.dbQueryTotal.inc({ operation: "SELECT", table: "positions" });
    metrics.dbQueryDuration.observe({ operation: "SELECT", table: "positions" }, duration);

    apiLogger.info("Positions fetched", { count: result.rows.length, duration });

    return { positions: result.rows };
  } catch (error) {
    metrics.dbQueryErrors.inc({
      operation: "SELECT",
      table: "positions",
      error_type: (error as Error).name
    });

    throw error;
  }
});

// Endpoint com Redis
app.get("/api/cache/:key", async (req, res) => {
  const { key } = req.params as { key: string };
  const startTime = Date.now();

  try {
    const value = await redis.get(key);

    const duration = Date.now() - startTime;

    // Métricas de Redis
    metrics.redisCommandTotal.inc({ command: "GET" });
    metrics.redisCommandDuration.observe({ command: "GET" }, duration);

    apiLogger.debug("Cache lookup", { key, hit: !!value, duration });

    return { key, value, hit: !!value };
  } catch (error) {
    metrics.redisCommandErrors.inc({
      command: "GET",
      error_type: (error as Error).name
    });

    throw error;
  }
});

// Endpoint que simula trading
app.post("/api/trade", async (req, res) => {
  const { symbol, side, quantity } = req.body as any;

  apiLogger.logTrade("requested", { symbol, side, quantity });

  try {
    // Simular execução de ordem
    await new Promise(resolve => setTimeout(resolve, 100));

    // Métricas de trading
    metrics.tradingOrdersExecuted.inc({
      symbol,
      side,
      type: "MARKET"
    });

    metrics.tradingPositionsOpened.inc({ symbol, side });
    metrics.tradingActivePositions.inc({ symbol });

    apiLogger.logPosition("opened", { symbol, side, quantity });

    // Alerta informativo
    await alerting.info(
      "Position Opened",
      `${side} ${quantity} ${symbol}`,
      { symbol, side, quantity }
    );

    return {
      success: true,
      orderId: `order_${Date.now()}`,
      symbol,
      side,
      quantity
    };
  } catch (error) {
    metrics.tradingOrdersFailed.inc({
      symbol,
      side,
      type: "MARKET",
      reason: (error as Error).message
    });

    await alerting.alertOrderFailed(symbol, side, (error as Error).message);

    throw error;
  }
});

// Endpoint que simula erro
app.get("/api/error", async (req, res) => {
  throw new Error("Simulated error for testing");
});

// ============================================================================
// 7. BACKGROUND TASKS COM OBSERVABILIDADE
// ============================================================================

// Simular worker que processa ticks
setInterval(async () => {
  const startTime = Date.now();

  try {
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    const duration = Date.now() - startTime;

    metrics.workerTicksProcessed.inc({ worker_type: "market_data" });
    metrics.workerTickDuration.observe({ worker_type: "market_data" }, duration);

    // Gerar sinal aleatório
    if (Math.random() > 0.9) {
      metrics.workerSignalsGenerated.inc({
        signal_type: "BUY",
        symbol: "BTCUSDT"
      });

      logger.logSignal({
        type: "BUY",
        symbol: "BTCUSDT",
        confidence: 0.85
      });
    }
  } catch (error) {
    logger.error("Worker tick failed", error as Error);
    await alerting.warning("Worker Error", `Tick processing failed: ${(error as Error).message}`);
  }
}, 5000);

// Monitorar métricas de trading periodicamente
setInterval(async () => {
  // Simular cálculo de P&L
  const pnl = Math.random() * 1000 - 500;
  const winRate = Math.random() * 100;

  metrics.tradingPnL.set({ period: "24h" }, pnl);
  metrics.tradingWinRate.set({ period: "24h" }, winRate);

  // Alertar se P&L muito negativo
  if (pnl < -300) {
    await alerting.warning(
      "Negative P&L",
      `24h P&L is $${pnl.toFixed(2)}`,
      { pnl, period: "24h" }
    );
  }
}, 10000);

// ============================================================================
// 8. GRACEFUL SHUTDOWN
// ============================================================================

async function shutdown() {
  apiLogger.info("Shutting down gracefully");
  await alerting.info("API Shutdown", "API server is shutting down");

  await app.close();
  await pgPool.end();
  await redis.quit();

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ============================================================================
// 9. FATAL ERROR HANDLERS
// ============================================================================

process.on("uncaughtException", async (error) => {
  apiLogger.fatal("Uncaught exception", error);
  await alerting.alertFatalError("api-example", error);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  apiLogger.fatal("Unhandled rejection", reason as Error);
  await alerting.alertFatalError("api-example", reason as Error);
  process.exit(1);
});

// ============================================================================
// 10. START SERVER
// ============================================================================

async function start() {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });

    apiLogger.info("Server started", {
      port: 3000,
      env: process.env.NODE_ENV || "development"
    });

    await alerting.info(
      "API Started",
      "API server is now running on port 3000"
    );

    console.log("\n🚀 Server running on http://localhost:3000");
    console.log("\n📊 Endpoints:");
    console.log("  - GET  /health");
    console.log("  - GET  /health/ready");
    console.log("  - GET  /health/detailed");
    console.log("  - GET  /metrics");
    console.log("  - GET  /api/ping");
    console.log("  - GET  /api/positions");
    console.log("  - GET  /api/cache/:key");
    console.log("  - POST /api/trade");
    console.log("  - GET  /api/error (test error handling)");
    console.log("\n");
  } catch (error) {
    apiLogger.fatal("Failed to start server", error as Error);
    await alerting.alertFatalError("api-example", error as Error);
    process.exit(1);
  }
}

start();
