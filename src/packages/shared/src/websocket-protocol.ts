/**
 * WebSocket Protocol Type Definitions
 *
 * This file defines the complete WebSocket message protocol used by the trading platform.
 * All messages follow a consistent structure with type discrimination for type safety.
 */

import type { MarketTick, Position, TradingSignal } from "./types.js";

/**
 * Base message type that all WebSocket messages extend
 */
export interface BaseWebSocketMessage {
  timestamp: number;
  id?: string;
}

/**
 * Authentication message - sent by client to authenticate with JWT token
 */
export interface AuthMessage extends BaseWebSocketMessage {
  type: "auth";
  data: {
    token: string;
  };
}

/**
 * Subscribe message - sent by client to subscribe to a channel
 */
export interface SubscribeMessage extends BaseWebSocketMessage {
  type: "subscribe";
  channel: string;
}

/**
 * Unsubscribe message - sent by client to unsubscribe from a channel
 */
export interface UnsubscribeMessage extends BaseWebSocketMessage {
  type: "unsubscribe";
  channel: string;
}

/**
 * Ping message - sent by client to check connection health
 */
export interface PingMessage extends BaseWebSocketMessage {
  type: "ping";
}

/**
 * Pong message - sent by server in response to ping
 */
export interface PongMessage extends BaseWebSocketMessage {
  type: "pong";
}

/**
 * Data message - sent by server with channel data
 */
export interface DataMessage extends BaseWebSocketMessage {
  type: "data";
  channel?: string;
  data: unknown;
}

/**
 * Subscribed confirmation - sent by server when subscription succeeds
 */
export interface SubscribedMessage extends BaseWebSocketMessage {
  type: "subscribed";
  channel: string;
}

/**
 * Unsubscribed confirmation - sent by server when unsubscription succeeds
 */
export interface UnsubscribedMessage extends BaseWebSocketMessage {
  type: "unsubscribed";
  channel: string;
}

/**
 * Error message - sent by server when an error occurs
 */
export interface ErrorMessage extends BaseWebSocketMessage {
  type: "error";
  error: {
    code: string;
    message: string;
  };
}

/**
 * Reconnect token message - sent by server before disconnect to allow seamless reconnection
 */
export interface ReconnectTokenMessage extends BaseWebSocketMessage {
  type: "reconnect_token";
  reconnectToken: string;
}

/**
 * Union type of all possible WebSocket messages
 */
export type WebSocketMessage =
  | AuthMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage
  | PongMessage
  | DataMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | ErrorMessage
  | ReconnectTokenMessage;

/**
 * Client-to-server messages (messages that clients can send)
 */
export type ClientMessage = AuthMessage | SubscribeMessage | UnsubscribeMessage | PingMessage;

/**
 * Server-to-client messages (messages that server can send)
 */
export type ServerMessage =
  | PongMessage
  | DataMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | ErrorMessage
  | ReconnectTokenMessage;

/**
 * Channel types supported by the WebSocket server
 */
export type ChannelType =
  | "system"
  | `market:${string}`
  | `orderbook:${string}`
  | `trades:${string}`
  | `positions:${string}`
  | `notifications:${string}`
  | `admin:${string}`
  | "admin";

/**
 * Typed data payloads for specific channels
 */
export interface ChannelDataMap {
  system: {
    message: string;
    userId?: string;
  };
  market: MarketTick;
  positions: Position;
  signal_update: {
    type: "signal_update";
    signal: TradingSignal;
  };
}

/**
 * Error codes that can be returned by the WebSocket server
 */
export type WebSocketErrorCode =
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "AUTH_REQUIRED"
  | "INVALID_CHANNEL"
  | "SUBSCRIPTION_LIMIT"
  | "ACCESS_DENIED"
  | "INVALID_MESSAGE"
  | "PARSE_ERROR";

/**
 * WebSocket connection states
 */
export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "disconnecting"
  | "reconnecting"
  | "error";

/**
 * WebSocket client events that can be listened to
 */
export interface WebSocketClientEvents {
  connecting: () => void;
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number) => void;
  reconnect_failed: () => void;
  error: (error: unknown) => void;
  subscribed: (channel: string) => void;
  unsubscribed: (channel: string) => void;
  data: (payload: { channel?: string; data: unknown }) => void;
  message: (message: ServerMessage) => void;
}

/**
 * Type guard to check if a message is a specific type
 */
export function isMessageType<T extends WebSocketMessage["type"]>(
  message: WebSocketMessage,
  type: T
): message is Extract<WebSocketMessage, { type: T }> {
  return message.type === type;
}

/**
 * Type guard to check if a channel is a market channel
 */
export function isMarketChannel(channel: string): channel is `market:${string}` {
  return channel.startsWith("market:");
}

/**
 * Type guard to check if a channel is a user-specific channel
 */
export function isUserChannel(
  channel: string
): channel is `trades:${string}` | `positions:${string}` | `notifications:${string}` {
  return (
    channel.startsWith("trades:") ||
    channel.startsWith("positions:") ||
    channel.startsWith("notifications:")
  );
}

/**
 * Extract symbol from market channel
 */
export function extractSymbolFromMarketChannel(channel: `market:${string}`): string {
  return channel.replace("market:", "");
}

/**
 * Extract userId from user channel
 */
export function extractUserIdFromChannel(
  channel: `trades:${string}` | `positions:${string}` | `notifications:${string}`
): string {
  return channel.split(":")[1];
}

/**
 * Create a market channel name
 */
export function createMarketChannel(symbol: string): `market:${string}` {
  return `market:${symbol}`;
}

/**
 * Create a positions channel name for a user
 */
export function createPositionsChannel(userId: string): `positions:${string}` {
  return `positions:${userId}`;
}

/**
 * Create a trades channel name for a user
 */
export function createTradesChannel(userId: string): `trades:${string}` {
  return `trades:${userId}`;
}

/**
 * Create a notifications channel name for a user
 */
export function createNotificationsChannel(userId: string): `notifications:${string}` {
  return `notifications:${userId}`;
}
