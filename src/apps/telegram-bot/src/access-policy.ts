export interface TelegramAccessPolicyOptions {
  appEnv: string;
  allowedUserIds: string;
  adminUserIds: string;
}

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
}

export function parseIdSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function createTelegramAccessPolicy(options: TelegramAccessPolicyOptions) {
  const allowedUserIds = parseIdSet(options.allowedUserIds);
  const adminUserIds = parseIdSet(options.adminUserIds || options.allowedUserIds);
  const isProduction = options.appEnv === "production";

  return {
    checkUser(id: string | undefined): AccessCheck {
      if (!id) return { allowed: false, reason: "Telegram user id is missing" };
      if (isProduction && allowedUserIds.size === 0) {
        return { allowed: false, reason: "Telegram allowlist is required in production" };
      }
      if (allowedUserIds.size > 0 && !allowedUserIds.has(id)) {
        return { allowed: false, reason: "Telegram user is not authorized" };
      }
      return { allowed: true };
    },
    isAdmin(id: string | undefined): boolean {
      return Boolean(id && adminUserIds.has(id));
    }
  };
}

export interface TelegramRateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

export class TelegramRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(private readonly options: TelegramRateLimiterOptions) {
    this.now = options.now ?? Date.now;
  }

  check(userId: string): { allowed: boolean; retryAfterMs?: number } {
    const now = this.now();
    const windowStart = now - this.options.windowMs;
    const recentHits = (this.hits.get(userId) ?? []).filter((timestamp) => timestamp > windowStart);

    if (recentHits.length >= this.options.maxRequests) {
      const oldest = recentHits[0] ?? now;
      return { allowed: false, retryAfterMs: Math.max(0, this.options.windowMs - (now - oldest)) };
    }

    recentHits.push(now);
    this.hits.set(userId, recentHits);
    return { allowed: true };
  }
}
