import { describe, it, expect, beforeEach } from "vitest";
import { ProviderSupervisor } from "./provider-supervisor.js";

describe("ProviderSupervisor - Multi-Provider Integration", () => {
  let supervisor: ProviderSupervisor;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1620000000000;
    supervisor = new ProviderSupervisor({
      providers: ["binance", "bingx", "bybit", "okx", "kraken"],
      primaryProvider: "binance",
      staleAfterMs: 5000,
      now: () => currentTime
    });
  });

  it("should initialize all providers as unhealthy and stale", () => {
    const status = supervisor.status();

    expect(status.recommendedProvider).toBeNull();
    expect(status.providers.binance.healthy).toBe(false);
    expect(status.providers.binance.stale).toBe(true);
    expect(status.providers.bingx.healthy).toBe(false);
    expect(status.providers.bybit.healthy).toBe(false);
    expect(status.providers.okx.healthy).toBe(false);
    expect(status.providers.kraken.healthy).toBe(false);
  });

  it("should recommend primary provider when healthy", () => {
    supervisor.recordTick("binance", {
      price: 50000,
      latencyMs: 50,
      timestamp: currentTime
    });

    const status = supervisor.status();
    expect(status.recommendedProvider).toBe("binance");
    expect(status.providers.binance.healthy).toBe(true);
    expect(status.providers.binance.stale).toBe(false);
  });

  it("should failover to next provider when primary fails", () => {
    // Primary provider fails
    supervisor.recordError("binance", "Connection lost");

    // Secondary provider is healthy
    supervisor.recordTick("bingx", {
      price: 50000,
      latencyMs: 60,
      timestamp: currentTime
    });

    const status = supervisor.status();
    expect(status.recommendedProvider).toBe("bingx");
    expect(status.failoverOrder).toEqual(["bingx"]);
  });

  it("should calculate consensus price from multiple providers", () => {
    supervisor.recordTick("binance", {
      price: 50000,
      latencyMs: 50,
      timestamp: currentTime
    });

    supervisor.recordTick("bingx", {
      price: 50010,
      latencyMs: 60,
      timestamp: currentTime
    });

    supervisor.recordTick("bybit", {
      price: 49990,
      latencyMs: 55,
      timestamp: currentTime
    });

    const status = supervisor.status();
    expect(status.providers.binance.price).toBe(50000);
    expect(status.providers.bingx.price).toBe(50010);
    expect(status.providers.bybit.price).toBe(49990);
  });

  it("should detect price disagreements", () => {
    supervisor.recordTick("binance", {
      price: 50000,
      latencyMs: 50,
      timestamp: currentTime
    });

    supervisor.recordTick("bingx", {
      price: 51000, // 2% difference
      latencyMs: 60,
      timestamp: currentTime
    });

    const status = supervisor.status();
    expect(status.disagreementScore).toBeGreaterThan(0);
  });

  it("should mark providers as stale after timeout", () => {
    supervisor.recordTick("binance", {
      price: 50000,
      latencyMs: 50,
      timestamp: currentTime
    });

    // Advance time beyond stale threshold
    currentTime += 6000;

    const status = supervisor.status();
    expect(status.providers.binance.stale).toBe(true);
    expect(status.shouldEmitWait).toBe(true);
  });

  it("should calculate data quality score based on healthy providers", () => {
    // All providers healthy
    supervisor.recordTick("binance", { price: 50000, latencyMs: 50, timestamp: currentTime });
    supervisor.recordTick("bingx", { price: 50010, latencyMs: 60, timestamp: currentTime });
    supervisor.recordTick("bybit", { price: 49990, latencyMs: 55, timestamp: currentTime });
    supervisor.recordTick("okx", { price: 50005, latencyMs: 65, timestamp: currentTime });
    supervisor.recordTick("kraken", { price: 49995, latencyMs: 70, timestamp: currentTime });

    const status = supervisor.status();
    expect(status.dataQualityScore).toBeGreaterThan(80);
  });

  it("should prefer lower latency providers in failover order", () => {
    supervisor.recordTick("binance", { price: 50000, latencyMs: 100, timestamp: currentTime });
    supervisor.recordTick("bingx", { price: 50010, latencyMs: 50, timestamp: currentTime });
    supervisor.recordTick("bybit", { price: 49990, latencyMs: 75, timestamp: currentTime });

    const status = supervisor.status();
    // Primary is still recommended even with higher latency
    expect(status.recommendedProvider).toBe("binance");

    // But failover order should prefer lower latency
    const failoverWithoutPrimary = status.failoverOrder.slice(1);
    expect(failoverWithoutPrimary[0]).toBe("bingx"); // Lowest latency
  });

  it("should handle mixed provider states", () => {
    supervisor.recordTick("binance", { price: 50000, latencyMs: 50, timestamp: currentTime });
    supervisor.recordError("bingx", "Connection timeout");
    supervisor.recordTick("bybit", { price: 49990, latencyMs: 55, timestamp: currentTime });
    supervisor.recordError("okx", "Rate limited");
    supervisor.recordTick("kraken", { price: 50005, latencyMs: 70, timestamp: currentTime });

    const status = supervisor.status();
    expect(status.recommendedProvider).toBe("binance");
    expect(status.providers.binance.healthy).toBe(true);
    expect(status.providers.bingx.healthy).toBe(false);
    expect(status.providers.bybit.healthy).toBe(true);
    expect(status.providers.okx.healthy).toBe(false);
    expect(status.providers.kraken.healthy).toBe(true);
  });

  it("should track latency for each provider", () => {
    supervisor.recordTick("binance", { price: 50000, latencyMs: 50, timestamp: currentTime });
    supervisor.recordTick("bingx", { price: 50010, latencyMs: 150, timestamp: currentTime });
    supervisor.recordTick("bybit", { price: 49990, latencyMs: 75, timestamp: currentTime });

    const status = supervisor.status();
    expect(status.providers.binance.latencyMs).toBe(50);
    expect(status.providers.bingx.latencyMs).toBe(150);
    expect(status.providers.bybit.latencyMs).toBe(75);
  });

  it("should handle all providers failing", () => {
    supervisor.recordError("binance", "Connection lost");
    supervisor.recordError("bingx", "Connection lost");
    supervisor.recordError("bybit", "Connection lost");
    supervisor.recordError("okx", "Connection lost");
    supervisor.recordError("kraken", "Connection lost");

    const status = supervisor.status();
    expect(status.recommendedProvider).toBeNull();
    expect(status.shouldEmitWait).toBe(true);
    expect(status.dataQualityScore).toBe(0);
  });

  it("should recover from errors when provider comes back online", () => {
    supervisor.recordError("binance", "Connection lost");

    let status = supervisor.status();
    expect(status.providers.binance.healthy).toBe(false);
    expect(status.providers.binance.lastError).toBe("Connection lost");

    // Provider recovers
    supervisor.recordTick("binance", { price: 50000, latencyMs: 50, timestamp: currentTime });

    status = supervisor.status();
    expect(status.providers.binance.healthy).toBe(true);
    expect(status.recommendedProvider).toBe("binance");
  });

  it("should handle rapid provider updates", () => {
    for (let i = 0; i < 100; i++) {
      supervisor.recordTick("binance", {
        price: 50000 + i,
        latencyMs: 50 + (i % 10),
        timestamp: currentTime + i * 100
      });
    }

    const status = supervisor.status();
    expect(status.providers.binance.price).toBe(50099);
    expect(status.providers.binance.healthy).toBe(true);
  });
});
