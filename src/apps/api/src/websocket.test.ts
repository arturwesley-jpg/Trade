import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import WebSocket from "ws";
import { TradingWebSocketServer } from "./websocket";
import { JwtService } from "./services/jwt";

describe("TradingWebSocketServer", () => {
  let server: TradingWebSocketServer;
  let jwtService: JwtService;
  let mockWss: any;

  beforeEach(() => {
    jwtService = new JwtService("test-secret", "test-refresh-secret");
    mockWss = {
      on: vi.fn(),
      clients: new Set()
    };
    server = new TradingWebSocketServer(mockWss, jwtService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should authenticate client with valid token", () => {
      const mockWs = createMockWebSocket();
      const token = jwtService.generateAccessToken("user123");

      server["handleAuth"](mockWs as any, {
        type: "auth",
        data: { token },
        timestamp: Date.now()
      });

      const client = server["clients"].get(mockWs as any);
      expect(client?.authenticated).toBe(true);
      expect(client?.userId).toBe("user123");
    });

    it("should reject client with invalid token", () => {
      const mockWs = createMockWebSocket();

      server["handleAuth"](mockWs as any, {
        type: "auth",
        data: { token: "invalid-token" },
        timestamp: Date.now()
      });

      const client = server["clients"].get(mockWs as any);
      expect(client?.authenticated).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Authentication failed")
      );
    });

    it("should reject client with missing token", () => {
      const mockWs = createMockWebSocket();

      server["handleAuth"](mockWs as any, {
        type: "auth",
        data: {},
        timestamp: Date.now()
      });

      const client = server["clients"].get(mockWs as any);
      expect(client?.authenticated).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Token required")
      );
    });
  });

  describe("Subscription Management", () => {
    it("should allow subscription to public channels", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: false,
        userId: null,
        subscriptions: new Set<string>(),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      server["handleSubscribe"](mockWs as any, {
        type: "subscribe",
        channel: "market:BTC/USD",
        timestamp: Date.now()
      });

      expect(client.subscriptions.has("market:BTC/USD")).toBe(true);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("subscribed")
      );
    });

    it("should allow authenticated user to subscribe to their own channels", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: true,
        userId: "user123",
        subscriptions: new Set<string>(),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      server["handleSubscribe"](mockWs as any, {
        type: "subscribe",
        channel: "trades:user123",
        timestamp: Date.now()
      });

      expect(client.subscriptions.has("trades:user123")).toBe(true);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("subscribed")
      );
    });

    it("should reject subscription to other user's channels", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: true,
        userId: "user123",
        subscriptions: new Set<string>(),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      server["handleSubscribe"](mockWs as any, {
        type: "subscribe",
        channel: "trades:user456",
        timestamp: Date.now()
      });

      expect(client.subscriptions.has("trades:user456")).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Access denied")
      );
    });

    it("should enforce max subscriptions limit", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: false,
        userId: null,
        subscriptions: new Set<string>(),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      // Add 50 subscriptions (the limit)
      for (let i = 0; i < 50; i++) {
        client.subscriptions.add(`market:PAIR${i}`);
      }

      server["handleSubscribe"](mockWs as any, {
        type: "subscribe",
        channel: "market:BTC/USD",
        timestamp: Date.now()
      });

      expect(client.subscriptions.has("market:BTC/USD")).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Maximum subscriptions reached")
      );
    });

    it("should unsubscribe from channel", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: false,
        userId: null,
        subscriptions: new Set(["market:BTC/USD"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      server["handleUnsubscribe"](mockWs as any, {
        type: "unsubscribe",
        channel: "market:BTC/USD",
        timestamp: Date.now()
      });

      expect(client.subscriptions.has("market:BTC/USD")).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("unsubscribed")
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce message rate limit", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: false,
        userId: null,
        subscriptions: new Set<string>(),
        messageCount: 100,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      const result = server["checkRateLimit"](client);

      expect(result).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit exceeded")
      );
    });

    it("should reset message count after 1 second", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: false,
        userId: null,
        subscriptions: new Set<string>(),
        messageCount: 100,
        lastMessageTime: Date.now() - 1100,
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      const result = server["checkRateLimit"](client);

      expect(result).toBe(true);
      expect(client.messageCount).toBe(1);
    });
  });

  describe("Broadcasting", () => {
    it("should broadcast to all clients in channel", () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();
      const mockWs3 = createMockWebSocket();

      const client1 = {
        ws: mockWs1,
        authenticated: false,
        userId: null,
        subscriptions: new Set(["market:BTC/USD"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };

      const client2 = {
        ws: mockWs2,
        authenticated: false,
        userId: null,
        subscriptions: new Set(["market:BTC/USD"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };

      const client3 = {
        ws: mockWs3,
        authenticated: false,
        userId: null,
        subscriptions: new Set(["market:ETH/USD"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };

      server["clients"].set(mockWs1 as any, client1);
      server["clients"].set(mockWs2 as any, client2);
      server["clients"].set(mockWs3 as any, client3);

      server["channels"].set("market:BTC/USD", new Set([mockWs1 as any, mockWs2 as any]));
      server["channels"].set("market:ETH/USD", new Set([mockWs3 as any]));

      const testData = { price: 50000, volume: 1000 };
      server.broadcastToChannel("market:BTC/USD", testData);

      expect(mockWs1.send).toHaveBeenCalledWith(
        expect.stringContaining("market:BTC/USD")
      );
      expect(mockWs2.send).toHaveBeenCalledWith(
        expect.stringContaining("market:BTC/USD")
      );
      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it("should broadcast to specific user", () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();

      const client1 = {
        ws: mockWs1,
        authenticated: true,
        userId: "user123",
        subscriptions: new Set(["notifications:user123"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };

      const client2 = {
        ws: mockWs2,
        authenticated: true,
        userId: "user456",
        subscriptions: new Set(["notifications:user456"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };

      server["clients"].set(mockWs1 as any, client1);
      server["clients"].set(mockWs2 as any, client2);

      server["channels"].set("notifications:user123", new Set([mockWs1 as any]));
      server["channels"].set("notifications:user456", new Set([mockWs2 as any]));

      const testData = { message: "Test notification" };
      server.broadcastToUser("user123", testData);

      expect(mockWs1.send).toHaveBeenCalledWith(
        expect.stringContaining("notifications:user123")
      );
      expect(mockWs2.send).not.toHaveBeenCalled();
    });
  });

  describe("Heartbeat", () => {
    it("should respond to ping with pong", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: false,
        userId: null,
        subscriptions: new Set<string>(),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);

      server["handlePing"](mockWs as any, {
        type: "ping",
        timestamp: Date.now()
      });

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("pong")
      );
    });

    it("should disconnect clients with stale heartbeat", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: false,
        userId: null,
        subscriptions: new Set<string>(),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now() - 61000 // 61 seconds ago
      };
      server["clients"].set(mockWs as any, client);

      server["checkHeartbeats"]();

      expect(mockWs.close).toHaveBeenCalled();
    });
  });

  describe("Connection Management", () => {
    it("should clean up client on disconnect", () => {
      const mockWs = createMockWebSocket();
      const client = {
        ws: mockWs,
        authenticated: true,
        userId: "user123",
        subscriptions: new Set(["market:BTC/USD", "trades:user123"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      };
      server["clients"].set(mockWs as any, client);
      server["channels"].set("market:BTC/USD", new Set([mockWs as any]));
      server["channels"].set("trades:user123", new Set([mockWs as any]));

      server["handleDisconnect"](mockWs as any);

      expect(server["clients"].has(mockWs as any)).toBe(false);
      expect(server["channels"].get("market:BTC/USD")?.has(mockWs as any)).toBe(false);
      expect(server["channels"].get("trades:user123")?.has(mockWs as any)).toBe(false);
    });

    it("should return connection statistics", () => {
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();

      server["clients"].set(mockWs1 as any, {
        ws: mockWs1,
        authenticated: true,
        userId: "user123",
        subscriptions: new Set(["market:BTC/USD"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      });

      server["clients"].set(mockWs2 as any, {
        ws: mockWs2,
        authenticated: false,
        userId: null,
        subscriptions: new Set(["market:ETH/USD"]),
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastHeartbeat: Date.now()
      });

      server["channels"].set("market:BTC/USD", new Set([mockWs1 as any]));
      server["channels"].set("market:ETH/USD", new Set([mockWs2 as any]));

      const stats = server.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.authenticatedConnections).toBe(1);
      expect(stats.totalChannels).toBe(2);
      expect(stats.channels).toEqual({
        "market:BTC/USD": 1,
        "market:ETH/USD": 1
      });
    });
  });
});

function createMockWebSocket() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: WebSocket.OPEN,
    on: vi.fn(),
    off: vi.fn()
  };
}
