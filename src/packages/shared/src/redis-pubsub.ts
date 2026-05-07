import Redis from "ioredis";
import type { MarketTick } from "./types.js";

export interface RedisPublisherOptions {
  redisUrl?: string;
  onError?: (error: Error) => void;
}

export interface RedisSubscriberOptions {
  redisUrl?: string;
  onTick: (tick: MarketTick) => void;
  onMessage?: (channel: string, payload: unknown) => void;
  onError?: (error: Error) => void;
}

export class RedisPublisher {
  private client: Redis | null = null;
  private readonly redisUrl: string;
  private readonly onError: (error: Error) => void;

  constructor(options: RedisPublisherOptions = {}) {
    this.redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379";
    this.onError = options.onError ?? ((error) => console.error("RedisPublisher error:", error));
  }

  async connect(): Promise<void> {
    try {
      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        }
      });

      this.client.on("error", (error) => {
        this.onError(error);
      });

      await this.client.ping();
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    if (!this.client) {
      throw new Error("RedisPublisher not connected. Call connect() first.");
    }

    try {
      await this.client.publish(channel, JSON.stringify(payload));
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.status === "ready";
  }
}

export class RedisSubscriber {
  private client: Redis | null = null;
  private readonly redisUrl: string;
  private readonly onTick: (tick: MarketTick) => void;
  private readonly onMessage?: (channel: string, payload: unknown) => void;
  private readonly onError: (error: Error) => void;

  constructor(options: RedisSubscriberOptions) {
    this.redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379";
    this.onTick = options.onTick;
    this.onMessage = options.onMessage;
    this.onError = options.onError ?? ((error) => console.error("RedisSubscriber error:", error));
  }

  async connect(): Promise<void> {
    try {
      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        }
      });

      this.client.on("error", (error) => {
        this.onError(error);
      });

      this.client.on("message", (channel, message) => {
        try {
          const payload = JSON.parse(message) as unknown;
          this.onMessage?.(channel, payload);
          if (channel === "market:ticks" || channel === "market:ticks.consensus" || channel.startsWith("market:ticks.")) {
            this.onTick(payload as MarketTick);
          }
        } catch (error) {
          this.onError(error instanceof Error ? error : new Error(String(error)));
        }
      });

      await this.client.ping();
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async subscribe(channel: string): Promise<void> {
    if (!this.client) {
      throw new Error("RedisSubscriber not connected. Call connect() first.");
    }

    try {
      await this.client.subscribe(channel);
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.status === "ready";
  }
}
