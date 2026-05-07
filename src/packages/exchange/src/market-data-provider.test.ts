import { describe, expect, it } from "vitest";
import {
  BinanceTickerProvider,
  BybitTickerProvider,
  PollingMarketDataSupervisor,
  SimulatedMarketDataProvider
} from "./market-data-provider.js";

describe("market data providers", () => {
  it("polls healthy providers and returns ticks with provider quality", async () => {
    let now = 1_000;
    const provider = new SimulatedMarketDataProvider({
      name: "simulated",
      now: () => now,
      prices: { "BTC-USDT": 100_000, "ETH-USDT": 3_000 }
    });
    const supervisor = new PollingMarketDataSupervisor({
      providers: [provider],
      primaryProvider: "simulated",
      staleAfterMs: 1_000,
      now: () => now
    });

    now = 1_050;
    const result = await supervisor.poll(["BTC-USDT", "ETH-USDT"]);

    expect(result.ticks).toHaveLength(2);
    expect(result.ticks[0]).toMatchObject({ symbol: "BTC-USDT", source: "simulated" });
    expect(result.status.recommendedProvider).toBe("simulated");
    expect(result.status.providers.simulated.healthy).toBe(true);
  });

  it("records provider failures without dropping successful ticks", async () => {
    const supervisor = new PollingMarketDataSupervisor({
      providers: [
        new SimulatedMarketDataProvider({
          name: "simulated",
          now: () => 10_000,
          prices: { "BTC-USDT": 100_000 }
        }),
        {
          name: "broken",
          async getTick() {
            throw new Error("provider timeout");
          }
        }
      ],
      primaryProvider: "simulated",
      staleAfterMs: 1_000,
      now: () => 10_000
    });

    const result = await supervisor.poll(["BTC-USDT"]);

    expect(result.ticks).toHaveLength(1);
    expect(result.errors).toEqual([{ provider: "broken", message: "provider timeout" }]);
    expect(result.status.providers.broken).toMatchObject({ healthy: false, lastError: "provider timeout" });
  });

  it("normalizes Binance 24hr ticker responses into market ticks", async () => {
    const urls: string[] = [];
    const provider = new BinanceTickerProvider({
      baseUrl: "https://api.binance.test",
      fetch: async (url) => {
        urls.push(url);
        return {
          ok: true,
          async json() {
            return {
              symbol: "BTCUSDT",
              lastPrice: "101234.56",
              priceChangePercent: "1.25",
              volume: "456.78",
              closeTime: 1_234_567
            };
          }
        };
      }
    });

    await expect(provider.getTick("BTC-USDT")).resolves.toEqual({
      symbol: "BTC-USDT",
      price: 101_234.56,
      change24hPct: 1.25,
      volume24h: 456.78,
      timestamp: 1_234_567,
      source: "binance"
    });
    expect(urls[0]).toBe("https://api.binance.test/api/v3/ticker/24hr?symbol=BTCUSDT");
  });

  it("raises a clear error when Binance returns an invalid payload", async () => {
    const provider = new BinanceTickerProvider({
      fetch: async () => ({
        ok: true,
        async json() {
          return { symbol: "BTCUSDT", lastPrice: "not-a-number" };
        }
      })
    });

    await expect(provider.getTick("BTC-USDT")).rejects.toThrow("Invalid Binance ticker payload for BTC-USDT");
  });

  it("normalizes Bybit spot ticker responses into market ticks", async () => {
    const urls: string[] = [];
    const provider = new BybitTickerProvider({
      baseUrl: "https://api.bybit.test",
      fetch: async (url) => {
        urls.push(url);
        return {
          ok: true,
          async json() {
            return {
              retCode: 0,
              retMsg: "OK",
              result: {
                category: "spot",
                list: [
                  {
                    symbol: "BTCUSDT",
                    lastPrice: "102345.67",
                    price24hPcnt: "0.0125",
                    volume24h: "321.45"
                  }
                ]
              },
              time: 2_345_678
            };
          }
        };
      }
    });

    await expect(provider.getTick("BTC-USDT")).resolves.toEqual({
      symbol: "BTC-USDT",
      price: 102_345.67,
      change24hPct: 1.25,
      volume24h: 321.45,
      timestamp: 2_345_678,
      source: "bybit"
    });
    expect(urls[0]).toBe("https://api.bybit.test/v5/market/tickers?category=spot&symbol=BTCUSDT");
  });

  it("raises a clear error when Bybit returns a non-zero retCode", async () => {
    const provider = new BybitTickerProvider({
      fetch: async () => ({
        ok: true,
        async json() {
          return { retCode: 10001, retMsg: "symbol invalid", result: { list: [] }, time: 1 };
        }
      })
    });

    await expect(provider.getTick("BTC-USDT")).rejects.toThrow("Bybit ticker request failed for BTC-USDT: symbol invalid");
  });
});
