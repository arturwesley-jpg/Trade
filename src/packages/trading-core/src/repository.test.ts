import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryTradingRepository, JsonFileTradingRepository } from "./repository.js";

describe("trading repositories", () => {
  it("returns immutable snapshots from the in-memory repository", () => {
    const repo = new InMemoryTradingRepository();
    repo.appendAudit("ORDER_INTENT_CREATED", "corr-1", { safe: true });

    const snapshot = repo.snapshot();
    snapshot.auditEvents.length = 0;

    expect(repo.auditEvents()).toHaveLength(1);
    expect(repo.snapshot().auditEvents).toHaveLength(1);
  });

  it("persists paper trading records across JSON repository instances", () => {
    const dir = mkdtempSync(join(tmpdir(), "trade-repo-"));
    const filePath = join(dir, "store.json");

    try {
      const first = new JsonFileTradingRepository(filePath);
      first.saveIntent({
        id: "intent_1",
        idempotencyKey: "same-request",
        createdAt: "2026-05-02T00:00:00.000Z",
        status: "CREATED",
        symbol: "BTC-USDT",
        side: "LONG",
        mode: "paper",
        entryPrice: 100_000,
        stopLossPrice: 98_000,
        marginUsdt: 100,
        leverage: 2
      });
      first.appendAudit("PAPER_POSITION_OPENED", "intent_1", { positionId: "pos_1" });

      const second = new JsonFileTradingRepository(filePath);

      expect(second.findIntentByIdempotencyKey("same-request")?.id).toBe("intent_1");
      expect(second.auditEvents()).toHaveLength(1);
      expect(second.snapshot()).toMatchObject({
        orderIntents: [{ id: "intent_1" }],
        auditEvents: [{ correlationId: "intent_1" }]
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists recent market ticks across JSON repository instances", () => {
    const dir = mkdtempSync(join(tmpdir(), "trade-repo-"));
    const filePath = join(dir, "store.json");

    try {
      const first = new JsonFileTradingRepository(filePath, { maxMarketTicks: 2 });
      first.saveMarketTick({
        symbol: "BTC-USDT",
        price: 100_000,
        timestamp: 1,
        source: "simulated"
      });
      first.saveMarketTick({
        symbol: "ETH-USDT",
        price: 3_000,
        timestamp: 2,
        source: "simulated"
      });
      first.saveMarketTick({
        symbol: "BTC-USDT",
        price: 100_100,
        timestamp: 3,
        source: "simulated"
      });

      const second = new JsonFileTradingRepository(filePath, { maxMarketTicks: 2 });

      expect(second.marketTicks()).toEqual([
        { symbol: "ETH-USDT", price: 3_000, timestamp: 2, source: "simulated" },
        { symbol: "BTC-USDT", price: 100_100, timestamp: 3, source: "simulated" }
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
