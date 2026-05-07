import { execSync } from "child_process";
import Redis from "ioredis";
import pg from "pg";
import WebSocket from "ws";

const { Pool } = pg;

export interface TestContext {
  redis: Redis;
  postgres: pg.Pool;
  cleanup: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const redis = new Redis(process.env.REDIS_URL!);
  const postgres = new Pool({ connectionString: process.env.DATABASE_URL! });

  // Clear test data
  await redis.flushdb();
  await postgres.query("DROP SCHEMA IF EXISTS public CASCADE");
  await postgres.query("CREATE SCHEMA public");

  const cleanup = async () => {
    await redis.flushdb();
    await redis.quit();
    await postgres.query("DROP SCHEMA IF EXISTS public CASCADE");
    await postgres.query("CREATE SCHEMA public");
    await postgres.end();
  };

  return { redis, postgres, cleanup };
}

export async function waitForRedisMessage(
  redis: Redis,
  channel: string,
  timeoutMs = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const subscriber = redis.duplicate();
    const timeout = setTimeout(() => {
      subscriber.quit();
      reject(new Error(`Timeout waiting for message on channel ${channel}`));
    }, timeoutMs);

    subscriber.subscribe(channel, (err) => {
      if (err) {
        clearTimeout(timeout);
        subscriber.quit();
        reject(err);
      }
    });

    subscriber.on("message", (ch, message) => {
      if (ch === channel) {
        clearTimeout(timeout);
        subscriber.quit();
        resolve(JSON.parse(message));
      }
    });
  });
}

export async function waitForWebSocketMessage(
  url: string,
  subscribeMessage: any,
  timeoutMs = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Timeout waiting for WebSocket message"));
    }, timeoutMs);

    ws.on("open", () => {
      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      // Skip subscription confirmation messages
      if (message.id !== "subscribe") {
        clearTimeout(timeout);
        ws.close();
        resolve(message);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      ws.close();
      reject(error);
    });
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await sleep(intervalMs);
  }

  throw new Error("Condition not met within timeout");
}

export function generateIdempotencyKey(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
