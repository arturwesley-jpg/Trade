import { describe, expect, it } from "vitest";
import { buildBingXSubscription, normalizeBingXMessage } from "./bingx-normalizer.js";

describe("BingX normalizer", () => {
  it("builds public market subscriptions with request type", () => {
    expect(buildBingXSubscription("BTC-USDT", "ticker")).toEqual({
      id: "BTC-USDT:ticker",
      reqType: "sub",
      dataType: "BTC-USDT@ticker"
    });
  });

  it("normalizes ticker-like payloads into market ticks", () => {
    const tick = normalizeBingXMessage({
      dataType: "BTC-USDT@ticker",
      data: {
        c: "100000.5",
        P: "2.3",
        v: "1234",
        E: 1710000000000
      }
    });

    expect(tick).toEqual({
      symbol: "BTC-USDT",
      price: 100000.5,
      change24hPct: 2.3,
      volume24h: 1234,
      timestamp: 1710000000000,
      source: "bingx"
    });
  });

  it("returns null for heartbeat and subscription ack messages", () => {
    expect(normalizeBingXMessage({ ping: 1710000000000 })).toBeNull();
    expect(normalizeBingXMessage({ id: "BTC-USDT:ticker", code: 0, msg: "" })).toBeNull();
  });
});
