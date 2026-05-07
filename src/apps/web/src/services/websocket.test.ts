import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketDataWebSocket } from "./websocket.js";

// Mock WebSocket class
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event("open"));
    }, 0);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      const closeEvent = {
        code: 1000,
        reason: "Normal closure",
        wasClean: true
      } as CloseEvent;
      this.onclose?.(closeEvent);
    }, 0);
  }
}

describe("MarketDataWebSocket", () => {
  let ws: MarketDataWebSocket;
  let onCandleMock: ReturnType<typeof vi.fn>;
  let onErrorMock: ReturnType<typeof vi.fn>;
  let onStateChangeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCandleMock = vi.fn();
    onErrorMock = vi.fn();
    onStateChangeMock = vi.fn();

    // Mock WebSocket constructor
    global.WebSocket = MockWebSocket as any;

    ws = new MarketDataWebSocket({
      url: "ws://localhost:3000/market-data",
      onCandle: onCandleMock,
      onError: onErrorMock,
      onStateChange: onStateChangeMock
    });
  });

  afterEach(() => {
    ws.disconnect();
    vi.clearAllMocks();
  });

  it("should initialize with correct options", () => {
    expect(ws).toBeDefined();
  });

  it("should connect to WebSocket server", async () => {
    ws.connect();

    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onStateChangeMock).toHaveBeenCalledWith("connecting");
    expect(onStateChangeMock).toHaveBeenCalledWith("connected");
  });

  it("should handle incoming candle messages", async () => {
    ws.connect();

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate incoming message
    const mockCandle = {
      symbol: "BTCUSDT",
      open: 50000,
      high: 51000,
      low: 49000,
      close: 50500,
      volume: 100,
      timestamp: Date.now()
    };

    const mockWs = (ws as any).ws as MockWebSocket;
    mockWs.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ type: "candle", data: mockCandle })
      })
    );

    expect(onCandleMock).toHaveBeenCalledWith(mockCandle);
  });

  it("should handle parse errors", async () => {
    ws.connect();

    await new Promise((resolve) => setTimeout(resolve, 10));

    const mockWs = (ws as any).ws as MockWebSocket;
    mockWs.onmessage?.(
      new MessageEvent("message", {
        data: "invalid json"
      })
    );

    expect(onErrorMock).toHaveBeenCalled();
  });

  it("should disconnect cleanly", async () => {
    ws.connect();

    await new Promise((resolve) => setTimeout(resolve, 10));

    ws.disconnect();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onStateChangeMock).toHaveBeenCalledWith("disconnected");
  });

  it("should provide connect and disconnect methods", () => {
    expect(typeof ws.connect).toBe("function");
    expect(typeof ws.disconnect).toBe("function");
  });
});
