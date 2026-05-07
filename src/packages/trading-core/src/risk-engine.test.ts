import { describe, expect, it } from "vitest";
import { evaluateOrderRisk } from "./risk-engine.js";

describe("evaluateOrderRisk", () => {
  it("approves a BTC paper long when stop loss and exposure are inside limits", () => {
    const result = evaluateOrderRisk({
      accountEquity: 10_000,
      currentDailyLoss: 0,
      currentMonthlyDrawdownPct: 0,
      openPositions: 0,
      request: {
        symbol: "BTC-USDT",
        side: "LONG",
        mode: "paper",
        entryPrice: 100_000,
        stopLossPrice: 98_000,
        takeProfitPrice: 104_000,
        marginUsdt: 100,
        leverage: 2
      }
    });

    expect(result.approved).toBe(true);
    expect(result.riskAmount).toBe(4);
    expect(result.notional).toBe(200);
  });

  it("blocks live trading unless live is explicitly enabled", () => {
    const result = evaluateOrderRisk({
      accountEquity: 10_000,
      currentDailyLoss: 0,
      currentMonthlyDrawdownPct: 0,
      openPositions: 0,
      request: {
        symbol: "BTC-USDT",
        side: "LONG",
        mode: "live",
        entryPrice: 100_000,
        stopLossPrice: 99_000,
        marginUsdt: 50,
        leverage: 1
      }
    });

    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("Live trading is disabled by default");
  });

  it("blocks short trades, missing stops, high leverage, and excessive daily loss", () => {
    const result = evaluateOrderRisk({
      accountEquity: 1_000,
      currentDailyLoss: 31,
      currentMonthlyDrawdownPct: 0,
      openPositions: 0,
      liveTradingEnabled: true,
      request: {
        symbol: "ETH-USDT",
        side: "SHORT",
        mode: "paper",
        entryPrice: 3_000,
        marginUsdt: 200,
        leverage: 10
      }
    });

    expect(result.approved).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Only long trades are enabled in the MVP",
        "Stop loss is required",
        "Leverage exceeds the maximum allowed for this mode",
        "Daily loss circuit breaker is active"
      ])
    );
  });

  it("rejects a long paper trade when stop loss is not below entry", () => {
    const result = evaluateOrderRisk({
      accountEquity: 10_000,
      currentDailyLoss: 0,
      currentMonthlyDrawdownPct: 0,
      openPositions: 0,
      request: {
        symbol: "BTC-USDT",
        side: "LONG",
        mode: "paper",
        entryPrice: 100_000,
        stopLossPrice: 101_000,
        marginUsdt: 100,
        leverage: 2
      }
    });

    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("Long stop loss must be below entry price");
  });
});
