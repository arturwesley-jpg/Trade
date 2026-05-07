import { describe, expect, it, vi } from "vitest";
import type { MarketTick } from "@trade/shared";
import { buildPollingProviders, resolveProviderNames, startWorker } from "./worker.js";

describe("resolveProviderNames", () => {
  it("uses simulated by default when simulated feed is enabled", () => {
    const result = resolveProviderNames(undefined, true);
    expect(result).toEqual(["simulated"]);
  });

  it("uses real providers by default when simulated feed is disabled", () => {
    const result = resolveProviderNames(undefined, false);
    expect(result).toEqual(["binance", "bybit", "okx", "kraken"]);
  });
});

describe("buildPollingProviders", () => {
  it("falls back to simulated when provider list is invalid", () => {
    const providers = buildPollingProviders(["invalid"], ["BTC-USDT"]);
    expect(providers).toHaveLength(1);
    expect(providers[0]?.name).toBe("simulated");
  });
});

describe("startWorker", () => {
  it("does not throw when Redis connection fails", async () => {
    const fakePublisher = {
      connect: vi.fn(async () => {
        throw new Error("redis down");
      }),
      disconnect: vi.fn(async () => {}),
      isConnected: vi.fn(() => false),
      publish: vi.fn(async () => {})
    };

    const setIntervalMock = vi.fn(() => 1 as unknown as NodeJS.Timeout);
    const onSignalMock = vi.fn();
    const poll = vi.fn(async () => ({ ticks: [] as MarketTick[], errors: [], status: {} }));

    await expect(startWorker({
      symbols: ["BTC-USDT"],
      providerNames: ["simulated"],
      pollIntervalMs: 1000,
      redisPublisher: fakePublisher,
      onSignal: onSignalMock,
      setIntervalFn: setIntervalMock,
      createPollingSupervisor: () => ({ poll })
    })).resolves.toBeUndefined();

    expect(setIntervalMock).toHaveBeenCalledTimes(1);
  });

  it("publishes ticks to market:ticks.raw when Redis is connected", async () => {
    const fakePublisher = {
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      isConnected: vi.fn(() => true),
      publish: vi.fn(async () => {})
    };

    const tick: MarketTick = {
      symbol: "BTC-USDT",
      price: 100000,
      timestamp: Date.now(),
      source: "simulated"
    };

    let intervalCallback: (() => void) | undefined;
    const setIntervalMock = vi.fn((callback: () => void) => {
      intervalCallback = callback;
      return 1;
    });
    const poll = vi.fn(async () => ({ ticks: [tick], errors: [], status: {} }));

    await startWorker({
      symbols: ["BTC-USDT"],
      providerNames: ["simulated"],
      pollIntervalMs: 1000,
      redisPublisher: fakePublisher,
      onSignal: vi.fn(),
      setIntervalFn: setIntervalMock,
      createPollingSupervisor: () => ({ poll })
    });

    expect(intervalCallback).toBeTypeOf("function");
    intervalCallback?.();
    await Promise.resolve();

    expect(fakePublisher.publish).toHaveBeenCalledWith("market:ticks.raw", tick);
  });

  it("publishes legacy market alias when enabled", async () => {
    const fakePublisher = {
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      isConnected: vi.fn(() => true),
      publish: vi.fn(async () => {})
    };
    const tick: MarketTick = {
      symbol: "ETH-USDT",
      price: 3000,
      timestamp: Date.now(),
      source: "simulated"
    };

    let intervalCallback: (() => void) | undefined;
    const setIntervalMock = vi.fn((callback: () => void) => {
      intervalCallback = callback;
      return 1;
    });
    const poll = vi.fn(async () => ({ ticks: [tick], errors: [], status: {} }));

    await startWorker({
      symbols: ["ETH-USDT"],
      providerNames: ["simulated"],
      pollIntervalMs: 1000,
      publishLegacyMarketAlias: true,
      redisPublisher: fakePublisher,
      onSignal: vi.fn(),
      setIntervalFn: setIntervalMock,
      createPollingSupervisor: () => ({ poll })
    });

    intervalCallback?.();
    await Promise.resolve();

    expect(fakePublisher.publish).toHaveBeenCalledWith("market:ticks.raw", tick);
    expect(fakePublisher.publish).toHaveBeenCalledWith("market:ticks", tick);
  });

  it("handles poll errors without throwing", async () => {
    const fakePublisher = {
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      isConnected: vi.fn(() => false),
      publish: vi.fn(async () => {})
    };
    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let intervalCallback: (() => void) | undefined;
    const setIntervalMock = vi.fn((callback: () => void) => {
      intervalCallback = callback;
      return 1;
    });
    const poll = vi.fn(async () => {
      throw new Error("poll failed");
    });

    await startWorker({
      symbols: ["BTC-USDT"],
      providerNames: ["simulated"],
      pollIntervalMs: 1000,
      redisPublisher: fakePublisher,
      onSignal: vi.fn(),
      setIntervalFn: setIntervalMock,
      createPollingSupervisor: () => ({ poll })
    });

    expect(intervalCallback).toBeTypeOf("function");
    intervalCallback?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
