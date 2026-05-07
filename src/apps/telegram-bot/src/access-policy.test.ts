import { describe, expect, it } from "vitest";
import { createTelegramAccessPolicy, parseIdSet, TelegramRateLimiter } from "./access-policy.js";

describe("telegram access policy", () => {
  it("parses comma-separated ids safely", () => {
    expect([...parseIdSet(" 1,2,, 3 ")]).toEqual(["1", "2", "3"]);
  });

  it("requires an allowlist in production", () => {
    const policy = createTelegramAccessPolicy({
      appEnv: "production",
      allowedUserIds: "",
      adminUserIds: ""
    });

    expect(policy.checkUser("123")).toEqual({ allowed: false, reason: "Telegram allowlist is required in production" });
  });

  it("allows development access without an allowlist but still restricts admin commands", () => {
    const policy = createTelegramAccessPolicy({
      appEnv: "development",
      allowedUserIds: "",
      adminUserIds: "42"
    });

    expect(policy.checkUser("123")).toEqual({ allowed: true });
    expect(policy.isAdmin("123")).toBe(false);
    expect(policy.isAdmin("42")).toBe(true);
  });

  it("rate limits repeated commands within a time window", () => {
    let now = 1_000;
    const limiter = new TelegramRateLimiter({ maxRequests: 2, windowMs: 1_000, now: () => now });

    expect(limiter.check("42").allowed).toBe(true);
    expect(limiter.check("42").allowed).toBe(true);
    expect(limiter.check("42")).toEqual({ allowed: false, retryAfterMs: 1_000 });

    now = 2_001;
    expect(limiter.check("42").allowed).toBe(true);
  });
});
