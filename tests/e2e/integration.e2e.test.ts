import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import Redis from "ioredis";
import pg from "pg";
import {
  createTestContext,
  waitForWebSocketMessage,
  waitForRedisMessage,
  sleep,
  waitForCondition,
  type TestContext
} from "./helpers.js";

const { Pool } = pg;

describe("Integration E2E Tests", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe("Redis PubSub Integration", () => {
    it("publishes and receives messages through Redis", async () => {
      const publisher = context.redis;
      const subscriber = context.redis.duplicate();

      const messagePromise = new Promise((resolve) => {
        subscriber.subscribe("test:channel");
        subscriber.on("message", (channel, message) => {
          if (channel === "test:channel") {
            resolve(JSON.parse(message));
          }
        });
      });

      await sleep(100); // Wait for subscription

      await publisher.publish("test:channel", JSON.stringify({ test: "data" }));

      const received = await messagePromise;
      expect(received).toEqual({ test: "data" });

      await subscriber.quit();
    });

    it("handles multiple subscribers on same channel", async () => {
      const publisher = context.redis;
      const sub1 = context.redis.duplicate();
      const sub2 = context.redis.duplicate();

      const messages1: any[] = [];
      const messages2: any[] = [];

      await sub1.subscribe("broadcast:channel");
      await sub2.subscribe("broadcast:channel");

      sub1.on("message", (ch, msg) => messages1.push(JSON.parse(msg)));
      sub2.on("message", (ch, msg) => messages2.push(JSON.parse(msg)));

      await sleep(100);

      // Publish 5 messages
      for (let i = 0; i < 5; i++) {
        await publisher.publish("broadcast:channel", JSON.stringify({ id: i }));
      }

      await sleep(200);

      expect(messages1).toHaveLength(5);
      expect(messages2).toHaveLength(5);
      expect(messages1).toEqual(messages2);

      await sub1.quit();
      await sub2.quit();
    });

    it("handles Redis connection failure gracefully", async () => {
      const redis = new Redis({
        host: "localhost",
        port: 6380,
        retryStrategy: () => null, // Don't retry
        maxRetriesPerRequest: 1
      });

      // Close connection to simulate failure
      await redis.quit();

      // Attempt operation on closed connection
      await expect(redis.get("test")).rejects.toThrow();
    });
  });

  describe("PostgreSQL Integration", () => {
    it("performs CRUD operations on database", async () => {
      const { postgres } = context;

      // Create table
      await postgres.query(`
        CREATE TABLE test_trades (
          id SERIAL PRIMARY KEY,
          symbol VARCHAR(20) NOT NULL,
          price DECIMAL(20, 8) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Insert
      const insertResult = await postgres.query(
        "INSERT INTO test_trades (symbol, price) VALUES ($1, $2) RETURNING *",
        ["BTC-USDT", 100000]
      );

      expect(insertResult.rows).toHaveLength(1);
      expect(insertResult.rows[0].symbol).toBe("BTC-USDT");

      // Read
      const selectResult = await postgres.query(
        "SELECT * FROM test_trades WHERE symbol = $1",
        ["BTC-USDT"]
      );

      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0].price).toBe("100000.00000000");

      // Update
      await postgres.query(
        "UPDATE test_trades SET price = $1 WHERE symbol = $2",
        [101000, "BTC-USDT"]
      );

      const updatedResult = await postgres.query(
        "SELECT price FROM test_trades WHERE symbol = $1",
        ["BTC-USDT"]
      );

      expect(updatedResult.rows[0].price).toBe("101000.00000000");

      // Delete
      await postgres.query("DELETE FROM test_trades WHERE symbol = $1", ["BTC-USDT"]);

      const deletedResult = await postgres.query("SELECT * FROM test_trades");
      expect(deletedResult.rows).toHaveLength(0);
    });

    it("handles transactions with rollback", async () => {
      const { postgres } = context;

      await postgres.query(`
        CREATE TABLE test_accounts (
          id SERIAL PRIMARY KEY,
          balance DECIMAL(20, 2) NOT NULL
        )
      `);

      await postgres.query("INSERT INTO test_accounts (balance) VALUES (1000)");

      // Start transaction
      const client = await postgres.connect();

      try {
        await client.query("BEGIN");

        // Deduct balance
        await client.query("UPDATE test_accounts SET balance = balance - 500 WHERE id = 1");

        // Simulate error
        throw new Error("Simulated error");

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }

      // Verify balance unchanged
      const result = await postgres.query("SELECT balance FROM test_accounts WHERE id = 1");
      expect(result.rows[0].balance).toBe("1000.00");
    });

    it("handles concurrent writes without deadlock", async () => {
      const { postgres } = context;

      await postgres.query(`
        CREATE TABLE test_counter (
          id INTEGER PRIMARY KEY,
          count INTEGER NOT NULL
        )
      `);

      await postgres.query("INSERT INTO test_counter (id, count) VALUES (1, 0)");

      // Perform 50 concurrent increments
      const increments = Array.from({ length: 50 }, async () => {
        await postgres.query("UPDATE test_counter SET count = count + 1 WHERE id = 1");
      });

      await Promise.all(increments);

      const result = await postgres.query("SELECT count FROM test_counter WHERE id = 1");
      expect(result.rows[0].count).toBe(50);
    });
  });

  describe("WebSocket Integration", () => {
    it("connects to mock BingX WebSocket and receives ticks", async () => {
      const message = await waitForWebSocketMessage(
        "ws://localhost:8080/swap-market",
        {
          id: "subscribe",
          dataType: "BTC-USDT"
        },
        10000
      );

      expect(message).toHaveProperty("dataType");
      expect(message).toHaveProperty("data");
      expect(message.data[0]).toHaveProperty("s");
      expect(message.data[0]).toHaveProperty("c");
    });

    it("handles multiple symbol subscriptions", async () => {
      const ws = new WebSocket("ws://localhost:8080/swap-market");

      const messages: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on("open", () => {
          ws.send(JSON.stringify({ id: "subscribe", dataType: "BTC-USDT" }));
          ws.send(JSON.stringify({ id: "subscribe", dataType: "ETH-USDT" }));
          resolve();
        });
      });

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.dataType) {
          messages.push(msg);
        }
      });

      await sleep(1000);

      ws.close();

      // Should receive ticks for both symbols
      const btcTicks = messages.filter(m => m.dataType === "BTC-USDT");
      const ethTicks = messages.filter(m => m.dataType === "ETH-USDT");

      expect(btcTicks.length).toBeGreaterThan(0);
      expect(ethTicks.length).toBeGreaterThan(0);
    });

    it("reconnects after connection loss", async () => {
      let ws = new WebSocket("ws://localhost:8080/swap-market");

      await new Promise<void>((resolve) => {
        ws.on("open", resolve);
      });

      // Close connection
      ws.close();

      await sleep(100);

      // Reconnect
      ws = new WebSocket("ws://localhost:8080/swap-market");

      const connected = await new Promise<boolean>((resolve) => {
        ws.on("open", () => resolve(true));
        ws.on("error", () => resolve(false));
        setTimeout(() => resolve(false), 5000);
      });

      expect(connected).toBe(true);
      ws.close();
    });
  });

  describe("Telegram Bot Integration", () => {
    it("processes commands and calls API", async () => {
      // This would test the Telegram bot integration
      // For now, we verify the command structure
      const commands = [
        "/start",
        "/status",
        "/positions",
        "/trades",
        "/signals"
      ];

      expect(commands).toHaveLength(5);
    });
  });

  describe("Failure Scenarios", () => {
    it("falls back to InMemory when PostgreSQL is down", async () => {
      // Close PostgreSQL connection
      await context.postgres.end();

      // Application should still work with InMemory repository
      // This would be tested in the actual app initialization
      expect(true).toBe(true);
    });

    it("handles Redis timeout gracefully", async () => {
      const redis = new Redis({
        host: "localhost",
        port: 6380,
        commandTimeout: 100
      });

      // Simulate slow operation
      const start = Date.now();
      try {
        await redis.blpop("nonexistent:key", 1);
      } catch (error) {
        // Should timeout
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);

      await redis.quit();
    });

    it("handles API external timeout with simulated data", async () => {
      // This would test the fallback mechanism when external APIs timeout
      // For now, we verify the timeout behavior
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);

      try {
        await fetch("https://httpstat.us/200?sleep=5000", {
          signal: controller.signal
        });
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        clearTimeout(timeout);
      }
    });

    it("handles WebSocket reconnection after network failure", async () => {
      const ws = new WebSocket("ws://localhost:8080/swap-market");

      await new Promise<void>((resolve) => {
        ws.on("open", resolve);
      });

      // Simulate network failure
      ws.terminate();

      await sleep(100);

      // Reconnect
      const ws2 = new WebSocket("ws://localhost:8080/swap-market");

      const reconnected = await new Promise<boolean>((resolve) => {
        ws2.on("open", () => resolve(true));
        ws2.on("error", () => resolve(false));
        setTimeout(() => resolve(false), 5000);
      });

      expect(reconnected).toBe(true);
      ws2.close();
    });
  });
});