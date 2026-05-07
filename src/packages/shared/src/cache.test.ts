import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CacheClient, cacheAside, writeThrough, writeBehind } from "./cache.js";

describe("CacheClient", () => {
  let cache: CacheClient;

  beforeEach(async () => {
    cache = new CacheClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
      prefix: "test:",
      ttl: 60
    });
    await cache.connect();
    await cache.clear();
  });

  afterEach(async () => {
    await cache.clear();
    await cache.disconnect();
  });

  describe("Basic Operations", () => {
    it("should set and get a value", async () => {
      await cache.set("key1", { data: "value1" });
      const result = await cache.get<{ data: string }>("key1");
      expect(result).toEqual({ data: "value1" });
    });

    it("should return null for non-existent key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should delete a key", async () => {
      await cache.set("key1", "value1");
      await cache.del("key1");
      const result = await cache.get("key1");
      expect(result).toBeNull();
    });

    it("should check if key exists", async () => {
      await cache.set("key1", "value1");
      expect(await cache.exists("key1")).toBe(true);
      expect(await cache.exists("nonexistent")).toBe(false);
    });

    it("should handle complex objects", async () => {
      const complexObj = {
        id: 1,
        name: "Test",
        nested: { value: 42 },
        array: [1, 2, 3]
      };
      await cache.set("complex", complexObj);
      const result = await cache.get("complex");
      expect(result).toEqual(complexObj);
    });
  });

  describe("TTL Operations", () => {
    it("should set TTL on value", async () => {
      await cache.set("key1", "value1", 10);
      const ttl = await cache.ttl("key1");
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    it("should expire a key", async () => {
      await cache.set("key1", "value1", 100);
      await cache.expire("key1", 1);
      const ttl = await cache.ttl("key1");
      expect(ttl).toBeLessThanOrEqual(1);
    });

    it("should return -2 for non-existent key TTL", async () => {
      const ttl = await cache.ttl("nonexistent");
      expect(ttl).toBe(-2);
    });
  });

  describe("Batch Operations", () => {
    it("should get multiple keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const results = await cache.mget<string>(["key1", "key2", "key3", "nonexistent"]);
      expect(results).toEqual(["value1", "value2", "value3", null]);
    });

    it("should set multiple keys", async () => {
      await cache.mset([
        { key: "key1", value: "value1", ttl: 60 },
        { key: "key2", value: "value2", ttl: 60 },
        { key: "key3", value: "value3", ttl: 60 }
      ]);

      const results = await cache.mget<string>(["key1", "key2", "key3"]);
      expect(results).toEqual(["value1", "value2", "value3"]);
    });
  });

  describe("Pattern Operations", () => {
    it("should find keys by pattern", async () => {
      await cache.set("user:1", "data1");
      await cache.set("user:2", "data2");
      await cache.set("post:1", "data3");

      const userKeys = await cache.keys("user:*");
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain("user:1");
      expect(userKeys).toContain("user:2");
    });

    it("should clear keys by pattern", async () => {
      await cache.set("user:1", "data1");
      await cache.set("user:2", "data2");
      await cache.set("post:1", "data3");

      await cache.clear("user:*");

      expect(await cache.exists("user:1")).toBe(false);
      expect(await cache.exists("user:2")).toBe(false);
      expect(await cache.exists("post:1")).toBe(true);
    });

    it("should clear all keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      await cache.clear();

      expect(await cache.exists("key1")).toBe(false);
      expect(await cache.exists("key2")).toBe(false);
      expect(await cache.exists("key3")).toBe(false);
    });
  });

  describe("Counter Operations", () => {
    it("should increment a counter", async () => {
      const result1 = await cache.increment("counter");
      expect(result1).toBe(1);

      const result2 = await cache.increment("counter", 5);
      expect(result2).toBe(6);
    });

    it("should decrement a counter", async () => {
      await cache.increment("counter", 10);

      const result1 = await cache.decrement("counter");
      expect(result1).toBe(9);

      const result2 = await cache.decrement("counter", 5);
      expect(result2).toBe(4);
    });
  });

  describe("Connection Management", () => {
    it("should report connection status", async () => {
      expect(cache.isConnected()).toBe(true);
      await cache.disconnect();
      expect(cache.isConnected()).toBe(false);
    });

    it("should handle operations when disconnected", async () => {
      await cache.disconnect();

      await cache.set("key1", "value1");
      const result = await cache.get("key1");
      expect(result).toBeNull();
    });
  });
});

describe("Cache Patterns", () => {
  let cache: CacheClient;

  beforeEach(async () => {
    cache = new CacheClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
      prefix: "test:",
      ttl: 60
    });
    await cache.connect();
    await cache.clear();
  });

  afterEach(async () => {
    await cache.clear();
    await cache.disconnect();
  });

  describe("Cache-Aside", () => {
    it("should fetch from cache if available", async () => {
      await cache.set("data:1", { value: "cached" });

      const fetcher = vi.fn().mockResolvedValue({ value: "fresh" });
      const result = await cacheAside("data:1", fetcher);

      expect(result).toEqual({ value: "cached" });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("should fetch and cache if not available", async () => {
      const fetcher = vi.fn().mockResolvedValue({ value: "fresh" });
      const result = await cacheAside("data:1", fetcher);

      expect(result).toEqual({ value: "fresh" });
      expect(fetcher).toHaveBeenCalledOnce();

      const cached = await cache.get("data:1");
      expect(cached).toEqual({ value: "fresh" });
    });
  });

  describe("Write-Through", () => {
    it("should write to both cache and storage", async () => {
      const writer = vi.fn().mockResolvedValue(undefined);
      const value = { data: "test" };

      await writeThrough("key1", value, writer);

      expect(writer).toHaveBeenCalledWith(value);
      const cached = await cache.get("key1");
      expect(cached).toEqual(value);
    });
  });

  describe("Write-Behind", () => {
    it("should write to cache immediately and storage asynchronously", async () => {
      const writer = vi.fn().mockResolvedValue(undefined);
      const value = { data: "test" };

      await writeBehind("key1", value, writer);

      const cached = await cache.get("key1");
      expect(cached).toEqual(value);

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(writer).toHaveBeenCalledWith(value);
    });

    it("should handle writer errors gracefully", async () => {
      const writer = vi.fn().mockRejectedValue(new Error("Write failed"));
      const value = { data: "test" };

      await writeBehind("key1", value, writer);

      const cached = await cache.get("key1");
      expect(cached).toEqual(value);
    });
  });
});
