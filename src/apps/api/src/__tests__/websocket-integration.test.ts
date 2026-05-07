import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { createServer, Server } from "http";
import { TradingWebSocketServer } from "../websocket.js";
import type { WebSocketMessage } from "../websocket.js";

describe("TradingWebSocketServer - Integration Tests", () => {
  let httpServer: Server;
  let wsServer: TradingWebSocketServer;
  const TEST_PORT = 9002;
  const JWT_SECRET = "test-jwt-secret-integration-12345678";

  beforeAll(() => {
    httpServer = createServer();
    httpServer.listen(TEST_PORT);
    wsServer = new TradingWebSocketServer({
      server: httpServer,
      path: "/ws",
      jwtAccessSecret: JWT_SECRET
    });
  });

  afterAll(() => {
    wsServer.close();
    httpServer.close();
  });

  describe("End-to-End Message Flow", () => {
    it("should handle complete authentication and subscription flow", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      const messages: WebSocketMessage[] = [];
      client.on("message", (data) => {
        try {
          messages.push(JSON.parse(data.toString()));
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Step 1: Authenticate
      await sendMessage(client, {
        type: "auth",
        data: { token },
        timestamp: Date.now()
      });
      await sleep(100);

      // Step 2: Subscribe to channels
      await sendMessage(client, {
        type: "subscribe",
        channel: "market:BTC/USD",
        timestamp: Date.now()
      });
      await sleep(50);

      await sendMessage(client, {
        type: "subscribe",
        channel: "trades:user123",
        timestamp: Date.now()
      });
      await sleep(50);

      // Step 3: Verify subscriptions
      const subscribedMessages = messages.filter(m => m.type === "subscribed");
      expect(subscribedMessages.length).toBeGreaterThanOrEqual(2);

      // Step 4: Broadcast to channel
      wsServer.broadcastToChannel("market:BTC/USD", {
        price: 50000,
        volume: 100,
        timestamp: Date.now()
      });
      await sleep(100);

      // Step 5: Verify data received
      const dataMessages = messages.filter(m => m.type === "data" && m.channel === "market:BTC/USD");
      expect(dataMessages.length).toBeGreaterThan(0);
      expect(dataMessages[0].data).toMatchObject({ price: 50000, volume: 100 });

      client.close();
    });

    it("should handle user-specific broadcasts", async () => {
      const client1 = await createTestClient(TEST_PORT);
      const client2 = await createTestClient(TEST_PORT);
      const token1 = generateTestToken(JWT_SECRET, "user123");
      const token2 = generateTestToken(JWT_SECRET, "user456");

      const messages1: WebSocketMessage[] = [];
      const messages2: WebSocketMessage[] = [];

      client1.on("message", (data) => {
        try {
          messages1.push(JSON.parse(data.toString()));
        } catch (e) {}
      });

      client2.on("message", (data) => {
        try {
          messages2.push(JSON.parse(data.toString()));
        } catch (e) {}
      });

      // Authenticate both clients
      await sendMessage(client1, { type: "auth", data: { token: token1 }, timestamp: Date.now() });
      await sendMessage(client2, { type: "auth", data: { token: token2 }, timestamp: Date.now() });
      await sleep(100);

      // Subscribe to user-specific channels
      await sendMessage(client1, { type: "subscribe", channel: "trades:user123", timestamp: Date.now() });
      await sendMessage(client2, { type: "subscribe", channel: "trades:user456", timestamp: Date.now() });
      await sleep(100);

      // Broadcast to user123 only
      wsServer.broadcastToUser("user123", {
        type: "trade_executed",
        tradeId: "trade_001",
        amount: 0.5
      });
      await sleep(100);

      // Verify only user123 received the message
      const user1Trades = messages1.filter(m => m.type === "data" && m.channel === "trades:user123");
      const user2Trades = messages2.filter(m => m.type === "data" && m.channel === "trades:user456");

      expect(user1Trades.length).toBeGreaterThan(0);
      expect(user2Trades.length).toBe(0);

      client1.close();
      client2.close();
    });

    it("should handle public channel broadcasts to all subscribers", async () => {
      const client1 = await createTestClient(TEST_PORT);
      const client2 = await createTestClient(TEST_PORT);
      const client3 = await createTestClient(TEST_PORT);

      const messages1: WebSocketMessage[] = [];
      const messages2: WebSocketMessage[] = [];
      const messages3: WebSocketMessage[] = [];

      client1.on("message", (data) => {
        try {
          messages1.push(JSON.parse(data.toString()));
        } catch (e) {}
      });

      client2.on("message", (data) => {
        try {
          messages2.push(JSON.parse(data.toString()));
        } catch (e) {}
      });

      client3.on("message", (data) => {
        try {
          messages3.push(JSON.parse(data.toString()));
        } catch (e) {}
      });

      // Subscribe all to same channel
      await sendMessage(client1, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sendMessage(client2, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sendMessage(client3, { type: "subscribe", channel: "market:ETH/USD", timestamp: Date.now() });
      await sleep(100);

      // Broadcast to BTC channel
      wsServer.broadcastToChannel("market:BTC/USD", {
        price: 51000,
        volume: 200,
        timestamp: Date.now()
      });
      await sleep(100);

      // Verify only BTC subscribers received the message
      const btcData1 = messages1.filter(m => m.type === "data" && m.channel === "market:BTC/USD");
      const btcData2 = messages2.filter(m => m.type === "data" && m.channel === "market:BTC/USD");
      const btcData3 = messages3.filter(m => m.type === "data" && m.channel === "market:BTC/USD");

      expect(btcData1.length).toBeGreaterThan(0);
      expect(btcData2.length).toBeGreaterThan(0);
      expect(btcData3.length).toBe(0);

      client1.close();
      client2.close();
      client3.close();
    });
  });

  describe("Multiple Client Connections", () => {
    it("should handle 10 concurrent connections", async () => {
      const clients: WebSocket[] = [];

      for (let i = 0; i < 10; i++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);
      }

      await sleep(200);

      expect(wsServer.getClientCount()).toBeGreaterThanOrEqual(10);

      clients.forEach(client => client.close());
      await sleep(200);

      expect(wsServer.getClientCount()).toBeLessThan(10);
    });

    it("should handle multiple clients subscribing to same channel", async () => {
      const clients: WebSocket[] = [];
      const messageCounters: number[] = [];

      for (let i = 0; i < 5; i++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);
        messageCounters.push(0);

        const index = i;
        client.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "data" && msg.channel === "market:BTC/USD") {
              messageCounters[index]++;
            }
          } catch (e) {}
        });

        await sendMessage(client, {
          type: "subscribe",
          channel: "market:BTC/USD",
          timestamp: Date.now()
        });
      }

      await sleep(200);

      // Broadcast 3 messages
      for (let i = 0; i < 3; i++) {
        wsServer.broadcastToChannel("market:BTC/USD", {
          price: 50000 + i * 100,
          volume: 100,
          timestamp: Date.now()
        });
        await sleep(50);
      }

      await sleep(200);

      // All clients should have received all 3 messages
      messageCounters.forEach(count => {
        expect(count).toBe(3);
      });

      clients.forEach(client => client.close());
    });

    it("should handle clients with different subscription sets", async () => {
      const client1 = await createTestClient(TEST_PORT);
      const client2 = await createTestClient(TEST_PORT);
      const client3 = await createTestClient(TEST_PORT);

      const messages1: string[] = [];
      const messages2: string[] = [];
      const messages3: string[] = [];

      client1.on("message", (data) => messages1.push(data.toString()));
      client2.on("message", (data) => messages2.push(data.toString()));
      client3.on("message", (data) => messages3.push(data.toString()));

      // Different subscription patterns
      await sendMessage(client1, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sendMessage(client2, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sendMessage(client2, { type: "subscribe", channel: "market:ETH/USD", timestamp: Date.now() });
      await sendMessage(client3, { type: "subscribe", channel: "market:ETH/USD", timestamp: Date.now() });
      await sleep(200);

      // Broadcast to both channels
      wsServer.broadcastToChannel("market:BTC/USD", { price: 50000 });
      wsServer.broadcastToChannel("market:ETH/USD", { price: 3000 });
      await sleep(200);

      // Verify message distribution
      const btcCount1 = messages1.filter(m => m.includes("BTC/USD")).length;
      const btcCount2 = messages2.filter(m => m.includes("BTC/USD")).length;
      const btcCount3 = messages3.filter(m => m.includes("BTC/USD")).length;

      const ethCount1 = messages1.filter(m => m.includes("ETH/USD")).length;
      const ethCount2 = messages2.filter(m => m.includes("ETH/USD")).length;
      const ethCount3 = messages3.filter(m => m.includes("ETH/USD")).length;

      expect(btcCount1).toBeGreaterThan(0);
      expect(btcCount2).toBeGreaterThan(0);
      expect(btcCount3).toBe(0);

      expect(ethCount1).toBe(0);
      expect(ethCount2).toBeGreaterThan(0);
      expect(ethCount3).toBeGreaterThan(0);

      client1.close();
      client2.close();
      client3.close();
    });
  });

  describe("Reconnection Scenarios", () => {
    it("should handle client disconnect and reconnect", async () => {
      let client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await sendMessage(client, { type: "auth", data: { token }, timestamp: Date.now() });
      await sendMessage(client, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sleep(100);

      const initialCount = wsServer.getClientCount();
      expect(initialCount).toBeGreaterThan(0);

      // Disconnect
      client.close();
      await sleep(200);

      expect(wsServer.getClientCount()).toBeLessThan(initialCount);

      // Reconnect
      client = await createTestClient(TEST_PORT);
      await sendMessage(client, { type: "auth", data: { token }, timestamp: Date.now() });
      await sendMessage(client, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sleep(100);

      expect(wsServer.getClientCount()).toBeGreaterThanOrEqual(1);

      client.close();
    });

    it("should clean up subscriptions on disconnect", async () => {
      const client = await createTestClient(TEST_PORT);

      await sendMessage(client, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sendMessage(client, { type: "subscribe", channel: "market:ETH/USD", timestamp: Date.now() });
      await sleep(100);

      const statsBefore = wsServer.getStats();
      const channelsBefore = statsBefore.totalChannels;

      client.close();
      await sleep(200);

      const statsAfter = wsServer.getStats();
      expect(statsAfter.totalChannels).toBeLessThanOrEqual(channelsBefore);
    });

    it("should handle rapid connect/disconnect cycles", async () => {
      const clients: WebSocket[] = [];

      // Create 5 connections
      for (let i = 0; i < 5; i++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);
        await sleep(50);
      }

      expect(wsServer.getClientCount()).toBeGreaterThanOrEqual(5);

      // Close all connections
      clients.forEach(client => client.close());
      await sleep(300);

      expect(wsServer.getClientCount()).toBeLessThan(5);

      // Create new connections
      const newClients: WebSocket[] = [];
      for (let i = 0; i < 5; i++) {
        const client = await createTestClient(TEST_PORT);
        newClients.push(client);
        await sleep(50);
      }

      expect(wsServer.getClientCount()).toBeGreaterThanOrEqual(5);

      newClients.forEach(client => client.close());
    });
  });

  describe("Channel Broadcasting", () => {
    it("should broadcast market data to all subscribers", async () => {
      const clients: WebSocket[] = [];
      const receivedData: any[][] = [];

      for (let i = 0; i < 3; i++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);
        receivedData.push([]);

        const index = i;
        client.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "data") {
              receivedData[index].push(msg.data);
            }
          } catch (e) {}
        });

        await sendMessage(client, {
          type: "subscribe",
          channel: "market:BTC/USD",
          timestamp: Date.now()
        });
      }

      await sleep(200);

      // Broadcast market tick
      const marketTick = {
        symbol: "BTC/USD",
        price: 50000,
        volume: 100,
        timestamp: Date.now()
      };

      wsServer.broadcastToChannel("market:BTC/USD", marketTick);
      await sleep(200);

      // All clients should receive the same data
      receivedData.forEach(data => {
        expect(data.length).toBeGreaterThan(0);
        expect(data[0]).toMatchObject({
          symbol: "BTC/USD",
          price: 50000,
          volume: 100
        });
      });

      clients.forEach(client => client.close());
    });

    it("should handle high-frequency broadcasts", async () => {
      const client = await createTestClient(TEST_PORT);
      const receivedMessages: any[] = [];

      client.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "data") {
            receivedMessages.push(msg);
          }
        } catch (e) {}
      });

      await sendMessage(client, {
        type: "subscribe",
        channel: "market:BTC/USD",
        timestamp: Date.now()
      });
      await sleep(100);

      // Send 50 rapid broadcasts
      for (let i = 0; i < 50; i++) {
        wsServer.broadcastToChannel("market:BTC/USD", {
          price: 50000 + i,
          sequence: i,
          timestamp: Date.now()
        });
      }

      await sleep(500);

      // Should receive most or all messages
      expect(receivedMessages.length).toBeGreaterThan(40);

      client.close();
    });

    it("should isolate broadcasts between different channels", async () => {
      const client1 = await createTestClient(TEST_PORT);
      const client2 = await createTestClient(TEST_PORT);

      const messages1: any[] = [];
      const messages2: any[] = [];

      client1.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "data") messages1.push(msg);
        } catch (e) {}
      });

      client2.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "data") messages2.push(msg);
        } catch (e) {}
      });

      await sendMessage(client1, { type: "subscribe", channel: "market:BTC/USD", timestamp: Date.now() });
      await sendMessage(client2, { type: "subscribe", channel: "market:ETH/USD", timestamp: Date.now() });
      await sleep(100);

      // Broadcast to different channels
      wsServer.broadcastToChannel("market:BTC/USD", { symbol: "BTC", price: 50000 });
      wsServer.broadcastToChannel("market:ETH/USD", { symbol: "ETH", price: 3000 });
      await sleep(200);

      // Verify isolation
      expect(messages1.length).toBe(1);
      expect(messages1[0].data.symbol).toBe("BTC");

      expect(messages2.length).toBe(1);
      expect(messages2[0].data.symbol).toBe("ETH");

      client1.close();
      client2.close();
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed JSON messages", async () => {
      const client = await createTestClient(TEST_PORT);

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      client.send("invalid json {{{");
      await sleep(100);

      const errorMessages = messages.filter(m => m.includes("error") || m.includes("ERROR"));
      expect(errorMessages.length).toBeGreaterThan(0);

      client.close();
    });

    it("should handle missing required fields", async () => {
      const client = await createTestClient(TEST_PORT);

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      // Send message without required channel field
      client.send(JSON.stringify({
        type: "subscribe",
        timestamp: Date.now()
      }));
      await sleep(100);

      const errorMessages = messages.filter(m => m.includes("error") || m.includes("ERROR"));
      expect(errorMessages.length).toBeGreaterThan(0);

      client.close();
    });

    it("should handle unauthorized channel access", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      const messages: string[] = [];
      client.on("message", (data) => {
        messages.push(data.toString());
      });

      await sendMessage(client, { type: "auth", data: { token }, timestamp: Date.now() });
      await sleep(100);

      // Try to subscribe to another user's channel
      await sendMessage(client, {
        type: "subscribe",
        channel: "trades:user456",
        timestamp: Date.now()
      });
      await sleep(100);

      const accessDenied = messages.some(m => m.includes("ACCESS_DENIED") || m.includes("Access denied"));
      expect(accessDenied).toBe(true);

      client.close();
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
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId, email: `${userId}@test.com` }, secret, { expiresIn: "1h" });
}

async function sendMessage(client: WebSocket, message: Partial<WebSocketMessage>): Promise<void> {
  client.send(JSON.stringify(message));
  await sleep(10);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
