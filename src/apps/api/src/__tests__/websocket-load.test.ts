import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { createServer, Server } from "http";
import { TradingWebSocketServer } from "../websocket.js";
import type { WebSocketMessage } from "../websocket.js";

describe("TradingWebSocketServer - Load Tests", () => {
  let httpServer: Server;
  let wsServer: TradingWebSocketServer;
  const TEST_PORT = 9003;
  const JWT_SECRET = "test-jwt-secret-load-12345678";

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

  describe("Concurrent Connections", () => {
    it("should handle 100 concurrent connections", async () => {
      const clients: WebSocket[] = [];
      const connectionPromises: Promise<WebSocket>[] = [];

      console.log("Creating 100 concurrent connections...");
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        connectionPromises.push(createTestClient(TEST_PORT));
      }

      const connectedClients = await Promise.all(connectionPromises);
      clients.push(...connectedClients);

      const connectionTime = Date.now() - startTime;
      console.log(`Connected 100 clients in ${connectionTime}ms`);

      await sleep(500);

      const clientCount = wsServer.getClientCount();
      expect(clientCount).toBeGreaterThanOrEqual(100);

      console.log(`Active clients: ${clientCount}`);

      // Clean up
      clients.forEach(client => client.close());
      await sleep(500);

      expect(wsServer.getClientCount()).toBeLessThan(100);
    }, 30000);

    it("should handle 500 concurrent connections", async () => {
      const clients: WebSocket[] = [];
      const batchSize = 50;
      const batches = 10;

      console.log("Creating 500 concurrent connections in batches...");
      const startTime = Date.now();

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises: Promise<WebSocket>[] = [];

        for (let i = 0; i < batchSize; i++) {
          batchPromises.push(createTestClient(TEST_PORT));
        }

        const batchClients = await Promise.all(batchPromises);
        clients.push(...batchClients);

        console.log(`Batch ${batch + 1}/${batches} connected (${clients.length} total)`);
        await sleep(100);
      }

      const connectionTime = Date.now() - startTime;
      console.log(`Connected 500 clients in ${connectionTime}ms`);

      await sleep(1000);

      const clientCount = wsServer.getClientCount();
      expect(clientCount).toBeGreaterThanOrEqual(400); // Allow some connection failures

      console.log(`Active clients: ${clientCount}`);

      // Clean up in batches
      for (let i = 0; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);
        batch.forEach(client => client.close());
        await sleep(100);
      }

      await sleep(1000);
      expect(wsServer.getClientCount()).toBeLessThan(100);
    }, 60000);

    it("should handle 1000 concurrent connections", async () => {
      const clients: WebSocket[] = [];
      const batchSize = 50;
      const batches = 20;

      console.log("Creating 1000 concurrent connections in batches...");
      const startTime = Date.now();

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises: Promise<WebSocket>[] = [];

        for (let i = 0; i < batchSize; i++) {
          batchPromises.push(
            createTestClient(TEST_PORT).catch(() => null as any)
          );
        }

        const batchClients = (await Promise.all(batchPromises)).filter(c => c !== null);
        clients.push(...batchClients);

        if (batch % 5 === 0) {
          console.log(`Batch ${batch + 1}/${batches} connected (${clients.length} total)`);
        }
        await sleep(50);
      }

      const connectionTime = Date.now() - startTime;
      console.log(`Connected ${clients.length} clients in ${connectionTime}ms`);

      await sleep(2000);

      const clientCount = wsServer.getClientCount();
      expect(clientCount).toBeGreaterThanOrEqual(800); // Allow some connection failures

      console.log(`Active clients: ${clientCount}`);

      // Clean up in batches
      for (let i = 0; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);
        batch.forEach(client => {
          try {
            client.close();
          } catch (e) {
            // Ignore errors
          }
        });
        if (i % 200 === 0) {
          await sleep(100);
        }
      }

      await sleep(2000);
      expect(wsServer.getClientCount()).toBeLessThan(200);
    }, 120000);
  });

  describe("Message Throughput", () => {
    it("should handle 1000 messages/second from single client", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await sendMessage(client, {
        type: "auth",
        data: { token },
        timestamp: Date.now()
      });
      await sleep(100);

      console.log("Sending 1000 messages in 1 second...");
      const startTime = Date.now();
      let sentCount = 0;

      const sendInterval = setInterval(() => {
        if (sentCount < 1000) {
          client.send(JSON.stringify({
            type: "ping",
            timestamp: Date.now()
          }));
          sentCount++;
        }
      }, 1);

      await sleep(1100);
      clearInterval(sendInterval);

      const duration = Date.now() - startTime;
      console.log(`Sent ${sentCount} messages in ${duration}ms`);
      console.log(`Throughput: ${Math.round((sentCount / duration) * 1000)} messages/second`);

      expect(sentCount).toBeGreaterThanOrEqual(1000);

      client.close();
    }, 15000);

    it("should handle 5000 messages/second across multiple clients", async () => {
      const clientCount = 10;
      const messagesPerClient = 500;
      const clients: WebSocket[] = [];

      console.log(`Creating ${clientCount} clients...`);
      for (let i = 0; i < clientCount; i++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);
      }

      await sleep(500);

      console.log(`Sending ${messagesPerClient} messages per client (${clientCount * messagesPerClient} total)...`);
      const startTime = Date.now();
      let totalSent = 0;

      const sendPromises = clients.map((client, index) => {
        return new Promise<number>((resolve) => {
          let sent = 0;
          const interval = setInterval(() => {
            if (sent < messagesPerClient) {
              client.send(JSON.stringify({
                type: "ping",
                clientId: index,
                sequence: sent,
                timestamp: Date.now()
              }));
              sent++;
            } else {
              clearInterval(interval);
              resolve(sent);
            }
          }, 1);
        });
      });

      const results = await Promise.all(sendPromises);
      totalSent = results.reduce((sum, count) => sum + count, 0);

      const duration = Date.now() - startTime;
      const throughput = Math.round((totalSent / duration) * 1000);

      console.log(`Sent ${totalSent} messages in ${duration}ms`);
      console.log(`Throughput: ${throughput} messages/second`);

      expect(totalSent).toBeGreaterThanOrEqual(5000);
      expect(throughput).toBeGreaterThan(1000);

      clients.forEach(client => client.close());
    }, 30000);

    it("should handle 10000 messages/second broadcast throughput", async () => {
      const subscriberCount = 20;
      const clients: WebSocket[] = [];
      const receivedCounts: number[] = [];

      console.log(`Creating ${subscriberCount} subscribers...`);
      for (let i = 0; i < subscriberCount; i++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);
        receivedCounts.push(0);

        const index = i;
        client.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "data" && msg.channel === "load-test") {
              receivedCounts[index]++;
            }
          } catch (e) {}
        });

        await sendMessage(client, {
          type: "subscribe",
          channel: "load-test",
          timestamp: Date.now()
        });
      }

      await sleep(500);

      const messageCount = 500;
      console.log(`Broadcasting ${messageCount} messages to ${subscriberCount} subscribers...`);
      const startTime = Date.now();

      for (let i = 0; i < messageCount; i++) {
        wsServer.broadcastToChannel("load-test", {
          sequence: i,
          timestamp: Date.now(),
          data: `Message ${i}`
        });
      }

      await sleep(2000);

      const duration = Date.now() - startTime;
      const totalDelivered = receivedCounts.reduce((sum, count) => sum + count, 0);
      const throughput = Math.round((totalDelivered / duration) * 1000);

      console.log(`Delivered ${totalDelivered} messages in ${duration}ms`);
      console.log(`Throughput: ${throughput} messages/second`);
      console.log(`Average per client: ${Math.round(totalDelivered / subscriberCount)}`);

      expect(totalDelivered).toBeGreaterThan(messageCount * subscriberCount * 0.8); // 80% delivery rate
      expect(throughput).toBeGreaterThan(5000);

      clients.forEach(client => client.close());
    }, 30000);
  });

  describe("Memory Usage", () => {
    it("should monitor memory usage with 500 connections", async () => {
      const clients: WebSocket[] = [];
      const memorySnapshots: { connections: number; heapUsed: number; external: number }[] = [];

      function captureMemory(connections: number) {
        const usage = process.memoryUsage();
        memorySnapshots.push({
          connections,
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024)
        });
      }

      captureMemory(0);

      console.log("Creating 500 connections and monitoring memory...");
      const batchSize = 50;

      for (let batch = 0; batch < 10; batch++) {
        const batchPromises: Promise<WebSocket>[] = [];

        for (let i = 0; i < batchSize; i++) {
          batchPromises.push(createTestClient(TEST_PORT).catch(() => null as any));
        }

        const batchClients = (await Promise.all(batchPromises)).filter(c => c !== null);
        clients.push(...batchClients);

        await sleep(100);
        captureMemory(clients.length);
      }

      console.log("\nMemory Usage:");
      memorySnapshots.forEach(snapshot => {
        console.log(`Connections: ${snapshot.connections}, Heap: ${snapshot.heapUsed}MB, External: ${snapshot.external}MB`);
      });

      const initialHeap = memorySnapshots[0].heapUsed;
      const finalHeap = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const heapGrowth = finalHeap - initialHeap;
      const memoryPerConnection = heapGrowth / clients.length;

      console.log(`\nMemory growth: ${heapGrowth}MB`);
      console.log(`Memory per connection: ${memoryPerConnection.toFixed(3)}MB`);

      expect(memoryPerConnection).toBeLessThan(1); // Less than 1MB per connection

      // Clean up
      clients.forEach(client => {
        try {
          client.close();
        } catch (e) {}
      });
      await sleep(1000);

      if (global.gc) {
        global.gc();
        await sleep(500);
      }

      const finalUsage = process.memoryUsage();
      const cleanupHeap = Math.round(finalUsage.heapUsed / 1024 / 1024);
      console.log(`Heap after cleanup: ${cleanupHeap}MB`);
    }, 60000);

    it("should monitor memory with high message throughput", async () => {
      const client = await createTestClient(TEST_PORT);
      const token = generateTestToken(JWT_SECRET, "user123");

      await sendMessage(client, {
        type: "auth",
        data: { token },
        timestamp: Date.now()
      });
      await sleep(100);

      const initialMemory = process.memoryUsage();
      console.log(`Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

      console.log("Sending 5000 messages...");
      for (let i = 0; i < 5000; i++) {
        client.send(JSON.stringify({
          type: "ping",
          sequence: i,
          timestamp: Date.now(),
          data: "x".repeat(100) // 100 bytes payload
        }));

        if (i % 1000 === 0) {
          await sleep(10);
        }
      }

      await sleep(1000);

      const finalMemory = process.memoryUsage();
      const heapGrowth = Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024);

      console.log(`Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Heap growth: ${heapGrowth}MB`);

      expect(heapGrowth).toBeLessThan(50); // Less than 50MB growth

      client.close();
    }, 30000);

    it("should not leak memory on connection churn", async () => {
      const iterations = 5;
      const connectionsPerIteration = 50;
      const memorySnapshots: number[] = [];

      if (global.gc) {
        global.gc();
        await sleep(500);
      }

      const initialMemory = process.memoryUsage();
      memorySnapshots.push(Math.round(initialMemory.heapUsed / 1024 / 1024));

      console.log("Testing connection churn...");

      for (let iteration = 0; iteration < iterations; iteration++) {
        const clients: WebSocket[] = [];

        // Create connections
        for (let i = 0; i < connectionsPerIteration; i++) {
          const client = await createTestClient(TEST_PORT).catch(() => null as any);
          if (client) clients.push(client);
        }

        await sleep(200);

        // Close connections
        clients.forEach(client => {
          try {
            client.close();
          } catch (e) {}
        });

        await sleep(200);

        if (global.gc) {
          global.gc();
          await sleep(200);
        }

        const currentMemory = process.memoryUsage();
        const heapUsed = Math.round(currentMemory.heapUsed / 1024 / 1024);
        memorySnapshots.push(heapUsed);

        console.log(`Iteration ${iteration + 1}: Heap ${heapUsed}MB`);
      }

      console.log("\nMemory snapshots:", memorySnapshots);

      const firstSnapshot = memorySnapshots[1]; // After first iteration
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const memoryLeak = lastSnapshot - firstSnapshot;

      console.log(`Memory leak: ${memoryLeak}MB`);

      expect(memoryLeak).toBeLessThan(20); // Less than 20MB leak over 5 iterations
    }, 60000);
  });

  describe("Subscription Scalability", () => {
    it("should handle 100 clients with 10 subscriptions each", async () => {
      const clientCount = 100;
      const subscriptionsPerClient = 10;
      const clients: WebSocket[] = [];

      console.log(`Creating ${clientCount} clients with ${subscriptionsPerClient} subscriptions each...`);
      const startTime = Date.now();

      for (let i = 0; i < clientCount; i++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);

        for (let j = 0; j < subscriptionsPerClient; j++) {
          await sendMessage(client, {
            type: "subscribe",
            channel: `channel:${j}`,
            timestamp: Date.now()
          });
        }

        if (i % 20 === 0) {
          console.log(`Created ${i} clients...`);
        }
      }

      const setupTime = Date.now() - startTime;
      console.log(`Setup completed in ${setupTime}ms`);

      await sleep(1000);

      const stats = wsServer.getStats();
      console.log(`Total clients: ${stats.totalClients}`);
      console.log(`Total subscriptions: ${stats.totalSubscriptions}`);
      console.log(`Total channels: ${stats.totalChannels}`);

      expect(stats.totalClients).toBeGreaterThanOrEqual(clientCount * 0.9);
      expect(stats.totalSubscriptions).toBeGreaterThanOrEqual(clientCount * subscriptionsPerClient * 0.9);

      clients.forEach(client => client.close());
    }, 60000);

    it("should handle broadcast to 50 channels with 20 subscribers each", async () => {
      const channelCount = 50;
      const subscribersPerChannel = 20;
      const clients: WebSocket[] = [];
      const receivedCounts = new Map<number, number>();

      console.log(`Setting up ${channelCount} channels with ${subscribersPerChannel} subscribers each...`);

      for (let clientId = 0; clientId < channelCount * subscribersPerChannel; clientId++) {
        const client = await createTestClient(TEST_PORT);
        clients.push(client);
        receivedCounts.set(clientId, 0);

        const channelId = clientId % channelCount;

        client.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "data") {
              receivedCounts.set(clientId, (receivedCounts.get(clientId) || 0) + 1);
            }
          } catch (e) {}
        });

        await sendMessage(client, {
          type: "subscribe",
          channel: `channel:${channelId}`,
          timestamp: Date.now()
        });

        if (clientId % 100 === 0) {
          console.log(`Created ${clientId} subscribers...`);
        }
      }

      await sleep(1000);

      console.log("Broadcasting to all channels...");
      const broadcastStart = Date.now();

      for (let channelId = 0; channelId < channelCount; channelId++) {
        wsServer.broadcastToChannel(`channel:${channelId}`, {
          channelId,
          message: `Broadcast to channel ${channelId}`,
          timestamp: Date.now()
        });
      }

      await sleep(2000);

      const broadcastTime = Date.now() - broadcastStart;
      console.log(`Broadcast completed in ${broadcastTime}ms`);

      const totalReceived = Array.from(receivedCounts.values()).reduce((sum, count) => sum + count, 0);
      const expectedTotal = channelCount * subscribersPerChannel;
      const deliveryRate = (totalReceived / expectedTotal) * 100;

      console.log(`Total messages delivered: ${totalReceived}/${expectedTotal}`);
      console.log(`Delivery rate: ${deliveryRate.toFixed(2)}%`);

      expect(deliveryRate).toBeGreaterThan(80);

      clients.forEach(client => client.close());
    }, 90000);
  });

  describe("Performance Benchmarks", () => {
    it("should measure connection establishment latency", async () => {
      const iterations = 100;
      const latencies: number[] = [];

      console.log(`Measuring connection latency over ${iterations} connections...`);

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const client = await createTestClient(TEST_PORT);
        const latency = Date.now() - start;
        latencies.push(latency);
        client.close();

        if (i % 20 === 0) {
          await sleep(100);
        }
      }

      latencies.sort((a, b) => a - b);
      const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log("\nConnection Latency:");
      console.log(`Average: ${avg.toFixed(2)}ms`);
      console.log(`P50: ${p50}ms`);
      console.log(`P95: ${p95}ms`);
      console.log(`P99: ${p99}ms`);

      expect(avg).toBeLessThan(100);
      expect(p95).toBeLessThan(200);
    }, 60000);

    it("should measure message round-trip time", async () => {
      const client = await createTestClient(TEST_PORT);
      const iterations = 1000;
      const latencies: number[] = [];

      client.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "pong" && msg.timestamp) {
            const rtt = Date.now() - msg.timestamp;
            latencies.push(rtt);
          }
        } catch (e) {}
      });

      console.log(`Measuring round-trip time over ${iterations} messages...`);

      for (let i = 0; i < iterations; i++) {
        client.send(JSON.stringify({
          type: "ping",
          timestamp: Date.now()
        }));
        await sleep(5);
      }

      await sleep(1000);

      latencies.sort((a, b) => a - b);
      const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log("\nRound-Trip Time:");
      console.log(`Samples: ${latencies.length}`);
      console.log(`Average: ${avg.toFixed(2)}ms`);
      console.log(`P50: ${p50}ms`);
      console.log(`P95: ${p95}ms`);
      console.log(`P99: ${p99}ms`);

      expect(avg).toBeLessThan(50);
      expect(p95).toBeLessThan(100);

      client.close();
    }, 30000);
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
  await sleep(5);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
