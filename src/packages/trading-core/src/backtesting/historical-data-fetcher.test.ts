import { describe, it, expect, beforeEach, vi } from "vitest";
import { HistoricalDataFetcher } from "./historical-data-fetcher.js";
import { promises as fs } from "fs";
import { join } from "path";
import type { Candle } from "../intelligence-engines.js";

describe("HistoricalDataFetcher", () => {
  const testCacheDir = ".cache/test-historical-data";
  let fetcher: HistoricalDataFetcher;

  beforeEach(async () => {
    // Clean up test cache
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }

    fetcher = new HistoricalDataFetcher({
      cacheDir: testCacheDir,
      useCache: true
    });
  });

  describe("cache management", () => {
    it("should save and load from cache", async () => {
      const mockCandles: Candle[] = [
        {
          timestamp: 1704067200000,
          open: 40000,
          high: 40500,
          low: 39500,
          close: 40200,
          volume: 1000000
        }
      ];

      // Manually save to cache
      const cacheKey = "BTC-USDT_1h_2024-01-01_2024-01-02.json";
      await fs.mkdir(testCacheDir, { recursive: true });
      await fs.writeFile(
        join(testCacheDir, cacheKey),
        JSON.stringify(mockCandles)
      );

      // Fetch should use cache
      const candles = await fetcher.fetchHistoricalCandles({
        symbol: "BTC-USDT",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-02"),
        interval: "1h"
      });

      expect(candles).toEqual(mockCandles);
    });

    it("should generate correct cache keys", async () => {
      const mockCandles: Candle[] = [
        {
          timestamp: 1704067200000,
          open: 40000,
          high: 40500,
          low: 39500,
          close: 40200,
          volume: 1000000
        }
      ];

      // Save with specific cache key
      const cacheKey = "ETH-USDT_4h_2024-02-01_2024-02-05.json";
      await fs.mkdir(testCacheDir, { recursive: true });
      await fs.writeFile(
        join(testCacheDir, cacheKey),
        JSON.stringify(mockCandles)
      );

      // Fetch with matching parameters
      const candles = await fetcher.fetchHistoricalCandles({
        symbol: "ETH-USDT",
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-02-05"),
        interval: "4h"
      });

      expect(candles).toEqual(mockCandles);
    });
  });

  describe("data structure", () => {
    it("should return valid candle structure", async () => {
      const mockCandles: Candle[] = [
        {
          timestamp: 1704067200000,
          open: 40000,
          high: 40500,
          low: 39500,
          close: 40200,
          volume: 1000000
        }
      ];

      await fs.mkdir(testCacheDir, { recursive: true });
      await fs.writeFile(
        join(testCacheDir, "BTC-USDT_1h_2024-01-01_2024-01-02.json"),
        JSON.stringify(mockCandles)
      );

      const candles = await fetcher.fetchHistoricalCandles({
        symbol: "BTC-USDT",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-02"),
        interval: "1h"
      });

      expect(candles).toBeDefined();
      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThan(0);

      const candle = candles[0];
      expect(candle).toHaveProperty("timestamp");
      expect(candle).toHaveProperty("open");
      expect(candle).toHaveProperty("high");
      expect(candle).toHaveProperty("low");
      expect(candle).toHaveProperty("close");
      expect(candle).toHaveProperty("volume");
      expect(candle.high).toBeGreaterThanOrEqual(candle.low);
    });
  });
});
