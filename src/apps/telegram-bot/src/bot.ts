import { Telegraf } from "telegraf";
import { createServer } from "node:http";
import { createTelegramAccessPolicy, TelegramRateLimiter } from "./access-policy.js";
import { fetchApi, formatError } from "./api-client.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
const alertSubscribers = new Set<string>();
const accessPolicy = createTelegramAccessPolicy({
  appEnv: process.env.APP_ENV ?? "development",
  allowedUserIds: process.env.TELEGRAM_ALLOWED_USER_IDS ?? "",
  adminUserIds: process.env.TELEGRAM_ADMIN_IDS ?? ""
});
const rateLimiter = new TelegramRateLimiter({
  maxRequests: Number(process.env.TELEGRAM_RATE_LIMIT_MAX ?? 20),
  windowMs: Number(process.env.TELEGRAM_RATE_LIMIT_WINDOW_MS ?? 60_000)
});

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required to start the bot.");
  process.exit(1);
}

const bot = new Telegraf(token);

bot.use(async (ctx, next) => {
  const fromId = ctx.from?.id?.toString();
  const access = accessPolicy.checkUser(fromId);
  if (!access.allowed) {
    await ctx.reply(`Acesso negado. ${access.reason}. Seu Telegram ID: ${fromId ?? "indisponivel"}`);
    return;
  }
  if (!fromId) {
    await ctx.reply("Acesso negado. Telegram user id is missing");
    return;
  }
  const rate = rateLimiter.check(fromId);
  if (!rate.allowed) {
    await ctx.reply(`Rate limit ativo. Tente novamente em ${Math.ceil((rate.retryAfterMs ?? 0) / 1000)}s.`);
    return;
  }
  await next();
});

bot.start(async (ctx) => {
  await replyHelp(ctx);
});

bot.help(async (ctx) => replyHelp(ctx));

bot.command("status", async (ctx) => {
  try {
    const health = await fetchApi<any>("/health", apiBaseUrl);
    await ctx.reply(
      `🔍 *Status do Sistema*\n\n` +
      `Status: \`${health.status}\`\n` +
      `Modo: \`${health.mode}\`\n` +
      `Live Trading: \`${health.liveTradingEnabled ? 'Habilitado' : 'Desabilitado'}\``,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("signals", async (ctx) => {
  try {
    const signals = await fetchApi<any[]>("/signals", apiBaseUrl);
    if (!Array.isArray(signals) || signals.length === 0) {
      await ctx.reply("📊 Sem sinais disponíveis no momento.");
      return;
    }
    const lines = signals.map((signal) =>
      `📈 *${signal.symbol}*\n` +
      `Direção: \`${signal.direction}\`\n` +
      `Confiança: \`${signal.confidence}\`\n` +
      `${signal.rationale}`
    );
    await ctx.reply(`📊 *Sinais Disponíveis*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("signal", async (ctx) => {
  try {
    const symbol = readSymbol(ctx.message.text);
    const signal = await fetchApi<any>(`/signals/${encodeURIComponent(symbol)}`, apiBaseUrl);
    if (!signal) {
      await ctx.reply(`📊 Sem sinal disponível para *${symbol}*`, { parse_mode: "Markdown" });
      return;
    }
    await ctx.reply(
      `📈 *${signal.symbol}*\n\n` +
      `Direção: \`${signal.direction}\`\n` +
      `Confiança: \`${signal.confidence}\`\n\n` +
      `${signal.rationale}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("market", async (ctx) => {
  try {
    const symbol = readSymbol(ctx.message.text);
    const tick = await fetchApi<any>(`/market/ticker?symbol=${encodeURIComponent(symbol)}`, apiBaseUrl);
    if (!tick) {
      await ctx.reply(`📉 Sem dados de mercado para *${symbol}*`, { parse_mode: "Markdown" });
      return;
    }
    await ctx.reply(
      `📊 *${tick.symbol}*\n\n` +
      `Preço: \`$${tick.price}\`\n` +
      `Variação 24h: \`${tick.change24hPct ?? "n/d"}%\`\n` +
      `Fonte: \`${tick.source}\``,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("feargreed", async (ctx) => {
  try {
    const index = await fetchApi<any>("/fear-greed", apiBaseUrl);
    await ctx.reply(
      `😱📈 *Índice Medo/Ganância*\n\n` +
      `Score: \`${index.fearGreedScore}/100\`\n` +
      `Classificação: \`${index.label}\`\n` +
      `Confiança: \`${index.confidence}%\`\n\n` +
      `${index.explanation}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("news", async (ctx) => {
  try {
    const news = await fetchApi<any>("/news", apiBaseUrl);
    const lines = news.items.map((item: any) => `• *${item.source}*: ${item.title}`);
    await ctx.reply(
      `📰 *Notícias Crypto*\n\n` +
      `Sentimento: \`${news.sentiment.score}\`\n\n` +
      `${lines.join("\n")}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("alerts_on", async (ctx) => {
  const id = ctx.from?.id?.toString();
  if (id) alertSubscribers.add(id);
  await ctx.reply("🔔 Alertas paper/simulados ativados para este usuário.");
});

bot.command("alerts_off", async (ctx) => {
  const id = ctx.from?.id?.toString();
  if (id) alertSubscribers.delete(id);
  await ctx.reply("🔕 Alertas desativados para este usuário.");
});

bot.command("paper_status", async (ctx) => {
  try {
    const status = await fetchApi<any>("/paper-trading/status", apiBaseUrl);
    await ctx.reply(
      `📊 *Status Paper Trading*\n\n` +
      `Trades: \`${status.metrics.totalTrades}\`\n` +
      `Win Rate: \`${status.metrics.winRate}%\`\n` +
      `Profit Factor: \`${status.metrics.profitFactor}\`\n` +
      `Posições Abertas: \`${status.openPositions}\``,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("paper_trades", async (ctx) => {
  try {
    const trades = await fetchApi<any[]>("/paper-trading/trades", apiBaseUrl);
    if (!Array.isArray(trades) || trades.length === 0) {
      await ctx.reply("📝 Nenhum trade paper fechado.");
      return;
    }
    const lines = trades.map((trade: any) =>
      `💼 *${trade.symbol}* ${trade.side}\n` +
      `PnL: \`${trade.pnlUsdt > 0 ? '+' : ''}${trade.pnlUsdt} USDT\``
    );
    await ctx.reply(`📝 *Trades Paper*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("positions", async (ctx) => {
  try {
    const positions = await fetchApi<any[]>("/positions", apiBaseUrl);
    if (!Array.isArray(positions) || positions.length === 0) {
      await ctx.reply("💼 Nenhuma posição paper aberta.");
      return;
    }
    const lines = positions.map((position: any) =>
      `💼 *${position.symbol}* ${position.side}\n` +
      `Status: \`${position.status}\`\n` +
      `Entrada: \`$${position.entryPrice}\`\n` +
      `PnL: \`${position.pnlUsdt > 0 ? '+' : ''}${position.pnlUsdt} USDT\``
    );
    await ctx.reply(`💼 *Posições Paper*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

bot.command("admin_status", async (ctx) => {
  if (!isAdmin(ctx.from?.id?.toString())) return ctx.reply("⛔ Comando restrito a ADM.");
  try {
    const providers = await fetchApi<any>("/providers/status", apiBaseUrl);
    await ctx.reply(
      `🔧 *Status Providers*\n\n` +
      `Provider Recomendado: \`${providers.recommendedProvider}\`\n` +
      `Data Quality Score: \`${providers.dataQualityScore}\``,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    await ctx.reply(formatError(error));
  }
});

for (const command of ["admin_strategy_create", "admin_strategy_pause", "admin_strategy_resume"]) {
  bot.command(command, async (ctx) => {
    if (!isAdmin(ctx.from?.id?.toString())) return ctx.reply("Comando restrito a ADM.");
    await ctx.reply("Estratégias fictícias ADM estão planejadas, mas aguardam banco, auditoria e permissões persistentes.");
  });
}

bot.catch((error) => {
  console.error("telegram_bot_error", error);
});

startHealthServer();
await launchBotWithRetry();

async function replyHelp(ctx: any): Promise<void> {
  await ctx.reply(
    `🤖 *Crypto Trading Bot Pro*\n` +
    `_Modo seguro paper trading_\n\n` +
    `*Comandos Disponíveis:*\n\n` +
    `🔍 /status - Status do sistema\n` +
    `📊 /market BTC-USDT - Dados de mercado\n` +
    `📈 /signal BTC-USDT - Sinal de um ativo\n` +
    `📊 /signals - Todos os sinais\n` +
    `😱 /feargreed - Índice Medo/Ganância\n` +
    `📰 /news - Notícias crypto\n` +
    `🔔 /alerts_on - Ativar alertas\n` +
    `🔕 /alerts_off - Desativar alertas\n` +
    `📊 /paper_status - Métricas paper trading\n` +
    `📝 /paper_trades - Trades fechados\n` +
    `💼 /positions - Posições abertas\n` +
    `🔧 /admin_status - Status providers (ADM)\n\n` +
    `⚠️ *Trade real está desabilitado.*`,
    { parse_mode: "Markdown" }
  );
}

function readSymbol(text: string): string {
  return text.split(/\s+/)[1]?.trim().toUpperCase() || "BTC-USDT";
}

function isAdmin(id: string | undefined): boolean {
  return accessPolicy.isAdmin(id);
}

async function launchBotWithRetry(): Promise<void> {
  let attempt = 0;
  while (true) {
    try {
      await bot.launch();
      console.log("Telegram bot started in safe paper-first mode.");
      return;
    } catch (error) {
      attempt += 1;
      const message = error instanceof Error ? error.message : String(error);
      const isConflict409 = message.includes("409") || message.includes("terminated by other getUpdates request");
      const backoffMs = Math.min(30_000, 2_000 * attempt);
      if (isConflict409) {
        console.warn(`Telegram polling conflict (409). Retrying in ${Math.ceil(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
}

function startHealthServer(): void {
  const port = Number(process.env.PORT ?? 3000);
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: "ok", service: "trade-telegram-bot" }));
      return;
    }
    res.statusCode = 200;
    res.end("ok");
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Telegram bot health server listening on :${port}`);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
