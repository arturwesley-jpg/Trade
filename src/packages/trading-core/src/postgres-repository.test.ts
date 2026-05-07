import { describe, expect, it } from "vitest";
import { PostgresTradingRepository } from "./postgres-repository.js";

describe("PostgresTradingRepository", () => {
  it("loads an initial snapshot and persists new market ticks", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const client = {
      async query(sql: string, params: unknown[] = []) {
        queries.push({ sql, params });
        if (sql.includes("FROM order_intents")) return { rows: [] };
        if (sql.includes("FROM positions")) return { rows: [] };
        if (sql.includes("FROM trades")) return { rows: [] };
        if (sql.includes("FROM audit_events")) return { rows: [] };
        if (sql.includes("FROM market_ticks")) return { rows: [] };
        return { rows: [] };
      }
    };

    const repo = await PostgresTradingRepository.create(client);
    repo.saveMarketTick({
      symbol: "BTC-USDT",
      price: 100_000,
      change24hPct: 1.2,
      volume24h: 123,
      timestamp: 123_456,
      source: "binance"
    });
    await repo.flush();

    expect(repo.marketTicks()).toHaveLength(1);
    expect(queries.some((query) => query.sql.includes("INSERT INTO market_ticks"))).toBe(true);
  });
});
