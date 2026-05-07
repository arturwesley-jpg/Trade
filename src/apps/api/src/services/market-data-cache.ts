import type { MarketTick } from "@trade/shared";
import { cache, cacheAside } from "@trade/shared/cache";
import { logger } from "@trade/shared/logger";

export class MarketDataCache {
  private readonly tickerTTL = 5; // 5 seconds for ticker data
  private readonly candleTTL = 60; // 1 minute for candle data
  private readonly orderBookTTL = 2; // 2 seconds for order book

  async getTicker(symbol: string, fetcher: () => Promise<MarketTick>): Promise<MarketTick> {
    return cacheAside(`ticker:${symbol}`, fetcher, this.tickerTTL);
  }

  async getMultipleTickers(
    symbols: string[],
    fetcher: (symbol: string) => Promise<MarketTick>
  ): Promise<MarketTick[]> {
    const cacheKeys = symbols.map((s) => `ticker:${s}`);
    const cached = await cache.mget<MarketTick>(cacheKeys);

    const results: MarketTick[] = [];
    const toFetch: Array<{ symbol: string; index: number }> = [];

    cached.forEach((tick: MarketTick | null, index: number) => {
      if (tick) {
        results[index] = tick;
      } else {
        toFetch.push({ symbol: symbols[index], index });
      }
    });

    if (toFetch.length > 0) {
      const fetched = await Promise.all(
        toFetch.map(async ({ symbol, index }) => {
          try {
            const tick = await fetcher(symbol);
            results[index] = tick;
            return { key: `ticker:${symbol}`, value: tick, ttl: this.tickerTTL };
          } catch (error) {
            logger.error("Failed to fetch ticker", { error: error instanceof Error ? error : String(error), symbol });
            throw error;
          }
        })
      );

      await cache.mset(fetched);
    }

    return results;
  }

  async invalidateTicker(symbol: string): Promise<void> {
    await cache.del(`ticker:${symbol}`);
  }

  async invalidateAllTickers(): Promise<void> {
    await cache.clear("ticker:*");
  }

  async getCandles(
    symbol: string,
    interval: string,
    fetcher: () => Promise<unknown>
  ): Promise<unknown> {
    return cacheAside(`candles:${symbol}:${interval}`, fetcher, this.candleTTL);
  }

  async invalidateCandles(symbol: string, interval?: string): Promise<void> {
    if (interval) {
      await cache.del(`candles:${symbol}:${interval}`);
    } else {
      await cache.clear(`candles:${symbol}:*`);
    }
  }

  async getOrderBook(
    symbol: string,
    fetcher: () => Promise<unknown>
  ): Promise<unknown> {
    return cacheAside(`orderbook:${symbol}`, fetcher, this.orderBookTTL);
  }

  async invalidateOrderBook(symbol: string): Promise<void> {
    await cache.del(`orderbook:${symbol}`);
  }
}

export const marketDataCache = new MarketDataCache();
