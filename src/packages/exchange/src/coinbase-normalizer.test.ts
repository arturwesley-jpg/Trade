import { describe, expect, it } from "vitest";
import { buildCoinbaseSubscription, normalizeCoinbaseMessage } from "./coinbase-normalizer.js";

describe("coinbase-normalizer", () => {
  it("builds a ticker subscription payload", () => {
    expect(buildCoinbaseSubscription(["BTC-USDT", "ETH-USDT"])).toEqual({
      type: "subscribe",
      product_ids: ["BTC-USDT", "ETH-USDT"],
      channel: "ticker"
    });
  });

  it("normalizes ticker events into MarketTick", () => {
    expect(normalizeCoinbaseMessage({
      channel: "ticker",
      events: [
        {
          type: "snapshot",
          tickers: [
            {
              product_id: "BTC-USDT",
              price: "102345.12",
              best_bid: "102345.01",
              best_ask: "102345.55",
              volume_24_h: "1234.56"
            }
          ]
        }
      ]
    })).toEqual(expect.objectContaining({
      symbol: "BTC-USDT",
      price: 102345.12,
      bid: 102345.01,
      ask: 102345.55,
      volume24h: 1234.56,
      source: "coinbase"
    }));
  });
});
