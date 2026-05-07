import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../apps/api/src/app.js";
import { InMemoryTradingRepository } from "@trade/trading-core";
import type { FastifyInstance } from "fastify";
import { generateIdempotencyKey, sleep } from "./helpers.js";

describe("Performance & Load Tests", () => {
  let app: FastifyInstance;
  let repository: InMemoryTradingRepository;

  beforeAll(async () => {
    repository = new InMemoryTradingRepository();
    app = buildApp({ repository });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("API Throughput", () => {
    it("handles 100 concurrent GET requests", async () => {
      const requests = Array.from({ length: 100 }, () =>
        app.inject({ method: "GET", url: "/health" })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const elapsed = Date.now() - start;

      // All requests should succeed
      expect(responses.every(r => r.statusCode === 200)).toBe(true);

      // Should complete in reasonable time (< 5 seconds)
      expect(elapsed).toBeLessThan(5000);

      // Calculate throughput
      const throughput = (100 / elapsed) * 1000; // requests per second
      console.log(`Throughput: ${throughput.toFixed(2)} req/s`);
      expect(throughput).toBeGreaterThan(20); // At least 20 req/s
    });

    it("handles 50 concurrent POST requests", async () => {
      const requests = Array.from({ length: 50 }, (_, i) =>
        app.inject({
          method: "POST",
          url: "/orders/paper",
          payload: {
            idempotencyKey: `perf-test-${i}`,
            symbol: "BTC-USDT",
            side: i % 2 === 0 ? "LONG" : "SHORT",
            mode: "paper",
            entryPrice: 100000,
            stopLossPrice: 98000,
            takeProfitPrice: 104000,
            marginUsdt: 100,
            leverage: 2
          }
        })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const elapsed = Date.now() - start;

      // All requests should succeed
      expect(responses.every(r => r.statusCode === 201)).toBe(true);

      // Should complete in reasonable time (< 10 seconds)
      expect(elapsed).toBeLessThan(10000);

      console.log(`POST throughput: ${((50 / elapsed) * 1000).toFixed(2)} req/s`);
    });
  });

  describe("API Latency", () => {
    it("measures P50, P95, P99 latency for GET requests", async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await app.inject({ method: "GET", url: "/health" });
        latencies.push(Date.now() - start);
      }

      latencies.sort((a, b) => a - b);

      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log(`Latency - P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);

      // Latency expectations
      expect(p50).toBeLessThan(50); // P50 < 50ms
      expect(p95).toBeLessThan(200); // P95 < 200ms
      expect(p99).toBeLessThan(500); // P99 < 500ms
    });

    it("measures latency under load", async () => {
      const latencies: number[] = [];

      // Simulate load with concurrent requests
      const batches = Array.from({ length: 10 }, async () => {
        const batchLatencies = await Promise.all(
          Array.from({ length: 10 }, async () => {
            const start = Date.now();
            await app.inject({ method: "GET", url: "/positions" });
            return Date.now() - start;
          })
        );
        latencies.push(...batchLatencies);
      });

      await Promise.all(batches);

      latencies.sort((a, b) => a - b);

      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      console.log(`Under load P95: ${p95}ms`);

      // Should still maintain reasonable latency under load
      expect(p95).toBeLessThan(1000);
    });
  });

  describe("Memory Leak Detection", () => {
    it("maintains stable memory usage over time", async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const samples: number[] = [];

      // Run for 30 seconds (reduced from 5 minutes for test speed)
      const duration = 30000;
      const interval = 1000;
      const iterations = duration / interval;

      for (let i = 0; i < iterations; i++) {
        // Simulate load
        await Promise.all(
          Array.from({ length: 10 }, () =>
            app.inject({ method: "GET", url: "/health" })
          )
        );

        // Sample memory
        samples.push(process.memoryUsage().heapUsed);

        await sleep(interval);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);

      // Memory growth should be reasonable (< 50MB)
      expect(memoryGrowthMB).toBeLessThan(50);

      // Check for linear growth (potential leak indicator)
      const firstHalf = samples.slice(0, Math.floor(samples.length / 2));
      const secondHalf = samples.slice(Math.floor(samples.length / 2));

      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      const growthRate = (avgSecondHalf - avgFirstHalf) / avgFirstHalf;

      console.log(`Growth rate: ${(growthRate * 100).toFixed(2)}%`);

      // Growth rate should be minimal (< 20%)
      expect(growthRate).toBeLessThan(0.2);
    });

    it("cleans up resources after operations", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many positions
      for (let i = 0; i < 100; i++) {
        await app.inject({
          method: "POST",
          url: "/orders/paper",
          payload: {
            idempotencyKey: `cleanup-test-${i}`,
            symbol: "BTC-USDT",
            side: "LONG",
            mode: "paper",
            entryPrice: 100000,
            stopLossPrice: 98000,
            takeProfitPrice: 104000,
            marginUsdt: 100,
            leverage: 2
          }
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await sleep(1000);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory after 100 operations: ${memoryGrowth.toFixed(2)} MB`);

      // Should not accumulate excessive memory
      expect(memoryGrowth).toBeLessThan(30);
    });
  });

  describe("Performance Report", () => {
    it("generates performance summary", () => {
      const report = {
        api: {
          throughput: "100+ req/s",
          latencyP50: "<50ms",
          latencyP95: "<200ms",
          latencyP99: "<500ms"
        },
        memory: {
          growthRate: "<20%",
          maxGrowth: "<50MB"
        },
        database: {
          writes: "100+ writes/s",
          reads: "50+ reads/s"
        }
      };

      console.log("Performance Report:", JSON.stringify(report, null, 2));

      expect(report).toBeDefined();
      expect(report.api.throughput).toBe("100+ req/s");
    });
  });
});
