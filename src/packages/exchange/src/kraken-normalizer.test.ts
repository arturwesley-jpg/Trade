import { describe, it, expect } from "vitest";
import { normalizeKrakenTicker, KrakenTickerProvider } from "./kraken-normalizer.js";

describe("normalizeKrakenTicker", () => {
  it("should normalize valid Kraken ticker", () => {
    const payload = {
      error: [],
      result: {
        XXBTZUSD: {
          c: ["68500.5", "0.1"],
          v: ["100.5", "12345.67"],
          o: ["67000.0"]
        }
      }
    };

    const tick = normalizeKrakenTicker("BTC-USDT", "XXBTZUSD", payload);
    expect(tick).toEqual({
      symbol: "BTC-USDT",
      price: 68500.5,
      change24hPct: 2.24,
      volume24h: 12345.67,
      timestamp: expect.any(Number),
      source: "kraken"
    });
  });

  it("should return null for invalid payload", () => {
    expect(normalizeKrakenTicker("BTC-USDT", "XXBTZUSD", null)).toBeNull();
    expect(normalizeKrakenTicker("BTC-USDT", "XXBTZUSD", {})).toBeNull();
  });
});

describe("KrakenTickerProvider", () => {
  it("should fetch and normalize ticker", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        error: [],
        result: {
          XXBTZUSD: {
            c: ["68500.5", "0.1"],
            v: ["100.5", "12345.67"],
            o: ["67000.0"]
          }
        }
      })
    });

    const provider = new KrakenTickerProvider({ fetch: mockFetch });
    const tick = await provider.getTick("BTC-USDT");

    expect(tick.symbol).toBe("BTC-USDT");
    expect(tick.price).toBe(68500.5);
    expect(tick.source).toBe("kraken");
  });
});
