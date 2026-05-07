import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { createServer, Server } from "http";
import { TradingWebSocketServer, WebSocketMessage } from "../websocket.js";

describe("TradingWebSocketServer - Unit Tests", () => {
  let httpServer: Server;
  let wsServer: TradingWebSocketServer;
  const TEST_PORT = 9001;
  const JWT_SECRET = "test-jwt-secret-key-12345678";

  beforeEach(() => {
    httpServer = createServer();
    httpServer.listen(TEST_PORT);
    wsServer = new TradingWebSocketServer({
      server: httpServer,
      path: "/ws",
      jwtAccessSecret: JWT_SECRET
    });
  });

  afterEach(() => {
    wsServer.close();
    httpServer.close();
  });

  describe("Message Serialization/Deserialization", () => {
    it("should serialize message to JSON string", () => {
      const message: WebSocketMessage = {
        type: "data",
        channel: "market:BTC/USD",
        data: { price: 50000, volume: 100 },
        timestamp: Date.now()
      };

      const serialized = JSON.stringify(message);
      expect(serialized).toContain("market:BTC/USD");
      expect(serialized).toContain("50000");
    });

    it("should deserialize JSON string to message object", () => {
      const json = JSON.stringify({
        type: "subscribe",
        channel: "market:BTC/USD",
        timestamp: Date.now()
      });

      const message = JSON.parse(json) as WebSocketMessage;
      expect(message.type).toBe("subscribe");
      expect(message.channel).toBe("market:BTC/USD");
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it("should handle complex nested data structures", () => {
      const complexData = {
        user: { id: "123", name: "Test" },
        trades: [
          { id: 1, price: 50000, amount: 0.5 },
          { id: 2, price: 51000, amount: 0.3 }
        ],
        metadata: { source: "binance", timestamp: Date.now() }
      };

      const message: WebSocketMessage = {
        type: "data",
        channel: "trades:123",
        data: complexData,
        timestamp: Date.now()
      };

      const serialized = JSON.stringify(message);
      const deserialized = JSON.parse(serialized) as WebSocketMessage;

      expect(deserialized.data).toEqual(complexData);
    });

    it("should handle error messages with proper structure", () => {
      const errorMessage: WebSocketMessage = {
        type: "error",
        error: { code: "AUTH_ERROR", message: "Invalid token" },
        timestamp: Date.now()
      };

      const serialized = JSON.stringify(errorMessage);
      const deserialized = JSON.parse(serialized) as WebSocketMessage;

      expect(deserialized.type).toBe("error");
      expect(deserialized.error?.code).toBe("AUTH_ERROR");
      expect(deserialized.error?.message).toBe("Invalid token");
    });
  });

  describe("Subscription Management", () => {
    it("should track client subscriptions", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await authenticateClient(client, token);
      await subscribeToChannel(client, "market:BTC/USD");

      const stats = wsServer.getStats();
      expect(stats.totalSubscriptions).toBeGreaterThan(0);

      client.close();
    });

    it("should prevent duplicate subscriptions", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await authenticateClient(client, token);
      await subscribeToChannel(client, "market:BTC/USD");
      await subscribeToChannel(client, "market:BTC/USD");

      const stats = wsServer.getStats();
      const btcChannel = stats.channelStats.find(c => c.channel === "market:BTC/USD");
      expect(btcChannel?.subscribers).toBe(1);

      client.close();
    });

    it("should enforce maximum subscription limit", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await authenticateClient(client, token);

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      // Try to subscribe to 51 channels (limit is 50)
      for (let i = 0; i < 51; i++) {
        await subscribeToChannel(client, `market:PAIR${i}`);
        await sleep(10);
      }

      const errorMessages = messages.filter(m => m.includes("SUBSCRIPTION_LIMIT"));
      expect(errorMessages.length).toBeGreaterThan(0);

      client.close();
    });

    it("should remove subscription on unsubscribe", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await authenticateClient(client, token);
      await subscribeToChannel(client, "market:BTC/USD");
      await unsubscribeFromChannel(client, "market:BTC/USD");

      await sleep(100);

      const stats = wsServer.getStats();
      const btcChannel = stats.channelStats.find(c => c.channel === "market:BTC/USD");
      expect(btcChannel).toBeUndefined();

      client.close();
    });
  });

  describe("Authentication Flow", () => {
    it("should accept valid JWT token", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      await authenticateClient(client, token);

      const authSuccess = messages.some(m =>
        m.includes("Authentication successful") || m.includes("user123")
      );
      expect(authSuccess).toBe(true);

      client.close();
    });

    it("should reject invalid JWT token", async () => {
      const client = await createTestClient(TEST_PORT);

      const messages: string[] = [];
      let closed = false;
      client.on("message", (data) => {
        messages.push(data.toString());
      });
      client.on("close", () => {
        closed = true;
      });

      await authenticateClient(client, "invalid-token");
      await sleep(200);

      const authError = messages.some(m => m.includes("AUTH_ERROR"));
      expect(authError).toBe(true);
      expect(closed).toBe(true);
    });

    it("should reject subscription without authentication", async () => {
      const client = await createTestClient(TEST_PORT);

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      await subscribeToChannel(client, "trades:user123");
      await sleep(100);

      const authRequired = messages.some(m => m.includes("AUTH_REQUIRED"));
      expect(authRequired).toBe(true);

      client.close();
    });

    it("should allow public channel subscription without auth", async () => {
      const client = await createTestClient(TEST_PORT);

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      await subscribeToChannel(client, "market:BTC/USD");
      await sleep(100);

      const subscribed = messages.some(m => m.includes("subscribed"));
      expect(subscribed).toBe(true);

      client.close();
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce message rate limit", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await authenticateClient(client, token);

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      // Send 150 messages rapidly (limit is 100/second)
      for (let i = 0; i < 150; i++) {
        client.send(JSON.stringify({
          type: "ping",
          timestamp: Date.now()
        }));
      }

      await sleep(200);

      const rateLimitErrors = messages.filter(m => m.includes("RATE_LIMIT"));
      expect(rateLimitErrors.length).toBeGreaterThan(0);

      client.close();
    });

    it("should reset rate limit after time window", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await authenticateClient(client, token);

      // Send messages within limit
      for (let i = 0; i < 50; i++) {
        client.send(JSON.stringify({
          type: "ping",
          timestamp: Date.now()
        }));
      }

      await sleep(1100); // Wait for rate limit window to reset

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      // Send more messages
      for (let i = 0; i < 50; i++) {
        client.send(JSON.stringify({
          type: "ping",
          timestamp: Date.now()
        }));
      }

      await sleep(200);

      const rateLimitErrors = messages.filter(m => m.includes("RATE_LIMIT"));
      expect(rateLimitErrors.length).toBe(0);

      client.close();
    });
  });

  describe("Heartbeat Mechanism", () => {
    it("should respond to ping with pong", async () => {
      const client = await createTestClient(TEST_PORT);

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      client.send(JSON.stringify({
        type: "ping",
        timestamp: Date.now()
      }));

      await sleep(100);

      const pongReceived = messages.some(m => m.includes("pong"));
      expect(pongReceived).toBe(true);

      client.close();
    });

    it("should track client heartbeat", async () => {
      const client = await createTestClient(TEST_PORT);

      // Respond to server pings
      client.on("ping", () => {
        client.pong();
      });

      await sleep(500);

      const stats = wsServer.getStats();
      expect(stats.totalClients).toBe(1);

      client.close();
    });
  });

  describe("Connection Statistics", () => {
    it("should track total client count", async () => {
      const client1 = await createTestClient(TEST_PORT);
      const client2 = await createTestClient(TEST_PORT);

      await sleep(100);

      expect(wsServer.getClientCount()).toBe(2);

      client1.close();
      client2.close();
    });

    it("should track authenticated vs unauthenticated clients", async () => {
      const client1 = await createTestClient(TEST_PORT);
      const client2 = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await authenticateClient(client1, token);
      await sleep(100);

      const stats = wsServer.getStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.authenticatedClients).toBe(1);

      client1.close();
      client2.close();
    });

    it("should track channel statistics", async () => {
      const client1 = await createTestClient(TEST_PORT);
      const client2 = await createTestClient(TEST_PORT);

      await subscribeToChannel(client1, "market:BTC/USD");
      await subscribeToChannel(client2, "market:BTC/USD");
      await subscribeToChannel(client2, "market:ETH/USD");

      await sleep(100);

      const stats = wsServer.getStats();
      expect(stats.totalChannels).toBeGreaterThanOrEqual(2);

      const btcChannel = stats.channelStats.find(c => c.channel === "market:BTC/USD");
      expect(btcChannel?.subscribers).toBe(2);

      client1.close();
      client2.close();
    });
  });
});

// Helper functions

function createTestClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    client.on("open", () => resolve(client));
    client.on("error", reject);
    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });
}

function generateTestToken(secret: string, userId: string): string {
  // Simple mock token generation for testing
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId, email: `${userId}@test.com` }, secret, { expiresIn: "1h" });
}

async function authenticateClient(client: WebSocket, token: string): Promise<void> {
  client.send(JSON.stringify({
    type: "auth",
    data: { token },
    timestamp: Date.now()
  }));
  await sleep(100);
}

async function subscribeToChannel(client: WebSocket, channel: string): Promise<void> {
  client.send(JSON.stringify({
    type: "subscribe",
    channel,
    timestamp: Date.now()
  }));
  await sleep(50);
}

async function unsubscribeFromChannel(client: WebSocket, channel: string): Promise<void> {
  client.send(JSON.stringify({
    type: "unsubscribe",
    channel,
    timestamp: Date.now()
  }));
  await sleep(50);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
