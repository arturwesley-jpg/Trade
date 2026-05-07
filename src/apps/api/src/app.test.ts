import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryTradingRepository } from "@trade/trading-core";
import type { FastifyInstance } from "fastify";

describe("API app", () => {
  const appsToClose: FastifyInstance[] = [];
  const createTestApp = (overrides: Parameters<typeof buildApp>[0] = {}) => {
    const app = buildApp({ disableRedisSubscriber: true, ...overrides });
    appsToClose.push(app);
    return app;
  };

  afterEach(async () => {
    await Promise.all(appsToClose.splice(0).map((app) => app.close()));
  });

  it("returns health status with safe default mode", async () => {
    const app = createTestApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      status: "ok",
      mode: "paper",
      liveTradingEnabled: false
    });
  });

  it("opens an idempotent paper position", async () => {
    const app = createTestApp();
    const payload = {
      idempotencyKey: "api-open-1",
      symbol: "BTC-USDT",
      side: "LONG",
      mode: "paper",
      entryPrice: 100000,
      stopLossPrice: 98000,
      takeProfitPrice: 104000,
      marginUsdt: 100,
      leverage: 2
    };

    const first = await app.inject({ method: "POST", url: "/orders/paper", payload });
    const second = await app.inject({ method: "POST", url: "/orders/paper", payload });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(first.json().data.position.id).toBe(second.json().data.position.id);
  });

  it("rejects live orders at the API boundary", async () => {
    const app = createTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/orders/paper",
      payload: {
        idempotencyKey: "live-block",
        symbol: "BTC-USDT",
        side: "LONG",
        mode: "live",
        entryPrice: 100000,
        stopLossPrice: 99000,
        marginUsdt: 100,
        leverage: 1
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "PAPER_ONLY_ENDPOINT",
        message: expect.stringContaining("Only paper mode is accepted"),
        correlationId: expect.any(String)
      }
    });
  });

  it("returns structured validation errors with correlation ids", async () => {
    const app = createTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/orders/paper",
      payload: {
        idempotencyKey: "bad",
        symbol: "DOGE-USDT",
        side: "LONG",
        mode: "paper",
        entryPrice: -1,
        marginUsdt: 0,
        leverage: 2
      }
    });

    const body = response.json();
    expect(response.statusCode).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid paper order payload",
      correlationId: expect.any(String)
    });
    expect(body.error.issues.length).toBeGreaterThan(0);
  });

  it("exposes read-only intelligence endpoints with explicit simulated sources", async () => {
    const app = createTestApp();

    const providers = await app.inject({ method: "GET", url: "/providers/status" });
    const fearGreed = await app.inject({ method: "GET", url: "/fear-greed" });
    const news = await app.inject({ method: "GET", url: "/news" });
    const onchain = await app.inject({ method: "GET", url: "/onchain/events" });
    const alerts = await app.inject({ method: "GET", url: "/alerts" });
    const paperStatus = await app.inject({ method: "GET", url: "/paper-trading/status" });

    expect(providers.json().data).toMatchObject({
      source: "simulated",
      recommendedProvider: expect.any(String),
      failoverOrder: expect.any(Array),
      dataQualityScore: expect.any(Number),
      shouldEmitWait: expect.any(Boolean)
    });
    expect(fearGreed.json().data).toMatchObject({ source: expect.stringMatching(/^(simulated|external)$/), fearGreedScore: expect.any(Number) });
    expect(news.json().data).toMatchObject({ source: expect.stringMatching(/^(simulated|rss|external)$/), sentiment: { score: expect.any(Number) } });
    expect(onchain.json().data).toMatchObject({ source: "simulated", score: { onchainBias: expect.any(String) } });
    expect(alerts.json().data.length).toBeGreaterThan(0);
    expect(paperStatus.json().data.metrics).toMatchObject({ totalTrades: 0, winRate: 0 });
  });

  it("can reuse an injected repository across app instances", async () => {
    const repository = new InMemoryTradingRepository();
    const firstApp = createTestApp({ repository });
    const payload = {
      idempotencyKey: "persist-api-1",
      symbol: "BTC-USDT",
      side: "LONG",
      mode: "paper",
      entryPrice: 100000,
      stopLossPrice: 98000,
      marginUsdt: 100,
      leverage: 2
    };

    await firstApp.inject({ method: "POST", url: "/orders/paper", payload });
    const secondApp = createTestApp({ repository });
    const positions = await secondApp.inject({ method: "GET", url: "/positions" });

    expect(positions.json().data).toHaveLength(1);
    expect(positions.json().data[0]).toMatchObject({ symbol: "BTC-USDT", status: "OPEN" });
  });

  it("serves persisted market ticks before demo ticks", async () => {
    const repository = new InMemoryTradingRepository();
    repository.saveMarketTick({
      symbol: "BTC-USDT",
      price: 101_500,
      change24hPct: 1.5,
      timestamp: 123,
      source: "simulated"
    });
    const app = createTestApp({ repository });

    const allTicks = await app.inject({ method: "GET", url: "/market/ticker" });
    const btcTick = await app.inject({ method: "GET", url: "/market/ticker?symbol=BTC-USDT" });

    expect(allTicks.json().data).toHaveLength(1);
    expect(btcTick.json().data).toMatchObject({ symbol: "BTC-USDT", price: 101_500, timestamp: 123 });
  });

  it("protects admin endpoints with a configured admin token", async () => {
    const app = createTestApp({ adminToken: "secret-admin-token" });

    const blocked = await app.inject({ method: "GET", url: "/admin/audit-logs" });
    const allowed = await app.inject({
      method: "GET",
      url: "/admin/audit-logs",
      headers: { "x-admin-token": "secret-admin-token" }
    });

    expect(blocked.statusCode).toBe(401);
    expect(blocked.json().error.code).toBe("UNAUTHORIZED");
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data).toMatchObject({ source: "memory", auditLogs: [] });
  });

  it("exposes frontend-compatible alert, sentiment, whale, and paper summary contracts", async () => {
    const app = createTestApp();

    const alerts = await app.inject({ method: "GET", url: "/alerts" });
    const sentiment = await app.inject({ method: "GET", url: "/sentiment/fear-greed" });
    const whales = await app.inject({ method: "GET", url: "/whales/events" });
    const paper = await app.inject({ method: "GET", url: "/paper/summary" });

    expect(alerts.json().data[0]).toMatchObject({
      id: expect.any(String),
      type: expect.any(String),
      status: "OPEN",
      title: expect.any(String)
    });
    expect(sentiment.json().data).toMatchObject({
      score: expect.any(Number),
      label: expect.any(String),
      source: expect.stringMatching(/^(simulated|external)$/)
    });
    expect(whales.json().data[0]).toMatchObject({
      id: expect.any(String),
      type: "EXCHANGE_OUTFLOW",
      source: "simulated"
    });
    expect(paper.json().data).toMatchObject({
      openPositions: 0,
      closedTrades: 0,
      realizedPnlUsdt: 0
    });
  });
});
