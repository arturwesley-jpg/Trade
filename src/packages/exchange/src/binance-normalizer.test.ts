import { describe, it, expect } from "vitest";
import { normalizeBinanceMessage, buildBinanceSubscription } from "./binance-normalizer.js";

describe("buildBinanceSubscription", () => {
  it("should build subscription for single symbol", () => {
    const subscription = buildBinanceSubscription(["BTC-USDT"]);
    expect(subscription.method).toBe("SUBSCRIBE");
    expect(subscription.params).toEqual(["btcusdt@ticker"]);
    expect(subscription.id).toBeGreaterThan(0);
  });

  it("should build subscription for multiple symbols", () => {
    const subscription = buildBinanceSubscription(["BTC-USDT", "ETH-USDT"]);
    expect(subscription.method).toBe("SUBSCRIBE");
    expect(subscription.params).toEqual(["btcusdt@ticker", "ethusdt@ticker"]);
  });
});

describe("normalizeBinanceMessage", () => {
  it("should normalize valid ticker message", () => {
    const message = {
      data: {
        s: "BTCUSDT",
        c: "50000.50",
        P: "2.5",
        v: "1234.56",
        E: 1620000000000
      }
    };

    const tick = normalizeBinanceMessage(message);
    expect(tick).toEqual({
      symbol: "BTC-USDT",
      price: 50000.50,
      change24hPct: 2.5,
      volume24h: 1234.56,
      timestamp: 1620000000000,
      source: "binance"
    });
  });

  it("should handle numeric values", () => {
    const message = {
      data: {
        s: "ETHUSDT",
        c: 3000.25,
        P: -1.5,
        v: 5678.90,
        E: 1620000000000
      }
    };

    const tick = normalizeBinanceMessage(message);
    expect(tick?.price).toBe(3000.25);
    expect(tick?.change24hPct).toBe(-1.5);
  });

  it("should handle missing optional fields", () => {
    const message = {
      data: {
        s: "BTCUSDT",
        c: "50000.50",
        E: 1620000000000
      }
    };

    const tick = normalizeBinanceMessage(message);
    expect(tick).toEqual({
      symbol: "BTC-USDT",
      price: 50000.50,
      change24hPct: undefined,
      volume24h: undefined,
      timestamp: 1620000000000,
      source: "binance"
    });
  });

  it("should use current time if timestamp missing", () => {
    const before = Date.now();
    const message = {
      data: {
        s: "BTCUSDT",
        c: "50000.50"
      }
    };

    const tick = normalizeBinanceMessage(message);
    const after = Date.now();

    expect(tick?.timestamp).toBeGreaterThanOrEqual(before);
    expect(tick?.timestamp).toBeLessThanOrEqual(after);
  });

  it("should return null for subscription confirmation", () => {
    const message = {
      result: null,
      id: 1
    };

    const tick = normalizeBinanceMessage(message);
    expect(tick).toBeNull();
  });

  it("should return null for invalid message", () => {
    expect(normalizeBinanceMessage(null)).toBeNull();
    expect(normalizeBinanceMessage(undefined)).toBeNull();
    expect(normalizeBinanceMessage("invalid")).toBeNull();
    expect(normalizeBinanceMessage({})).toBeNull();
  });

  it("should return null when price is missing", () => {
    const message = {
      data: {
        s: "BTCUSDT",
        E: 1620000000000
      }
    };

    const tick = normalizeBinanceMessage(message);
    expect(tick).toBeNull();
  });

  it("should handle different quote currencies", () => {
    const message = {
      data: {
        s: "BTCBUSD",
        c: "50000.50",
        E: 1620000000000
      }
    };

    const tick = normalizeBinanceMessage(message);
    expect(tick?.symbol).toBe("BTC-BUSD");
  });
});
