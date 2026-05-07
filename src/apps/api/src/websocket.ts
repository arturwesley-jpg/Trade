import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { MarketTick, Position, TradingSignal } from "@trade/shared";
import { logger } from "@trade/shared/logger";
import { metrics } from "@trade/shared";
import { JwtService } from "./auth/jwt-service.js";

export interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "data" | "error" | "ping" | "pong" | "auth" | "subscribed" | "unsubscribed" | "reconnect_token";
  channel?: string;
  data?: unknown;
  timestamp: number;
  id?: string;
  error?: { code: string; message: string };
  reconnectToken?: string;
}

export interface WebSocketServerOptions {
  server: Server;
  path?: string;
  jwtAccessSecret: string;
  maxMessagesPerSecond?: number;
  maxSubscriptions?: number;
  heartbeatIntervalMs?: number;
  reconnectTokenExpiryMs?: number;
  enableBackpressure?: boolean;
  maxQueueSize?: number;
}

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  authenticated: boolean;
  subscriptions: Set<string>;
  messageCount: number;
  lastMessageTime: number;
  connectedAt: number;
  reconnectToken?: string;
  messageQueue: Array<{ data: string; timestamp: number }>;
  queueProcessing: boolean;
  bytesReceived: number;
  bytesSent: number;
  lastActivity: number;
}

interface ChannelThrottle {
  lastBroadcast: number;
  minIntervalMs: number;
  pendingMessage?: { data: unknown; timestamp: number };
}

export class TradingWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, ClientConnection>();
  private channels = new Map<string, Set<WebSocket>>();
  private channelThrottles = new Map<string, ChannelThrottle>();
  private jwtService: JwtService;
  private heartbeatInterval: NodeJS.Timeout;
  private throttleInterval: NodeJS.Timeout;
  private reconnectTokens = new Map<string, { userId: string; subscriptions: string[]; expiresAt: number }>();

  // Configuration
  private readonly MAX_MESSAGES_PER_SECOND: number;
  private readonly MAX_SUBSCRIPTIONS: number;
  private readonly RECONNECT_TOKEN_EXPIRY: number;
  private readonly HEARTBEAT_INTERVAL: number;
  private readonly ENABLE_BACKPRESSURE: boolean;
  private readonly MAX_QUEUE_SIZE: number;

  constructor(options: WebSocketServerOptions) {
    this.jwtService = new JwtService(options.jwtAccessSecret, "dummy-refresh-secret");
    this.MAX_MESSAGES_PER_SECOND = options.maxMessagesPerSecond ?? 100;
    this.MAX_SUBSCRIPTIONS = options.maxSubscriptions ?? 50;
    this.RECONNECT_TOKEN_EXPIRY = options.reconnectTokenExpiryMs ?? 5 * 60 * 1000;
    this.HEARTBEAT_INTERVAL = options.heartbeatIntervalMs ?? 30_000;
    this.ENABLE_BACKPRESSURE = options.enableBackpressure ?? true;
    this.MAX_QUEUE_SIZE = options.maxQueueSize ?? 100;

    this.wss = new WebSocketServer({
      server: options.server,
      path: options.path ?? "/ws",
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });

    this.wss.on("connection", (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // Heartbeat to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
      this.cleanupExpiredReconnectTokens();
    }, this.HEARTBEAT_INTERVAL);

    // Throttle interval for pending messages
    this.throttleInterval = setInterval(() => {
      this.processThrottledMessages();
    }, 100);

    logger.info("WebSocket server initialized");
  }

  private handleConnection(ws: WebSocket) {
    const client: ClientConnection = {
      ws,
      authenticated: false,
      subscriptions: new Set(),
      messageCount: 0,
      lastMessageTime: Date.now(),
      connectedAt: Date.now(),
      messageQueue: [],
      queueProcessing: false,
      bytesReceived: 0,
      bytesSent: 0,
      lastActivity: Date.now()
    };

    this.clients.set(ws, client);
    logger.info({ clientCount: this.clients.size }, "WebSocket client connected");

    // Send connection acknowledgment
    this.sendToClient(ws, {
      type: "data",
      channel: "system",
      data: { message: "Connected to trading WebSocket server. Please authenticate." },
      timestamp: Date.now()
    });

    ws.on("close", () => {
      this.handleDisconnection(ws);
    });

    ws.on("error", (error) => {
      logger.error({ error }, "WebSocket client error");
      this.handleDisconnection(ws);
    });

    ws.on("message", (message) => {
      this.handleMessage(ws, message);
    });

    ws.on("pong", () => {
      // Client is alive
      (ws as any).isAlive = true;
    });
  }

  private handleDisconnection(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Generate reconnection token for authenticated clients
    if (client.authenticated && client.userId) {
      const reconnectToken = this.generateReconnectToken(client.userId, Array.from(client.subscriptions));
      client.reconnectToken = reconnectToken;

      // Try to send reconnect token before closing
      if (ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: "reconnect_token",
          reconnectToken,
          timestamp: Date.now()
        });
      }
    }

    // Unsubscribe from all channels
    client.subscriptions.forEach((channel) => {
      this.unsubscribeFromChannel(ws, channel);
    });

    this.clients.delete(ws);
    logger.info({ clientCount: this.clients.size, userId: client.userId }, "WebSocket client disconnected");
  }

  private handleMessage(ws: WebSocket, rawMessage: Buffer | ArrayBuffer | Buffer[]) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Update activity timestamp
    client.lastActivity = Date.now();
    client.bytesReceived += rawMessage.toString().length;

    // Rate limiting
    const now = Date.now();
    if (now - client.lastMessageTime < 1000) {
      client.messageCount++;
      if (client.messageCount > this.MAX_MESSAGES_PER_SECOND) {
        this.sendError(ws, "RATE_LIMIT", "Too many messages. Please slow down.");
        metrics.increment("websocket.rate_limit_exceeded", { userId: client.userId || "anonymous" });
        return;
      }
    } else {
      client.messageCount = 1;
      client.lastMessageTime = now;
    }

    try {
      const message: WebSocketMessage = JSON.parse(rawMessage.toString());
      metrics.increment("websocket.message_received", { type: message.type });

      switch (message.type) {
        case "auth":
          this.handleAuth(ws, message);
          break;
        case "subscribe":
          this.handleSubscribe(ws, message);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(ws, message);
          break;
        case "ping":
          this.handlePing(ws);
          break;
        case "reconnect_token":
          this.handleReconnectToken(ws, message);
          break;
        default:
          this.sendError(ws, "INVALID_MESSAGE", "Unknown message type");
      }
    } catch (error) {
      logger.error({ error }, "Failed to parse WebSocket message");
      this.sendError(ws, "PARSE_ERROR", "Invalid message format");
    }
  }

  private handleAuth(ws: WebSocket, message: WebSocketMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const token = (message.data as any)?.token;
      if (!token) {
        this.sendError(ws, "AUTH_ERROR", "Token required");
        return;
      }

      const payload = this.jwtService.verifyAccessToken(token);
      client.userId = payload.userId;
      client.authenticated = true;

      this.sendToClient(ws, {
        type: "data",
        channel: "system",
        data: { message: "Authentication successful", userId: payload.userId },
        timestamp: Date.now()
      });

      logger.info({ userId: payload.userId }, "WebSocket client authenticated");
    } catch (error) {
      this.sendError(ws, "AUTH_ERROR", "Invalid token");
      ws.close();
    }
  }

  private handleSubscribe(ws: WebSocket, message: WebSocketMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    if (!client.authenticated) {
      this.sendError(ws, "AUTH_REQUIRED", "Authentication required");
      return;
    }

    if (!message.channel) {
      this.sendError(ws, "INVALID_CHANNEL", "Channel required");
      return;
    }

    // Check subscription limit
    if (client.subscriptions.size >= this.MAX_SUBSCRIPTIONS) {
      this.sendError(ws, "SUBSCRIPTION_LIMIT", "Maximum subscriptions reached");
      return;
    }

    // Validate channel access
    if (!this.canAccessChannel(client, message.channel)) {
      this.sendError(ws, "ACCESS_DENIED", "Access denied to channel");
      return;
    }

    this.subscribeToChannel(ws, message.channel);
    this.sendToClient(ws, {
      type: "subscribed",
      channel: message.channel,
      timestamp: Date.now()
    });

    logger.debug({ userId: client.userId, channel: message.channel }, "Client subscribed to channel");
  }

  private handleUnsubscribe(ws: WebSocket, message: WebSocketMessage) {
    const client = this.clients.get(ws);
    if (!client || !message.channel) return;

    this.unsubscribeFromChannel(ws, message.channel);
    this.sendToClient(ws, {
      type: "unsubscribed",
      channel: message.channel,
      timestamp: Date.now()
    });

    logger.debug({ userId: client.userId, channel: message.channel }, "Client unsubscribed from channel");
  }

  private handlePing(ws: WebSocket) {
    this.sendToClient(ws, {
      type: "pong",
      timestamp: Date.now()
    });
  }

  private canAccessChannel(client: ClientConnection, channel: string): boolean {
    // System channel is public
    if (channel === "system") return true;

    // Market channels are public
    if (channel.startsWith("market:")) return true;
    if (channel.startsWith("market_raw:")) return true;
    if (channel.startsWith("orderbook:")) return true;
    if (channel === "signals") return true;
    if (channel === "providers:status") return true;

    // User-specific channels require matching userId
    if (channel.startsWith("trades:") || channel.startsWith("positions:") || channel.startsWith("notifications:")) {
      const channelUserId = channel.split(":")[1];
      return channelUserId === client.userId;
    }

    // Admin-only channels
    if (channel === "admin" || channel.startsWith("admin:")) {
      // TODO: Check if user has admin role
      return false;
    }

    return false;
  }

  private subscribeToChannel(ws: WebSocket, channel: string) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.subscriptions.add(channel);

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(ws);
  }

  private unsubscribeFromChannel(ws: WebSocket, channel: string) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.subscriptions.delete(channel);

    const channelClients = this.channels.get(channel);
    if (channelClients) {
      channelClients.delete(ws);
      if (channelClients.size === 0) {
        this.channels.delete(channel);
      }
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, code: string, message: string) {
    this.sendToClient(ws, {
      type: "error",
      error: { code, message },
      timestamp: Date.now()
    });
  }

  private heartbeat() {
    this.clients.forEach((client, ws) => {
      if ((ws as any).isAlive === false) {
        logger.warn({ userId: client.userId }, "WebSocket client failed heartbeat");
        ws.terminate();
        return;
      }

      (ws as any).isAlive = false;
      ws.ping();
    });
  }

  // Public API for broadcasting

  broadcastToChannel(channel: string, data: unknown) {
    const clients = this.channels.get(channel);
    if (!clients || clients.size === 0) return;

    const message: WebSocketMessage = {
      type: "data",
      channel,
      data,
      timestamp: Date.now()
    };

    const payload = JSON.stringify(message);
    let sentCount = 0;

    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      logger.debug({ channel, clientCount: sentCount }, "Broadcasted to channel");
    }
  }

  broadcastToUser(userId: string, channel: string, data: unknown) {
    const userChannel = `${channel}:${userId}`;
    this.broadcastToChannel(userChannel, data);
  }

  isClientOnline(userId: string): boolean {
    for (const [ws, client] of this.clients.entries()) {
      if (client.userId === userId && client.authenticated && ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  // Legacy methods for backward compatibility

  broadcast(message: { type: string; data: unknown; timestamp: number }) {
    this.broadcastToChannel("system", message);
  }

  broadcastMarketTick(tick: MarketTick) {
    this.broadcastToChannel(`market:${tick.symbol}`, tick);
  }

  broadcastSignalUpdate(signal: TradingSignal) {
    this.broadcastToChannel("signals", { type: "signal_update", signal });
    this.broadcastToChannel("system", { type: "signal_update", signal });
  }

  broadcastPositionUpdate(position: Position) {
    if (position.userId) {
      this.broadcastToUser(position.userId, "positions", position);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getChannelCount(): number {
    return this.channels.size;
  }

  getStats() {
    const authenticatedCount = Array.from(this.clients.values()).filter((c) => c.authenticated).length;
    const totalSubscriptions = Array.from(this.clients.values()).reduce(
      (sum, c) => sum + c.subscriptions.size,
      0
    );

    return {
      totalClients: this.clients.size,
      authenticatedClients: authenticatedCount,
      totalChannels: this.channels.size,
      totalSubscriptions,
      channelStats: Array.from(this.channels.entries()).map(([channel, clients]) => ({
        channel,
        subscribers: clients.size
      }))
    };
  }

  private generateReconnectToken(userId: string, subscriptions: string[]): string {
    const token = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiresAt = Date.now() + this.RECONNECT_TOKEN_EXPIRY;

    this.reconnectTokens.set(token, {
      userId,
      subscriptions,
      expiresAt
    });

    logger.debug({ userId, token, subscriptions }, "Generated reconnect token");
    return token;
  }

  private handleReconnectToken(ws: WebSocket, message: WebSocketMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    const token = message.reconnectToken;
    if (!token) {
      this.sendError(ws, "INVALID_TOKEN", "Reconnect token is required");
      return;
    }

    const tokenData = this.reconnectTokens.get(token);
    if (!tokenData) {
      this.sendError(ws, "INVALID_TOKEN", "Reconnect token not found or expired");
      return;
    }

    if (tokenData.expiresAt < Date.now()) {
      this.reconnectTokens.delete(token);
      this.sendError(ws, "TOKEN_EXPIRED", "Reconnect token has expired");
      return;
    }

    // Restore session
    client.userId = tokenData.userId;
    client.authenticated = true;

    // Resubscribe to previous channels
    tokenData.subscriptions.forEach((channel) => {
      this.subscribeToChannel(ws, channel);
    });

    // Clean up used token
    this.reconnectTokens.delete(token);

    this.sendToClient(ws, {
      type: "data",
      channel: "system",
      data: {
        message: "Reconnected successfully",
        userId: tokenData.userId,
        subscriptions: tokenData.subscriptions
      },
      timestamp: Date.now()
    });

    logger.info({ userId: tokenData.userId, subscriptions: tokenData.subscriptions }, "Client reconnected with token");
  }

  private cleanupExpiredReconnectTokens() {
    const now = Date.now();
    let cleanedCount = 0;

    this.reconnectTokens.forEach((data, token) => {
      if (data.expiresAt < now) {
        this.reconnectTokens.delete(token);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.debug({ cleanedCount }, "Cleaned up expired reconnect tokens");
    }
  }

  close() {
    clearInterval(this.heartbeatInterval);
    this.clients.forEach((client, ws) => {
      ws.close();
    });
    this.wss.close();
    this.reconnectTokens.clear();
    logger.info("WebSocket server closed");
  }
}
