import { describe, expect, it } from "vitest";
import { ProviderSupervisor } from "./provider-supervisor.js";

describe("ProviderSupervisor", () => {
  it("keeps primary provider first when it is fresh and healthy", () => {
    const supervisor = new ProviderSupervisor({
      providers: ["binance", "bybit", "okx", "kraken"],
      primaryProvider: "binance",
      staleAfterMs: 1_000,
      now: () => 10_000
    });

    supervisor.recordTick("binance", { price: 100_000, latencyMs: 80, timestamp: 9_900 });
    supervisor.recordTick("bybit", { price: 100_030, latencyMs: 60, timestamp: 9_950 });

    const status = supervisor.status();

    expect(status.recommendedProvider).toBe("binance");
    expect(status.failoverOrder.slice(0, 2)).toEqual(["binance", "bybit"]);
    expect(status.providers.binance).toMatchObject({ healthy: true, stale: false });
  });

  it("fails over away from stale providers and flags weak data quality", () => {
    const supervisor = new ProviderSupervisor({
      providers: ["binance", "bybit", "okx"],
      primaryProvider: "binance",
      staleAfterMs: 1_000,
      now: () => 20_000
    });

    supervisor.recordTick("binance", { price: 100_000, latencyMs: 80, timestamp: 18_000 });
    supervisor.recordError("okx", "timeout");
    supervisor.recordTick("bybit", { price: 102_500, latencyMs: 120, timestamp: 19_900 });

    const status = supervisor.status();

    expect(status.recommendedProvider).toBe("bybit");
    expect(status.providers.binance.stale).toBe(true);
    expect(status.providers.okx.healthy).toBe(false);
    expect(status.dataQualityScore).toBeLessThan(70);
    expect(status.shouldEmitWait).toBe(true);
  });
});
