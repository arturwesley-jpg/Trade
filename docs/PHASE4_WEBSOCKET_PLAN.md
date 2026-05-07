# Phase 4 Implementation Plan - WebSocket Real-Time System

## Overview
Implement a comprehensive WebSocket system for real-time data streaming to clients, including market data, trade updates, position changes, and system notifications.

## Current State Analysis

### Existing WebSocket Infrastructure
- `apps/api/src/websocket.ts` - TradingWebSocketServer class exists
- Basic WebSocket server with authentication
- Room-based broadcasting (user-specific rooms)
- Integration with Redis pub/sub for distributed messaging

### What Needs Enhancement
1. **Market Data Streaming** - Real-time ticker, orderbook, trades
2. **Trading Updates** - Position changes, order updates, trade executions
3. **Notification Streaming** - Push notifications via WebSocket
4. **Connection Management** - Reconnection, heartbeat, rate limiting
5. **Subscription Management** - Dynamic channel subscriptions
6. **Message Compression** - Reduce bandwidth usage
7. **Client SDK** - TypeScript client library

## Implementation Tasks

### 1. Enhanced WebSocket Server
**File**: `apps/api/src/websocket.ts`

**Features to Add**:
- Subscription management (subscribe/unsubscribe to channels)
- Heartbeat/ping-pong mechanism
- Connection rate limiting
- Message compression (optional)
- Reconnection token generation
- Channel-based broadcasting (market data, notifications, trades)

**Channels**:
- `market:{symbol}` - Market data for specific symbol
- `trades:{userId}` - User's trade updates
- `positions:{userId}` - User's position updates
- `notifications:{userId}` - User's notifications
- `orderbook:{symbol}` - Order book updates
- `system` - System-wide announcements

### 2. Market Data Streaming Service
**File**: `apps/api/src/services/market-stream.ts`

**Features**:
- Subscribe to exchange WebSocket feeds
- Aggregate data from multiple exchanges
- Broadcast to connected clients
- Rate limiting and throttling
- Cache recent data for new subscribers

### 3. Trading Event Streaming
**File**: `apps/api/src/services/trading-stream.ts`

**Features**:
- Listen to trading events (order fills, position changes)
- Broadcast to user-specific channels
- Include PnL calculations
- Real-time portfolio updates

### 4. Notification Streaming Integration
**File**: `packages/shared/src/notifications/websocket-handler.ts`

**Features**:
- WebSocket notification handler
- Push notifications to connected clients
- Fallback to other channels if client offline
- Delivery confirmation

### 5. Client SDK
**File**: `packages/shared/src/websocket-client.ts`

**Features**:
- TypeScript WebSocket client
- Automatic reconnection
- Subscription management
- Type-safe message handling
- Event emitter pattern
- Connection state management

### 6. Message Protocol
**File**: `packages/shared/src/websocket-protocol.ts`

**Message Types**:
```typescript
// Client -> Server
- subscribe: { channel: string, params?: object }
- unsubscribe: { channel: string }
- ping: {}

// Server -> Client
- subscribed: { channel: string }
- unsubscribed: { channel: string }
- data: { channel: string, data: any }
- error: { code: string, message: string }
- pong: {}
```

### 7. Frontend Integration
**Files**: 
- `apps/web/src/hooks/useWebSocket.ts`
- `apps/web/src/hooks/useMarketData.ts`
- `apps/web/src/hooks/useTradingUpdates.ts`

**Features**:
- React hooks for WebSocket connections
- Automatic subscription management
- State synchronization
- Error handling and reconnection

## Technical Specifications

### Connection Flow
1. Client connects to `ws://api/ws`
2. Server sends connection acknowledgment
3. Client authenticates (JWT token)
4. Server validates and sends auth success
5. Client subscribes to channels
6. Server confirms subscriptions
7. Data flows bidirectionally

### Message Format
```typescript
interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'data' | 'error' | 'ping' | 'pong';
  channel?: string;
  data?: unknown;
  timestamp: number;
  id?: string; // Message ID for tracking
}
```

### Subscription Patterns
- `market:BTC-USDT` - Single symbol market data
- `market:*` - All symbols (admin only)
- `trades:user-123` - User's trades
- `positions:user-123` - User's positions
- `notifications:user-123` - User's notifications

### Rate Limiting
- Max 100 messages/second per connection
- Max 50 subscriptions per connection
- Max 10 connections per user
- Throttle market data to 1 update/second per symbol

### Compression
- Optional gzip compression for messages > 1KB
- Client negotiates compression support
- Reduces bandwidth by ~70% for market data

## Integration Points

### 1. Exchange Providers
- Connect to Binance, Kraken, OKX WebSocket feeds
- Normalize messages to common format
- Broadcast to subscribed clients

### 2. Trading Engine
- Emit events on order fills
- Emit events on position changes
- Broadcast to user channels

### 3. Notification System
- Register WebSocket handler
- Push notifications to connected clients
- Track delivery status

### 4. Cache System
- Cache recent market data
- Serve cached data to new subscribers
- Reduce exchange API calls

## Testing Strategy

### Unit Tests
- Message serialization/deserialization
- Subscription management
- Authentication flow
- Rate limiting

### Integration Tests
- End-to-end message flow
- Multiple client connections
- Reconnection scenarios
- Channel broadcasting

### Load Tests
- 1000 concurrent connections
- 10,000 messages/second throughput
- Memory usage under load
- CPU usage under load

## Monitoring

### Metrics to Track
- Active connections count
- Messages sent/received per second
- Subscription count per channel
- Average message latency
- Connection errors
- Reconnection rate

### Logging
- Connection events (connect, disconnect, error)
- Subscription events
- Authentication failures
- Rate limit violations

## Security Considerations

1. **Authentication**: JWT token validation on connect
2. **Authorization**: Channel access control (user can only subscribe to own channels)
3. **Rate Limiting**: Prevent DoS attacks
4. **Input Validation**: Validate all client messages
5. **Connection Limits**: Max connections per user/IP

## Performance Optimization

1. **Message Batching**: Batch multiple updates into single message
2. **Compression**: Gzip for large messages
3. **Binary Protocol**: Consider MessagePack for efficiency
4. **Connection Pooling**: Reuse connections efficiently
5. **Caching**: Cache recent data for new subscribers

## Deployment Considerations

1. **Sticky Sessions**: Required for WebSocket connections
2. **Load Balancing**: Use Redis pub/sub for multi-instance
3. **Scaling**: Horizontal scaling with Redis adapter
4. **Monitoring**: Track connection count, message rate
5. **Graceful Shutdown**: Close connections cleanly on deploy

## Timeline Estimate

- Enhanced WebSocket Server: 2-3 hours
- Market Data Streaming: 2-3 hours
- Trading Event Streaming: 1-2 hours
- Notification Integration: 1 hour
- Client SDK: 2-3 hours
- Frontend Integration: 2-3 hours
- Testing: 2-3 hours
- Documentation: 1-2 hours

**Total**: 13-20 hours

## Success Criteria

- [ ] WebSocket server handles 1000+ concurrent connections
- [ ] Market data streams with < 100ms latency
- [ ] Trading updates delivered in real-time
- [ ] Notifications pushed via WebSocket
- [ ] Client SDK provides type-safe API
- [ ] Frontend hooks integrate seamlessly
- [ ] Comprehensive test coverage
- [ ] Complete documentation
- [ ] Monitoring and metrics in place

## Next Steps

1. Enhance WebSocket server with subscription management
2. Implement market data streaming service
3. Add trading event streaming
4. Create WebSocket notification handler
5. Build client SDK
6. Integrate with frontend
7. Write comprehensive tests
8. Document the system
