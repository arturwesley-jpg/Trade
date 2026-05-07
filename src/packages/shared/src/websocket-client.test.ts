import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocketClient } from "./websocket-client";

// Mock WebSocket
class MockWebSocket {
  public readyState = 0;
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((error: any) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public sentMessages: string[] = [];

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError(error: any) {
    if (this.onerror) this.onerror(error);
  }

  static OPEN = 1;
  static CLOSED = 3;
}

// @ts-ignore
global.WebSocket = MockWebSocket;

describe("WebSocketClient", () => {
  let client: WebSocketClient;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Connection", () => {
    it("should connect successfully", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      expect(client.isConnected()).toBe(true);
      expect(client.getState()).toBe("connected");
    });

    it("should authenticate with token on connect", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        token: "test-token",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const ws = (client as any).ws as MockWebSocket;
      const authMessage = ws.sentMessages.find((msg) => {
        const parsed = JSON.parse(msg);
        return parsed.type === "auth";
      });

      expect(authMessage).toBeDefined();
      const parsed = JSON.parse(authMessage!);
      expect(parsed.data.token).toBe("test-token");
    });

    it("should emit connecting and connected events", async () => {
      const connectingHandler = vi.fn();
      const connectedHandler = vi.fn();

      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      client.on("connecting", connectingHandler);
      client.on("connected", connectedHandler);

      const connectPromise = client.connect();
      expect(connectingHandler).toHaveBeenCalled();

      vi.advanceTimersByTime(20);
      await connectPromise;

      expect(connectedHandler).toHaveBeenCalled();
    });

    it("should not connect if already connected", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise1 = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise1;

      const ws1 = (client as any).ws;
      await client.connect();
      const ws2 = (client as any).ws;

      expect(ws1).toBe(ws2);
    });
  });

  describe("Disconnection", () => {
    it("should disconnect cleanly", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const disconnectedHandler = vi.fn();
      client.on("disconnected", disconnectedHandler);

      client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(client.getState()).toBe("disconnected");
      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it("should clear timers on disconnect", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false,
        heartbeatInterval: 1000
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      client.disconnect();

      // Timer should be cleared (undefined or null)
      const heartbeatTimer = (client as any).heartbeatTimer;
      expect(heartbeatTimer === undefined || heartbeatTimer === null).toBe(true);
    });
  });

  describe("Subscriptions", () => {
    it("should subscribe to channel when connected", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const callback = vi.fn();
      client.subscribe("market:BTC/USD", callback);

      const ws = (client as any).ws as MockWebSocket;
      const subMessage = ws.sentMessages.find((msg) => {
        const parsed = JSON.parse(msg);
        return parsed.type === "subscribe" && parsed.channel === "market:BTC/USD";
      });

      expect(subMessage).toBeDefined();
    });

    it("should queue subscriptions when not connected", () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const callback = vi.fn();
      client.subscribe("market:BTC/USD", callback);

      const pendingSubscriptions = (client as any).pendingSubscriptions;
      expect(pendingSubscriptions.has("market:BTC/USD")).toBe(true);
    });

    it("should resubscribe to channels on reconnect", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const callback = vi.fn();
      client.subscribe("market:BTC/USD", callback);

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const ws = (client as any).ws as MockWebSocket;
      const subMessage = ws.sentMessages.find((msg) => {
        const parsed = JSON.parse(msg);
        return parsed.type === "subscribe" && parsed.channel === "market:BTC/USD";
      });

      expect(subMessage).toBeDefined();
    });

    it("should call callback when data received for subscribed channel", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const callback = vi.fn();
      client.subscribe("market:BTC/USD", callback);

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({
        type: "data",
        channel: "market:BTC/USD",
        data: { price: 50000, volume: 1000 }
      });

      expect(callback).toHaveBeenCalledWith({ price: 50000, volume: 1000 });
    });

    it("should support multiple callbacks for same channel", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      client.subscribe("market:BTC/USD", callback1);
      client.subscribe("market:BTC/USD", callback2);

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({
        type: "data",
        channel: "market:BTC/USD",
        data: { price: 50000 }
      });

      expect(callback1).toHaveBeenCalledWith({ price: 50000 });
      expect(callback2).toHaveBeenCalledWith({ price: 50000 });
    });

    it("should unsubscribe specific callback", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      client.subscribe("market:BTC/USD", callback1);
      client.subscribe("market:BTC/USD", callback2);

      client.unsubscribe("market:BTC/USD", callback1);

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({
        type: "data",
        channel: "market:BTC/USD",
        data: { price: 50000 }
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith({ price: 50000 });
    });

    it("should unsubscribe all callbacks for channel", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      client.subscribe("market:BTC/USD", callback1);
      client.subscribe("market:BTC/USD", callback2);

      client.unsubscribe("market:BTC/USD");

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({
        type: "data",
        channel: "market:BTC/USD",
        data: { price: 50000 }
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it("should send unsubscribe message when last callback removed", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const callback = vi.fn();
      client.subscribe("market:BTC/USD", callback);

      const ws = (client as any).ws as MockWebSocket;
      ws.sentMessages = []; // Clear previous messages

      client.unsubscribe("market:BTC/USD", callback);

      const unsubMessage = ws.sentMessages.find((msg) => {
        const parsed = JSON.parse(msg);
        return parsed.type === "unsubscribe" && parsed.channel === "market:BTC/USD";
      });

      expect(unsubMessage).toBeDefined();
    });
  });

  describe("Heartbeat", () => {
    it("should send ping messages at interval", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false,
        heartbeatInterval: 1000
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const ws = (client as any).ws as MockWebSocket;
      ws.sentMessages = []; // Clear previous messages

      vi.advanceTimersByTime(1000);

      const pingMessage = ws.sentMessages.find((msg) => {
        const parsed = JSON.parse(msg);
        return parsed.type === "ping";
      });

      expect(pingMessage).toBeDefined();
    });

    it("should handle pong responses", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({ type: "pong", timestamp: Date.now() });

      // Should not throw or cause errors
      expect(client.isConnected()).toBe(true);
    });
  });

  describe("Auto-reconnect", () => {
    it("should reconnect automatically on disconnect", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: true,
        reconnectInterval: 1000
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const reconnectingHandler = vi.fn();
      client.on("reconnecting", reconnectingHandler);

      const ws = (client as any).ws as MockWebSocket;
      ws.close();

      expect(reconnectingHandler).toHaveBeenCalledWith(1);

      vi.advanceTimersByTime(1020);

      expect(client.isConnected()).toBe(true);
    });

    it("should stop reconnecting after max attempts", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: 3
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const reconnectFailedHandler = vi.fn();
      client.on("reconnect_failed", reconnectFailedHandler);

      // Manually increment reconnect attempts to simulate failures
      (client as any).reconnectAttempts = 3;

      // Trigger disconnect which should emit reconnect_failed
      const ws = (client as any).ws as MockWebSocket;
      ws.close();

      expect(reconnectFailedHandler).toHaveBeenCalled();
    });

    it("should reset reconnect attempts on successful connection", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: true,
        reconnectInterval: 100
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      // Manually set reconnect attempts to simulate previous failures
      (client as any).reconnectAttempts = 5;

      // Disconnect
      const ws1 = (client as any).ws as MockWebSocket;
      ws1.close();

      // Reconnect
      vi.advanceTimersByTime(120);

      // After successful reconnection, attempts should be reset
      expect((client as any).reconnectAttempts).toBe(0);
    });
  });

  describe("Event Handlers", () => {
    it("should emit error events", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const errorHandler = vi.fn();
      client.on("error", errorHandler);

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const ws = (client as any).ws as MockWebSocket;
      const testError = new Error("Test error");
      ws.simulateError(testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
    });

    it("should emit subscribed events", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const subscribedHandler = vi.fn();
      client.on("subscribed", subscribedHandler);

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({
        type: "subscribed",
        channel: "market:BTC/USD"
      });

      expect(subscribedHandler).toHaveBeenCalledWith("market:BTC/USD");
    });

    it("should emit unsubscribed events", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const unsubscribedHandler = vi.fn();
      client.on("unsubscribed", unsubscribedHandler);

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({
        type: "unsubscribed",
        channel: "market:BTC/USD"
      });

      expect(unsubscribedHandler).toHaveBeenCalledWith("market:BTC/USD");
    });

    it("should remove event handlers with off", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const handler = vi.fn();
      client.on("error", handler);
      client.off("error", handler);

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateError(new Error("Test"));

      expect(handler).not.toHaveBeenCalled();
    });

    it("should remove all handlers for event with off", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.on("error", handler1);
      client.on("error", handler2);
      client.off("error");

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateError(new Error("Test"));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("Message Handling", () => {
    it("should handle error messages from server", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const errorHandler = vi.fn();
      client.on("error", errorHandler);

      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({
        type: "error",
        error: "Test error message"
      });

      expect(errorHandler).toHaveBeenCalledWith("Test error message");
    });

    it("should emit generic message event for unknown types", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const messageHandler = vi.fn();
      client.on("message", messageHandler);

      const ws = (client as any).ws as MockWebSocket;
      const customMessage = { type: "custom", data: "test" };
      ws.simulateMessage(customMessage);

      expect(messageHandler).toHaveBeenCalledWith(customMessage);
    });

    it("should handle malformed JSON gracefully", async () => {
      client = new WebSocketClient({
        url: "ws://localhost:3000",
        autoReconnect: false
      });

      const connectPromise = client.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      const errorHandler = vi.fn();
      client.on("error", errorHandler);

      const ws = (client as any).ws as MockWebSocket;
      if (ws.onmessage) {
        ws.onmessage({ data: "invalid json {" });
      }

      expect(errorHandler).toHaveBeenCalled();
    });
  });
});
