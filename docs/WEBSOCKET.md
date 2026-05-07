# WebSocket Real-Time System Documentation

## Overview

The WebSocket real-time system provides bidirectional communication between the trading platform and clients, enabling real-time market data streaming, trading event notifications, and live portfolio updates.

## Architecture

### Components

1. **WebSocket Server** (`apps/api/src/websocket.ts`)
   - Handles client connections and authentication
   - Manages channel subscriptions
   - Implements rate limiting and heartbeat
   - Broadcasts messages to subscribed clients

2. **Streaming Services**
   - **TradingStreamService** (`apps/api/src/services/trading-stream.ts`) - Broadcasts trading events
   - **MarketStreamService** (`apps/api/src/services/market-stream.ts`) - Streams market data

3. **Client SDK** (`packages/shared/src/websocket-client.ts`)
   - TypeScript WebSocket client with automatic reconnection
   - Subscription management
   - Event emitter pattern

4. **React Hooks** (`apps/web/src/hooks/`)
   - `useWebSocket` - Core WebSocket connection management
   - `useTradingUpdates` - Trading events subscription
   - `useMarketData` - Market data subscription

## Server Configuration

### Environment Variables

```bash
# WebSocket Server
WS_PORT=3001
JWT_ACCESS_SECRET=your-jwt-secret

# Rate Limiting
WS_MAX_MESSAGES_PER_SECOND=100
WS_MAX_SUBSCRIPTIONS=50

# Heartbeat
WS_HEARTBEAT_INTERVAL=30000  # 30 seconds
```

### Starting the Server

The WebSocket server is automatically initialized when the API server starts:

```typescript
import { TradingWebSocketServer } from "./websocket";
import { JwtService } from "./services/jwt";

const jwtService = new JwtService(
  process.env.JWT_ACCESS_SECRET!,
  process.env.JWT_REFRESH_SECRET!
);

const wsServer = new TradingWebSocketServer(wss, jwtService);
```

## Authentication

### JWT Token Authentication

Clients must authenticate using a JWT access token:

```typescript
// Client-side
const client = new WebSocketClient({
  url: "ws://localhost:3001",
  token: "your-jwt-access-token"
});

await client.connect();
```

### Authentication Flow

1. Client connects to WebSocket server
2. Client sends authentication message with JWT token
3. Server verifies token and associates userId with connection
4. Client can now subscribe to user-specific channels

```typescript
// Authentication message format
{
  type: "auth",
  data: { token: "jwt-token" },
  timestamp: 1234567890
}
```

## Channel System

### Channel Types

#### Public Channels
- `market:{symbol}` - Market data for specific trading pair
- `orderbook:{symbol}` - Order book updates
- `system` - System-wide announcements

#### User-Specific Channels (Require Authentication)
- `trades:{userId}` - User's trade executions
- `positions:{userId}` - User's position updates
- `portfolio:{userId}` - User's portfolio updates
- `notifications:{userId}` - User's notifications

### Access Control

The server enforces access control for user-specific channels:

```typescript
// Users can only subscribe to their own channels
canAccessChannel(client: ClientConnection, channel: string): boolean {
  // Public channels
  if (channel === "system" || channel.startsWith("market:")) {
    return true;
  }
  
  // User-specific channels
  if (channel.startsWith("trades:") || channel.startsWith("positions:")) {
    const channelUserId = channel.split(":")[1];
    return channelUserId === client.userId;
  }
  
  return false;
}
```

## Subscription Management

### Subscribing to Channels

```typescript
// Client-side
client.subscribe("market:BTC/USD", (data) => {
  console.log("Market data:", data);
});

client.subscribe("trades:user123", (data) => {
  console.log("Trade executed:", data);
});
```

### Subscription Message Format

```typescript
{
  type: "subscribe",
  channel: "market:BTC/USD",
  timestamp: 1234567890
}
```

### Unsubscribing

```typescript
// Unsubscribe specific callback
client.unsubscribe("market:BTC/USD", callback);

// Unsubscribe all callbacks for channel
client.unsubscribe("market:BTC/USD");
```

### Subscription Limits

- Maximum 50 subscriptions per connection
- Exceeding limit returns error message

## Message Protocol

### Message Types

#### Client → Server

1. **Authentication**
```typescript
{
  type: "auth",
  data: { token: string },
  timestamp: number
}
```

2. **Subscribe**
```typescript
{
  type: "subscribe",
  channel: string,
  timestamp: number
}
```

3. **Unsubscribe**
```typescript
{
  type: "unsubscribe",
  channel: string,
  timestamp: number
}
```

4. **Ping**
```typescript
{
  type: "ping",
  timestamp: number
}
```

#### Server → Client

1. **Data**
```typescript
{
  type: "data",
  channel: string,
  data: any,
  timestamp: number
}
```

2. **Subscribed**
```typescript
{
  type: "subscribed",
  channel: string,
  timestamp: number
}
```

3. **Unsubscribed**
```typescript
{
  type: "unsubscribed",
  channel: string,
  timestamp: number
}
```

4. **Error**
```typescript
{
  type: "error",
  error: string,
  timestamp: number
}
```

5. **Pong**
```typescript
{
  type: "pong",
  timestamp: number
}
```

## Market Data Streaming

### Starting Market Data Stream

```typescript
import { MarketStreamService } from "./services/market-stream";

const marketStream = new MarketStreamService(wsServer, exchange);

// Start streaming BTC/USD market data
await marketStream.startStreaming("BTC/USD");
```

### Market Data Format

```typescript
{
  type: "ticker",
  symbol: "BTC/USD",
  price: 50000,
  volume24h: 1000,
  change24h: 2.5,
  high24h: 51000,
  low24h: 49000,
  timestamp: 1234567890
}
```

### Stopping Market Data Stream

```typescript
// Stop specific symbol
marketStream.stopStreaming("BTC/USD");

// Stop all streams
marketStream.stopAll();
```

### Active Streams

```typescript
const activeStreams = marketStream.getActiveStreams();
console.log("Active streams:", activeStreams); // ["BTC/USD", "ETH/USD"]
```

## Trading Event Broadcasting

### Broadcasting Trade Execution

```typescript
import { TradingStreamService } from "./services/trading-stream";

const tradingStream = new TradingStreamService(wsServer);

tradingStream.broadcastTradeExecuted({
  id: "trade-1",
  userId: "user123",
  symbol: "BTC/USD",
  side: "buy",
  type: "market",
  quantity: 0.5,
  price: 50000,
  status: "filled",
  executedAt: new Date()
});
```

### Broadcasting Position Updates

```typescript
// Position opened
tradingStream.broadcastPositionOpened({
  id: "pos-1",
  userId: "user123",
  symbol: "BTC/USD",
  side: "long",
  entryPrice: 50000,
  quantity: 0.5,
  leverage: 2,
  openedAt: new Date()
});

// Position updated
tradingStream.broadcastPositionUpdated({
  id: "pos-1",
  userId: "user123",
  symbol: "BTC/USD",
  side: "long",
  entryPrice: 50000,
  quantity: 0.5,
  currentPrice: 51000,
  unrealizedPnl: 500,
  unrealizedPnlPercent: 1.0
});

// Position closed
tradingStream.broadcastPositionClosed({
  id: "pos-1",
  userId: "user123",
  symbol: "BTC/USD",
  side: "long",
  entryPrice: 50000,
  exitPrice: 52000,
  quantity: 0.5,
  realizedPnl: 1000,
  realizedPnlPercent: 4.0,
  closedAt: new Date()
});
```

### Broadcasting Portfolio Updates

```typescript
tradingStream.broadcastPortfolioUpdate({
  userId: "user123",
  totalValue: 100000,
  availableBalance: 50000,
  positions: [
    { symbol: "BTC/USD", value: 25000, unrealizedPnl: 1000 },
    { symbol: "ETH/USD", value: 25000, unrealizedPnl: -500 }
  ],
  totalUnrealizedPnl: 500,
  totalRealizedPnl: 2000
});
```

## Client SDK Usage

### Basic Connection

```typescript
import { WebSocketClient } from "@trade/shared/websocket-client";

const client = new WebSocketClient({
  url: "ws://localhost:3001",
  token: "jwt-token",
  autoReconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000
});

await client.connect();
```

### Event Handling

```typescript
client.on("connected", () => {
  console.log("Connected to WebSocket server");
});

client.on("disconnected", () => {
  console.log("Disconnected from WebSocket server");
});

client.on("error", (error) => {
  console.error("WebSocket error:", error);
});

client.on("reconnecting", (attempt) => {
  console.log(`Reconnecting... Attempt ${attempt}`);
});

client.on("reconnect_failed", () => {
  console.error("Failed to reconnect after max attempts");
});
```

### Subscription with Callbacks

```typescript
const marketCallback = (data) => {
  console.log("Market update:", data);
};

client.subscribe("market:BTC/USD", marketCallback);

// Later, unsubscribe
client.unsubscribe("market:BTC/USD", marketCallback);
```

### Disconnection

```typescript
client.disconnect();
```

## React Integration

### useWebSocket Hook

```typescript
import { useWebSocket } from "./hooks/useWebSocket";

function MyComponent() {
  const { isConnected, isConnecting, error, subscribe, unsubscribe } = useWebSocket({
    url: "ws://localhost:3001",
    token: authToken,
    autoConnect: true
  });

  useEffect(() => {
    if (isConnected) {
      const callback = (data) => {
        console.log("Data received:", data);
      };
      
      subscribe("market:BTC/USD", callback);
      
      return () => {
        unsubscribe("market:BTC/USD", callback);
      };
    }
  }, [isConnected, subscribe, unsubscribe]);

  return (
    <div>
      {isConnecting && <p>Connecting...</p>}
      {isConnected && <p>Connected</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### useTradingUpdates Hook

```typescript
import { useTradingUpdates } from "./hooks/useTradingUpdates";

function TradingPanel() {
  const { updates, clearUpdates } = useTradingUpdates(
    userId,
    "ws://localhost:3001",
    authToken
  );

  return (
    <div>
      <h2>Trading Updates</h2>
      <button onClick={clearUpdates}>Clear</button>
      <ul>
        {updates.map((update, index) => (
          <li key={index}>
            {update.type}: {JSON.stringify(update)}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### useMarketData Hook

```typescript
import { useMarketData } from "./hooks/useMarketData";

function MarketTicker({ symbol }) {
  const marketData = useMarketData(symbol, "ws://localhost:3001");

  if (!marketData) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3>{marketData.symbol}</h3>
      <p>Price: ${marketData.price.toFixed(2)}</p>
      <p>24h Change: {marketData.change24h.toFixed(2)}%</p>
      <p>24h Volume: {marketData.volume24h.toFixed(2)}</p>
      <p>24h High: ${marketData.high24h.toFixed(2)}</p>
      <p>24h Low: ${marketData.low24h.toFixed(2)}</p>
    </div>
  );
}
```

## Rate Limiting

### Message Rate Limit

- Maximum 100 messages per second per connection
- Counter resets every second
- Exceeding limit returns error and may disconnect client

### Subscription Limit

- Maximum 50 subscriptions per connection
- Attempting to exceed limit returns error

## Heartbeat Mechanism

### Server-Side

- Server checks client heartbeats every 30 seconds
- Clients with no heartbeat for 60 seconds are disconnected

### Client-Side

- Client sends ping every 30 seconds
- Server responds with pong
- Automatic reconnection if connection lost

## Error Handling

### Common Errors

1. **Authentication Failed**
```typescript
{
  type: "error",
  error: "Authentication failed: Invalid token"
}
```

2. **Access Denied**
```typescript
{
  type: "error",
  error: "Access denied to channel: trades:user456"
}
```

3. **Rate Limit Exceeded**
```typescript
{
  type: "error",
  error: "Rate limit exceeded"
}
```

4. **Max Subscriptions Reached**
```typescript
{
  type: "error",
  error: "Maximum subscriptions reached (50)"
}
```

### Client Error Handling

```typescript
client.on("error", (error) => {
  if (error.message.includes("Authentication failed")) {
    // Refresh token and reconnect
    refreshToken().then((newToken) => {
      client.disconnect();
      client = new WebSocketClient({ url, token: newToken });
      client.connect();
    });
  } else if (error.message.includes("Rate limit")) {
    // Slow down message sending
    console.warn("Rate limit hit, throttling...");
  }
});
```

## Monitoring

### Connection Statistics

```typescript
const stats = wsServer.getStats();
console.log(stats);
// {
//   totalConnections: 150,
//   authenticatedConnections: 120,
//   totalChannels: 45,
//   channels: {
//     "market:BTC/USD": 80,
//     "market:ETH/USD": 60,
//     "trades:user123": 1,
//     ...
//   }
// }
```

### API Endpoint

```
GET /ws/stats
```

Returns WebSocket server statistics.

## Performance Optimization

### Connection Pooling

- Reuse WebSocket connections across components
- Use React Context to share connection

```typescript
import { createContext, useContext } from "react";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children, url, token }) {
  const ws = useWebSocket({ url, token, autoConnect: true });
  
  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useSharedWebSocket() {
  return useContext(WebSocketContext);
}
```

### Subscription Batching

- Subscribe to multiple channels in single render cycle
- Unsubscribe in cleanup functions

### Message Throttling

- Throttle high-frequency updates (e.g., market data)
- Use `requestAnimationFrame` for UI updates

```typescript
useEffect(() => {
  let rafId;
  let latestData = null;

  const callback = (data) => {
    latestData = data;
    
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        setMarketData(latestData);
        rafId = null;
      });
    }
  };

  subscribe("market:BTC/USD", callback);

  return () => {
    unsubscribe("market:BTC/USD", callback);
    if (rafId) cancelAnimationFrame(rafId);
  };
}, [subscribe, unsubscribe]);
```

## Security Best Practices

1. **Always use WSS (WebSocket Secure) in production**
```typescript
const url = process.env.NODE_ENV === "production" 
  ? "wss://api.example.com" 
  : "ws://localhost:3001";
```

2. **Validate JWT tokens on every connection**
3. **Enforce channel access control**
4. **Implement rate limiting**
5. **Use heartbeat to detect stale connections**
6. **Sanitize all incoming messages**
7. **Log security events (failed auth, access denied)**

## Testing

### Running Tests

```bash
# Server tests
cd apps/api
npm test websocket.test.ts

# Client tests
cd packages/shared
npm test websocket-client.test.ts

# React hooks tests
cd apps/web
npm test useWebSocket.test.tsx
npm test useTradingUpdates.test.tsx
npm test useMarketData.test.tsx
```

### Test Coverage

- WebSocket server: Authentication, subscriptions, rate limiting, heartbeat, broadcasting
- Client SDK: Connection, reconnection, subscriptions, event handling
- React hooks: State management, subscription lifecycle, error handling

## Troubleshooting

### Connection Issues

**Problem**: Client cannot connect
- Check WebSocket server is running
- Verify URL is correct (ws:// or wss://)
- Check firewall/proxy settings
- Verify JWT token is valid

**Problem**: Frequent disconnections
- Check network stability
- Verify heartbeat interval settings
- Check server logs for errors
- Monitor rate limiting

### Subscription Issues

**Problem**: Not receiving messages
- Verify client is connected (`isConnected === true`)
- Check subscription was successful
- Verify channel name is correct
- Check access permissions for user-specific channels

**Problem**: Duplicate messages
- Ensure subscription cleanup in useEffect
- Check for multiple subscriptions to same channel
- Verify unsubscribe is called on unmount

### Performance Issues

**Problem**: High memory usage
- Check for subscription leaks (missing cleanup)
- Limit number of active subscriptions
- Implement message throttling
- Clear old updates periodically

**Problem**: Slow updates
- Check network latency
- Verify server is not overloaded
- Implement client-side caching
- Use message batching

## Next Steps

1. **Compression**: Implement message compression (gzip, deflate)
2. **Binary Protocol**: Use binary format (MessagePack, Protocol Buffers) for better performance
3. **Clustering**: Support multiple WebSocket server instances with Redis pub/sub
4. **Metrics**: Add Prometheus metrics for monitoring
5. **Admin Dashboard**: Build real-time monitoring dashboard
6. **Mobile Support**: Create React Native WebSocket hooks
7. **Offline Support**: Queue messages when offline, sync on reconnect
