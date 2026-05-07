/**
 * Unit tests for rate limiting middleware
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TelegramRateLimiter } from "../access-policy.js";

describe("TelegramRateLimiter", () => {
  let rateLimiter: TelegramRateLimiter;
  let currentTime: number;

  beforeEach(() => {
    currentTime = Date.now();
    rateLimiter = new TelegramRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      now: () => currentTime
    });
  });

  it("should allow requests within limit", () => {
    const userId = "123456789";

    for (let i = 0; i < 5; i++) {
      const result = rateLimiter.check(userId);
      expect(result.allowed).toBe(true);
    }
  });

  it("should block requests exceeding limit", () => {
    const userId = "123456789";

    // Make 5 requests (at limit)
    for (let i = 0; i < 5; i++) {
      rateLimiter.check(userId);
    }

    // 6th request should be blocked
    const result = rateLimiter.check(userId);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("should allow requests after window expires", () => {
    const userId = "123456789";

    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      rateLimiter.check(userId);
    }

    // Advance time beyond window
    currentTime += 61000;

    // Should allow new requests
    const result = rateLimiter.check(userId);
    expect(result.allowed).toBe(true);
  });

  it("should track different users separately", () => {
    const user1 = "111111111";
    const user2 = "222222222";

    // User 1 makes 5 requests
    for (let i = 0; i < 5; i++) {
      rateLimiter.check(user1);
    }

    // User 2 should still be allowed
    const result = rateLimiter.check(user2);
    expect(result.allowed).toBe(true);
  });

  it("should calculate correct retry-after time", () => {
    const userId = "123456789";

    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      rateLimiter.check(userId);
    }

    // 6th request should be blocked
    const result = rateLimiter.check(userId);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60000);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });
});
