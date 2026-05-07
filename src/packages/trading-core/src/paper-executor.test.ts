import { describe, expect, it } from "vitest";
import { InMemoryTradingRepository } from "./repository.js";
import { PaperExecutor } from "./paper-executor.js";

describe("PaperExecutor", () => {
  it("creates an idempotent paper position and audit event", async () => {
    const repo = new InMemoryTradingRepository();
    const executor = new PaperExecutor(repo, {
      accountEquity: 10_000,
      currentDailyLoss: 0,
      currentMonthlyDrawdownPct: 0,
      openPositions: 0
    });

    const request = {
      idempotencyKey: "same-click",
      symbol: "BTC-USDT",
      side: "LONG" as const,
      mode: "paper" as const,
      entryPrice: 100_000,
      stopLossPrice: 98_000,
      takeProfitPrice: 104_000,
      marginUsdt: 100,
      leverage: 2
    };

    const first = await executor.open(request);
    const second = await executor.open(request);

    expect(first.position.id).toBe(second.position.id);
    expect(repo.positions()).toHaveLength(1);
    expect(repo.auditEvents().map((event) => event.type)).toEqual([
      "ORDER_INTENT_CREATED",
      "PAPER_POSITION_OPENED",
      "ORDER_INTENT_DEDUPED"
    ]);
  });

  it("closes a paper position with calculated PnL", async () => {
    const repo = new InMemoryTradingRepository();
    const executor = new PaperExecutor(repo, {
      accountEquity: 10_000,
      currentDailyLoss: 0,
      currentMonthlyDrawdownPct: 0,
      openPositions: 0
    });

    const opened = await executor.open({
      idempotencyKey: "close-test",
      symbol: "BTC-USDT",
      side: "LONG",
      mode: "paper",
      entryPrice: 100_000,
      stopLossPrice: 98_000,
      takeProfitPrice: 104_000,
      marginUsdt: 100,
      leverage: 2
    });

    const closed = await executor.close(opened.position.id, 101_000);

    expect(closed.status).toBe("CLOSED");
    // PnL is now ~1.5 USDT after fees (0.075% taker) and slippage (0.05%) on both entry and exit
    expect(closed.pnlUsdt).toBeCloseTo(1.5, 1);
    expect(repo.trades()).toHaveLength(1);
  });
});
