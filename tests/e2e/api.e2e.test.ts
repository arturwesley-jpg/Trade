import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../../apps/api/src/app.js";
import { InMemoryTradingRepository } from "@trade/trading-core";
import { RedisPublisher } from "@trade/shared";
import type { FastifyInstance } from "fastify";
import {
  createTestContext,
  waitForRedisMessage,
  generateIdempotencyKey,
  sleep,
  waitForCondition,
  type TestContext
} from "./helpers.js";

describe("API E2E Tests", () => {
  let app: FastifyInstance;
  let context: TestContext;
  let repository: InMemoryTradingRepository;

  beforeEach(async () => {
    context = await createTestContext();
    repository = new InMemoryTradingRepository();
    app = buildApp({ repository });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await context.cleanup();
  });

  describe("Market Data Flow", () => {
    it("receives market tick from worker via Redis and serves it via API", async () => {
      const publisher = new RedisPublisher(context.redis);
      const tick = {
        symbol: "BTC-USDT",
        price: 101500,
        change24hPct: 1.5,
        volume24h: 1000000,
        timestamp: Date.now(),
        source: "bingx"
      };

      // Publish tick to Redis
      await publisher.publishTick(tick);

      // Wait for API to process the tick
      await sleep(100);

      // Verify API serves the tick
      const response = await app.inject({
        method: "GET",
        url: "/market/ticker?symbol=BTC-USDT"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        symbol: "BTC-USDT",
        price: 101500,
        source: "bingx"
      });
    });

    it("updates frontend via WebSocket when new tick arrives", async () => {
      const publisher = new RedisPublisher(context.redis);

      // Wait for WebSocket message
      const messagePromise = waitForRedisMessage(context.redis, "market:ticks");

      const tick = {
        symbol: "ETH-USDT",
        price: 3100,
        change24hPct: 2.0,
        volume24h: 500000,
        timestamp: Date.now(),
        source: "bingx"
      };

      await publisher.publishTick(tick);

      const receivedTick = await messagePromise;
      expect(receivedTick).toMatchObject({
        symbol: "ETH-USDT",
        price: 3100
      });
    });

    it("handles multiple concurrent ticks without data loss", async () => {
      const publisher = new RedisPublisher(context.redis);
      const ticks = Array.from({ length: 100 }, (_, i) => ({
        symbol: i % 2 === 0 ? "BTC-USDT" : "ETH-USDT",
        price: i % 2 === 0 ? 100000 + i : 3000 + i,
        change24hPct: 0,
        volume24h: 0,
        timestamp: Date.now() + i,
        source: "bingx"
      }));

      // Publish all ticks
      await Promise.all(ticks.map(tick => publisher.publishTick(tick)));

      // Wait for processing
      await sleep(500);

      // Verify both symbols have latest data
      const btcResponse = await app.inject({
        method: "GET",
        url: "/market/ticker?symbol=BTC-USDT"
      });
      const ethResponse = await app.inject({
        method: "GET",
        url: "/market/ticker?symbol=ETH-USDT"
      });

      expect(btcResponse.statusCode).toBe(200);
      expect(ethResponse.statusCode).toBe(200);
      expect(btcResponse.json().data.price).toBeGreaterThan(100000);
      expect(ethResponse.json().data.price).toBeGreaterThan(3000);
    });
  });

  describe("Signal Generation Flow", () => {
    it("generates signal when market data arrives", async () => {
      const publisher = new RedisPublisher(context.redis);

      // Publish multiple ticks to build candle data
      for (let i = 0; i < 10; i++) {
        await publisher.publishTick({
          symbol: "BTC-USDT",
          price: 100000 + i * 100,
          change24hPct: 1.0,
          volume24h: 1000000,
          timestamp: Date.now() + i * 1000,
          source: "bingx"
        });
        await sleep(50);
      }

      // Check signals endpoint
      const response = await app.inject({
        method: "GET",
        url: "/signals"
      });

      expect(response.statusCode).toBe(200);
      const signals = response.json().data;
      expect(Array.isArray(signals)).toBe(true);
    });

    it("calculates technical indicators from tick data", async () => {
      const publisher = new RedisPublisher(context.redis);

      // Publish ticks with upward trend
      for (let i = 0; i < 20; i++) {
        await publisher.publishTick({
          symbol: "BTC-USDT",
          price: 100000 + i * 500,
          change24hPct: 2.0,
          volume24h: 2000000,
          timestamp: Date.now() + i * 1000,
          source: "bingx"
        });
        await sleep(50);
      }

      // Get signal details
      const response = await app.inject({
        method: "GET",
        url: "/signals/BTC-USDT"
      });

      expect(response.statusCode).toBe(200);
      const signal = response.json().data;
      expect(signal).toHaveProperty("direction");
      expect(signal).toHaveProperty("strength");
      expect(signal).toHaveProperty("indicators");
    });
  });

  describe("Order Execution Flow", () => {
    it("executes complete order flow: signal → order → position → TP", async () => {
      const idempotencyKey = generateIdempotencyKey();

      // Step 1: Create paper order
      const orderResponse = await app.inject({
        method: "POST",
        url: "/orders/paper",
        payload: {
          idempotencyKey,
          symbol: "BTC-USDT",
          side: "LONG",
          mode: "paper",
          entryPrice: 100000,
          stopLossPrice: 98000,
          takeProfitPrice: 104000,
          marginUsdt: 100,
          leverage: 2
        }
      });

      expect(orderResponse.statusCode).toBe(201);
      const { position } = orderResponse.json().data;
      expect(position.status).toBe("OPEN");

      // Step 2: Verify position is open
      const positionsResponse = await app.inject({
        method: "GET",
        url: "/positions"
      });

      expect(positionsResponse.statusCode).toBe(200);
      const positions = positionsResponse.json().data;
      expect(positions).toHaveLength(1);
      expect(positions[0].id).toBe(position.id);

      // Step 3: Simulate price reaching take profit
      const publisher = new RedisPublisher(context.redis);
      await publisher.publishTick({
        symbol: "BTC-USDT",
        price: 104000,
        change24hPct: 4.0,
        volume24h: 1000000,
        timestamp: Date.now(),
        source: "bingx"
      });

      // Wait for position to close
      await waitForCondition(async () => {
        const resp = await app.inject({ method: "GET", url: "/positions" });
        return resp.json().data.length === 0;
      }, 5000);

      // Step 4: Verify trade is recorded
      const tradesResponse = await app.inject({
        method: "GET",
        url: "/trades"
      });

      expect(tradesResponse.statusCode).toBe(200);
      const trades = tradesResponse.json().data;
      expect(trades).toHaveLength(1);
      expect(trades[0].exitReason).toBe("TAKE_PROFIT");
      expect(trades[0].realizedPnlUsdt).toBeGreaterThan(0);
    });

    it("executes stop loss when price moves against position", async () => {
      const idempotencyKey = generateIdempotencyKey();

      // Create SHORT position
      const orderResponse = await app.inject({
        method: "POST",
        url: "/orders/paper",
        payload: {
          idempotencyKey,
          symbol: "BTC-USDT",
          side: "SHORT",
          mode: "paper",
          entryPrice: 100000,
          stopLossPrice: 102000,
          takeProfitPrice: 96000,
          marginUsdt: 100,
          leverage: 2
        }
      });

      expect(orderResponse.statusCode).toBe(201);

      // Simulate price going up (against SHORT)
      const publisher = new RedisPublisher(context.redis);
      await publisher.publishTick({
        symbol: "BTC-USDT",
        price: 102000,
        change24hPct: 2.0,
        volume24h: 1000000,
        timestamp: Date.now(),
        source: "bingx"
      });

      // Wait for position to close
      await waitForCondition(async () => {
        const resp = await app.inject({ method: "GET", url: "/positions" });
        return resp.json().data.length === 0;
      }, 5000);

      // Verify trade shows loss
      const tradesResponse = await app.inject({
        method: "GET",
        url: "/trades"
      });

      const trades = tradesResponse.json().data;
      expect(trades).toHaveLength(1);
      expect(trades[0].exitReason).toBe("STOP_LOSS");
      expect(trades[0].realizedPnlUsdt).toBeLessThan(0);
    });

    it("handles idempotent order creation", async () => {
      const idempotencyKey = generateIdempotencyKey();
      const payload = {
        idempotencyKey,
        symbol: "BTC-USDT",
        side: "LONG",
        mode: "paper",
        entryPrice: 100000,
        stopLossPrice: 98000,
        takeProfitPrice: 104000,
        marginUsdt: 100,
        leverage: 2
      };

      // Create order twice with same idempotency key
      const first = await app.inject({
        method: "POST",
        url: "/orders/paper",
        payload
      });

      const second = await app.inject({
        method: "POST",
        url: "/orders/paper",
        payload
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      expect(first.json().data.position.id).toBe(second.json().data.position.id);

      // Verify only one position exists
      const positionsResponse = await app.inject({
        method: "GET",
        url: "/positions"
      });

      expect(positionsResponse.json().data).toHaveLength(1);
    });
  });

  describe("Data Providers Integration", () => {
    it("fetches CoinGecko market data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/market/coingecko/bitcoin"
      });

      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      expect(data).toHaveProperty("price");
      expect(data).toHaveProperty("marketCap");
      expect(data).toHaveProperty("volume24h");
    });

    it("aggregates sentiment from multiple sources", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/intelligence/sentiment"
      });

      expect(response.statusCode).toBe(200);
      const sentiment = response.json().data;
      expect(sentiment).toHaveProperty("fearGreedIndex");
      expect(sentiment).toHaveProperty("newsScore");
      expect(sentiment).toHaveProperty("socialScore");
    });

    it("fetches on-chain metrics", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/intelligence/onchain"
      });

      expect(response.statusCode).toBe(200);
      const metrics = response.json().data;
      expect(metrics).toHaveProperty("whaleTransactions");
      expect(metrics).toHaveProperty("exchangeFlows");
    });
  });

  describe("Position Closing Flow", () => {
    it("closes position and records complete trade history", async () => {
      const idempotencyKey = generateIdempotencyKey();

      // Open position
      await app.inject({
        method: "POST",
        url: "/orders/paper",
        payload: {
          idempotencyKey,
          symbol: "BTC-USDT",
          side: "LONG",
          mode: "paper",
          entryPrice: 100000,
          stopLossPrice: 98000,
          takeProfitPrice: 104000,
          marginUsdt: 100,
          leverage: 2
        }
      });

      // Trigger take profit
      const publisher = new RedisPublisher(context.redis);
      await publisher.publishTick({
        symbol: "BTC-USDT",
        price: 104000,
        change24hPct: 4.0,
        volume24h: 1000000,
        timestamp: Date.now(),
        source: "bingx"
      });

      // Wait for closure
      await waitForCondition(async () => {
        const resp = await app.inject({ method: "GET", url: "/positions" });
        return resp.json().data.length === 0;
      }, 5000);

      // Verify trade history
      const tradesResponse = await app.inject({
        method: "GET",
        url: "/trades"
      });

      const trades = tradesResponse.json().data;
      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        symbol: "BTC-USDT",
        side: "LONG",
        entryPrice: 100000,
        exitPrice: 104000,
        exitReason: "TAKE_PROFIT"
      });

      // Verify audit log
      const auditResponse = await app.inject({
        method: "GET",
        url: "/audit"
      });

      const auditEvents = auditResponse.json().data;
      expect(auditEvents.length).toBeGreaterThan(0);
      expect(auditEvents.some((e: any) => e.action === "POSITION_OPENED")).toBe(true);
      expect(auditEvents.some((e: any) => e.action === "POSITION_CLOSED")).toBe(true);
    });
  });
});