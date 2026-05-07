import { describe, expect, it } from "vitest";
import { evaluateSignal } from "./signal-engine.js";

describe("evaluateSignal", () => {
  it("emits watch signal when price drops more than threshold in the window", () => {
    const signal = evaluateSignal({
      symbol: "BTC-USDT",
      prices: [100000, 99700, 99200, 98000],
      thresholdPct: 2
    });

    expect(signal).toMatchObject({
      symbol: "BTC-USDT",
      direction: "WATCH_LONG",
      confidence: "medium",
      shouldExecute: false
    });
    expect(signal.rationale).toContain("2%");
  });

  it("emits neutral when movement is below threshold", () => {
    const signal = evaluateSignal({
      symbol: "ETH-USDT",
      prices: [3000, 3010, 3005],
      thresholdPct: 2
    });

    expect(signal.direction).toBe("NEUTRAL");
    expect(signal.shouldExecute).toBe(false);
  });
});
