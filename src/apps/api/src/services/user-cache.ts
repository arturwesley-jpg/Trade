import type { User } from "@trade/shared";
import { cache, cacheAside, writeThrough } from "@trade/shared/cache";
import { logger } from "@trade/shared/logger";

export class UserCache {
  private readonly userTTL = 300; // 5 minutes
  private readonly sessionTTL = 3600; // 1 hour

  async getUser(userId: string, fetcher: () => Promise<User>): Promise<User> {
    return cacheAside(`user:${userId}`, fetcher, this.userTTL);
  }

  async setUser(userId: string, user: User): Promise<void> {
    await cache.set(`user:${userId}`, user, this.userTTL);
  }

  async updateUser(
    userId: string,
    user: User,
    writer: (user: User) => Promise<void>
  ): Promise<void> {
    await writeThrough(`user:${userId}`, user, writer, this.userTTL);
  }

  async invalidateUser(userId: string): Promise<void> {
    await cache.del(`user:${userId}`);
    logger.debug({ userId }, "User cache invalidated");
  }

  async getUserSession(sessionId: string): Promise<{ userId: string; expiresAt: number } | null> {
    return cache.get(`session:${sessionId}`);
  }

  async setUserSession(
    sessionId: string,
    data: { userId: string; expiresAt: number }
  ): Promise<void> {
    await cache.set(`session:${sessionId}`, data, this.sessionTTL);
  }

  async invalidateUserSession(sessionId: string): Promise<void> {
    await cache.del(`session:${sessionId}`);
    logger.debug({ sessionId }, "Session cache invalidated");
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const keys = await cache.keys(`session:*`);
    const sessions = await cache.mget<{ userId: string; expiresAt: number }>(keys);

    const toInvalidate = keys.filter((_: string, index: number) => {
      const session = sessions[index];
      return session && session.userId === userId;
    });

    await Promise.all(toInvalidate.map((key: string) => cache.del(key)));
    logger.debug({ userId, count: toInvalidate.length }, "All user sessions invalidated");
  }

  async getUserPreferences(userId: string): Promise<Record<string, unknown> | null> {
    return cache.get(`user:${userId}:preferences`);
  }

  async setUserPreferences(userId: string, preferences: Record<string, unknown>): Promise<void> {
    await cache.set(`user:${userId}:preferences`, preferences, this.userTTL);
  }

  async invalidateUserPreferences(userId: string): Promise<void> {
    await cache.del(`user:${userId}:preferences`);
  }
}

export const userCache = new UserCache();
