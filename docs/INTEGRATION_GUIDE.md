# Guia de Integração - Sistema de Observabilidade

Este guia mostra como integrar o sistema de observabilidade nos serviços existentes do projeto Trade.

## Resumo das Mudanças

Para cada serviço (api, worker, telegram-bot), você precisará:

1. Importar os módulos de observabilidade
2. Configurar logger específico do serviço
3. Registrar dependências no health check
4. Adicionar middleware de métricas
5. Configurar alertas
6. Adicionar endpoints de health e metrics

## 1. API Server (`apps/api/src/server.ts`)

### Mudanças Necessárias

```typescript
// No início do arquivo, adicionar imports
import { logger, createLogger, metrics, healthCheck, alerting } from "@trade/shared";

// Criar logger específico
const apiLogger = createLogger("api");

// Após criar o app, registrar dependências
if (process.env.DATABASE_URL) {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();
  healthCheck.registerPostgres(pgClient);
}

// Substituir console.log por logger
apiLogger.info("Running PostgreSQL migrations");
apiLogger.info("Migrations completed successfully");
apiLogger.info("HTTP server listening", { host, port });
apiLogger.info("WebSocket server ready", { host, port, path: "/ws" });

// Adicionar error handlers
process.on("uncaughtException", async (error) => {
  apiLogger.fatal("Uncaught exception", error);
  await alerting.alertFatalError("api", error);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  apiLogger.fatal("Unhandled rejection", reason as Error);
  await alerting.alertFatalError("api", reason as Error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  apiLogger.info("SIGTERM received, shutting down gracefully");
  await alerting.info("API Shutdown", "API server is shutting down");
  await app.close();
  process.exit(0);
});
```

### Adicionar no `apps/api/src/app.ts`

```typescript
import { metrics, logger } from "@trade/shared";

// Adicionar middleware de logging e métricas
app.addHook("onRequest", async (request, reply) => {
  (request as any).startTime = Date.now();
  (request as any).requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
});

app.addHook("onResponse", async (request, reply) => {
  const duration = Date.now() - (request as any).startTime;
  const method = request.method;
  const path = request.routerPath || request.url;
  const status = reply.statusCode.toString();

  // Métricas
  metrics.apiRequestTotal.inc({ method, path, status });
  metrics.apiRequestDuration.observe({ method, path }, duration);

  if (reply.statusCode >= 400) {
    metrics.apiErrorTotal.inc({ method, path, error_type: "http_error" });
  }

  // Log
  logger.logAPI(method, path, reply.statusCode, duration);
});

// Adicionar endpoints de observabilidade
app.get("/health", async (req, res) => {
  const alive = await healthCheck.liveness();
  return { alive };
});

app.get("/health/ready", async (req, res) => {
  const ready = await healthCheck.readiness();
  if (!ready) {
    res.status(503);
  }
  return { ready };
});

app.get("/health/detailed", async (req, res) => {
  const health = await healthCheck.detailed();
  if (health.status === "unhealthy") {
    res.status(503);
  }
  return health;
});

app.get("/metrics", async (req, res) => {
  res.header("Content-Type", "text/plain");
  return await metrics.getMetrics();
});
```

## 2. Worker (`apps/worker/src/worker.ts`)

### Mudanças Necessárias

```typescript
import { logger, createLogger, metrics, healthCheck, alerting } from "@trade/shared";

const workerLogger = createLogger("worker");

// No início do worker
workerLogger.info("Worker starting");
await alerting.info("Worker Started", "Trading worker is now running");

// Registrar dependências
if (pgPool) {
  healthCheck.registerPostgres(pgPool);
}
if (redis) {
  healthCheck.registerRedis(redis);
}

// No loop principal (tick)
async function tick() {
  const startTime = Date.now();
  
  try {
    workerLogger.debug("Processing tick");
    
    // ... processamento existente ...
    
    const duration = Date.now() - startTime;
    metrics.workerTicksProcessed.inc({ worker_type: "main" });
    metrics.workerTickDuration.observe({ worker_type: "main" }, duration);
    
    if (duration > 5000) {
      workerLogger.warn("Slow tick detected", { duration });
    }
  } catch (error) {
    workerLogger.error("Tick failed", error as Error);
    await alerting.warning("Worker Error", `Tick processing failed: ${(error as Error).message}`);
  }
}

// Quando gerar sinais
workerLogger.logSignal({ type: "BUY", symbol: "BTCUSDT", confidence: 0.85 });
metrics.workerSignalsGenerated.inc({ signal_type: "BUY", symbol: "BTCUSDT" });

// Quando abrir posição
workerLogger.logPosition("opened", { symbol: "BTCUSDT", side: "LONG" });
metrics.tradingPositionsOpened.inc({ symbol: "BTCUSDT", side: "LONG" });
metrics.tradingActivePositions.inc({ symbol: "BTCUSDT" });

// Quando fechar posição
workerLogger.logPosition("closed", { symbol: "BTCUSDT", pnl: 150.50 });
metrics.tradingPositionsClosed.inc({ symbol: "BTCUSDT", side: "LONG", reason: "take_profit" });
metrics.tradingActivePositions.dec({ symbol: "BTCUSDT" });

// Error handlers
process.on("uncaughtException", async (error) => {
  workerLogger.fatal("Uncaught exception", error);
  await alerting.alertFatalError("worker", error);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  workerLogger.fatal("Unhandled rejection", reason as Error);
  await alerting.alertFatalError("worker", reason as Error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  workerLogger.info("SIGTERM received, shutting down gracefully");
  await alerting.info("Worker Shutdown", "Worker is shutting down");
  process.exit(0);
});
```

## 3. Telegram Bot (`apps/telegram-bot/src/bot.ts`)

### Mudanças Necessárias

```typescript
import { logger, createLogger, alerting, healthCheck } from "@trade/shared";

const botLogger = createLogger("telegram-bot");

// Registrar função de envio de alertas
alerting.registerSendFunction(async (message) => {
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID!;
  await bot.telegram.sendMessage(chatId, message, {
    parse_mode: "Markdown",
  });
});

// No início
botLogger.info("Telegram bot starting");
await alerting.info("Bot Started", "Telegram bot is now running");

// Em cada comando
bot.command("start", async (ctx) => {
  botLogger.info("Command received", { command: "start", userId: ctx.from.id });
  // ... resto do código ...
});

bot.command("status", async (ctx) => {
  botLogger.info("Command received", { command: "status", userId: ctx.from.id });
  
  const health = await healthCheck.detailed();
  
  let message = `*System Status*\n\n`;
  message += `Overall: ${health.status.toUpperCase()}\n`;
  message += `Uptime: ${Math.round(health.uptime / 1000)}s\n\n`;
  
  for (const [component, status] of Object.entries(health.components)) {
    const emoji = status.status === "healthy" ? "✅" : 
                  status.status === "degraded" ? "⚠️" : "❌";
    message += `${emoji} ${component}: ${status.status}\n`;
  }
  
  await ctx.reply(message, { parse_mode: "Markdown" });
});

// Error handlers
bot.catch(async (error) => {
  botLogger.error("Bot error", error as Error);
  await alerting.warning("Bot Error", `Telegram bot error: ${(error as Error).message}`);
});

process.on("uncaughtException", async (error) => {
  botLogger.fatal("Uncaught exception", error);
  await alerting.alertFatalError("telegram-bot", error);
  process.exit(1);
});
```

## 4. Checklist de Integração

- [ ] Compilar shared package: `npm run build -w packages/shared`
- [ ] Integrar logger no API server
- [ ] Integrar logger no Worker
- [ ] Integrar logger no Telegram Bot
- [ ] Adicionar endpoints `/health`, `/health/ready`, `/health/detailed`, `/metrics` na API
- [ ] Registrar dependências (PostgreSQL, Redis) no health check
- [ ] Adicionar métricas de database e Redis
- [ ] Configurar alertas via Telegram
- [ ] Testar endpoints de health check
- [ ] Testar endpoint de métricas
- [ ] Configurar Prometheus para scraping
- [ ] Criar dashboards no Grafana

## 5. Variáveis de Ambiente

Adicionar ao `.env`:

```bash
# Logging
LOG_LEVEL=info
NODE_ENV=production

# Alerting
TELEGRAM_ALERT_CHAT_ID=your-alert-chat-id
```
