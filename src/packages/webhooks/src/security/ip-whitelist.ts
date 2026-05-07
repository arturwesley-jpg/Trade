/**
 * IP Whitelist Management
 */

import Redis from 'ioredis';

export class IPWhitelist {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Add IP to whitelist for webhook
   */
  async addIP(webhookId: string, ip: string): Promise<void> {
    const key = `webhook:whitelist:${webhookId}`;
    await this.redis.sadd(key, ip);
  }

  /**
   * Remove IP from whitelist
   */
  async removeIP(webhookId: string, ip: string): Promise<void> {
    const key = `webhook:whitelist:${webhookId}`;
    await this.redis.srem(key, ip);
  }

  /**
   * Check if IP is whitelisted
   */
  async isWhitelisted(webhookId: string, ip: string): Promise<boolean> {
    const key = `webhook:whitelist:${webhookId}`;

    // If no whitelist exists, allow all IPs
    const exists = await this.redis.exists(key);
    if (!exists) {
      return true;
    }

    return (await this.redis.sismember(key, ip)) === 1;
  }

  /**
   * Get all whitelisted IPs for webhook
   */
  async getWhitelistedIPs(webhookId: string): Promise<string[]> {
    const key = `webhook:whitelist:${webhookId}`;
    return await this.redis.smembers(key);
  }

  /**
   * Clear whitelist for webhook
   */
  async clearWhitelist(webhookId: string): Promise<void> {
    const key = `webhook:whitelist:${webhookId}`;
    await this.redis.del(key);
  }
}
