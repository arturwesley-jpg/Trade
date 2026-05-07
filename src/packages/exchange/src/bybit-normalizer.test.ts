import { describe, it, expect } from "vitest";
import { normalizeBybitMessage, buildBybitSubscription } from "./bybit-normalizer.js";

describe("buildBybitSubscription", () => {
  it("should build subscription for single symbol", () => {
    const subscription = buildBybitSubscription(["BTC-USDT"]);
    expect(subscription.op).toBe("subscribe");
    expect(subscription.args).toEqual(["tickers.BTCUSDT"]);
  });

  it("should build subscription for multiple symbols", () => {
    const subscription = buildBybitSubscription(["BTC-USDT", "ETH-USDT"]);
    expect(subscription.op).toBe("subscribe");
    expect(subscription.args).toEqual(["tickers.BTCUSDT", "tickers.ETHUSDT"]);
  });
});

describe("normalizeBybitMessage", () => {
  it("should normalize valid ticker message", () => {
    const message = {
      topic: "tickers.BTCUSDT",
      data: {
        lastPrice: "50000.50",
        price24hPcnt: "0.025",
        volume24h: "1234.56",
        ts: 1620000000000
      }
    };

    const tick = normalizeBybitMessage(message);
    expect(tick).toEqual({
      symbol: "BTC-USDT",
      price: 50000.50,
      change24hPct: 2.5,
      volume24h: 1234.56,
      timestamp: 1620000000000,
      source: "bybit"
    });
  });

  it("should handle numeric values", () => {
    const message = {
      topic: "tickers.ETHUSDT",
      data: {
        lastPrice: 3000.25,
        price24hPcnt: -0.015,
        volume24h: 5678.90,
        ts: 1620000000000
      }
    };

    const tick = normalizeBybitMessage(message);
    expect(tick?.price).toBe(3000.25);
    expect(tick?.change24hPct).toBe(-1.5);
  });

  it("should handle missing optional fields", () => {
    const message = {
      topic: "tickers.BTCUSDT",
      data: {
        lastPrice: "50000.50",
        ts: 1620000000000
      }
    };

    const tick = normalizeBybitMessage(message);
    expect(tick).toEqual({
      symbol: "BTC-USDT",
      price: 50000.50,
      change24hPct: undefined,
      volume24h: undefined,
      timestamp: 1620000000000,
      source: "bybit"
    });
  });

  it("should use current time if timestamp missing", () => {
    const before = Date.now();
    const message = {
      topic: "tickers.BTCUSDT",
      data: {
        lastPrice: "50000.50"
      }
    };

    const tick = normalizeBybitMessage(message);
    const after = Date.now();

    expect(tick?.timestamp).toBeGreaterThanOrEqual(before);
    expect(tick?.timestamp).toBeLessThanOrEqual(after);
  });

  it("should return null for subscription confirmation", () => {
    const message = {
      op: "subscribe",
      success: true
    };

    const tick = normalizeBybitMessage(message);
    expect(tick).toBeNull();
  });

  it("should return null for invalid message", () => {
    expect(normalizeBybitMessage(null)).toBeNull();
    expect(normalizeBybitMessage(undefined)).toBeNull();
    expect(normalizeBybitMessage("invalid")).toBeNull();
    expect(normalizeBybitMessage({})).toBeNull();
  });

  it("should return null when price is missing", () => {
    const message = {
      topic: "tickers.BTCUSDT",
      data: {
        ts: 1620000000000
      }
    };

    const tick = normalizeBybitMessage(message);
    expect(tick).toBeNull();
  });

  it("should handle malformed topic", () => {
    const message = {
      topic: "invalid-topic",
      data: {
        lastPrice: "50000.50"
      }
    };

    const tick = normalizeBybitMessage(message);
    expect(tick).toBeNull();
  });
});
