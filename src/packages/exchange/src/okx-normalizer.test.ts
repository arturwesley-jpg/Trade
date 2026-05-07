import { describe, it, expect } from "vitest";
import { normalizeOKXTicker, OKXTickerProvider } from "./okx-normalizer.js";

describe("normalizeOKXTicker", () => {
  it("should normalize valid OKX ticker", () => {
    const payload = {
      code: "0",
      msg: "",
      data: [
        {
          instId: "BTC-USDT",
          last: "68500.5",
          open24h: "67000.0",
          vol24h: "12345.67",
          ts: "1714761600000"
        }
      ]
    };

    const tick = normalizeOKXTicker("BTC-USDT", payload);
    expect(tick).toEqual({
      symbol: "BTC-USDT",
      price: 68500.5,
      change24hPct: 2.24,
      volume24h: 12345.67,
      timestamp: 1714761600000,
      source: "okx"
    });
  });

  it("should return null for invalid payload", () => {
    expect(normalizeOKXTicker("BTC-USDT", null)).toBeNull();
    expect(normalizeOKXTicker("BTC-USDT", {})).toBeNull();
    expect(normalizeOKXTicker("BTC-USDT", { data: [] })).toBeNull();
  });
});

describe("OKXTickerProvider", () => {
  it("should fetch and normalize ticker", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: "0",
        data: [
          {
            last: "68500.5",
            open24h: "67000.0",
            vol24h: "12345.67",
            ts: "1714761600000"
          }
        ]
      })
    });

    const provider = new OKXTickerProvider({ fetch: mockFetch });
    const tick = await provider.getTick("BTC-USDT");

    expect(tick.symbol).toBe("BTC-USDT");
    expect(tick.price).toBe(68500.5);
    expect(tick.source).toBe("okx");
  });
});
