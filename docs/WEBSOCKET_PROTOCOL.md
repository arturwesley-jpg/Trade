# WebSocket Protocol Documentation

**Version:** 1.0  
**Last Updated:** 2026-05-03

---

## 📡 Overview

The WebSocket service provides real-time market data streaming from the backend to the frontend. It handles connection management, auto-reconnection, and type-safe message parsing.

---

## 🔌 Connection

### Endpoint
```
ws://localhost:3000
```

### Connection Flow
```
Client                          Server
  |                               |
  |--- WebSocket Handshake ----->|
  |<--- 101 Switching Protocols--|
  |                               |
  |<--- Market Data Messages -----|
  |                               |
```

---

## 📨 Message Format

### Candle Update Message

```typescript
interface CandleMessage {
  type: 'candle';
  data: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}
```

**Example:**
```json
{
  "type": "candle",
  "data": {
    "timestamp": 1714766400000,
    "open": 64250.50,
    "high": 64380.75,
    "low": 64180.25,
    "close": 64320.00,
    "volume": 125.45
  }
}
```

### Error Message

```typescript
interface ErrorMessage {
  type: 'error';
  message: string;
}
```

**Example:**
```json
{
  "type": "error",
  "message": "Market data unavailable"
}
```

---

## 🔄 Connection States

```typescript
enum ConnectionState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}
```

---

## 🛡️ Error Handling

### Reconnection Strategy

**Exponential Backoff:**
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5: 16 seconds
- Max attempts: 5

**Formula:**
```typescript
const delay = Math.min(Math.pow(2, attempt) * 1000, 30000);
```

### Error Types

1. **Connection Failed**
   - Network unavailable
   - Server unreachable
   - Invalid URL

2. **Connection Closed**
   - Server shutdown
   - Network interruption
   - Client disconnect

3. **Message Parse Error**
   - Invalid JSON
   - Missing required fields
   - Type mismatch

---

## 💻 Client Implementation

### Basic Usage

```typescript
import { MarketDataWebSocket } from '@/services/websocket';

const ws = new MarketDataWebSocket('ws://localhost:3000');

// Handle candle updates
ws.onCandle((candle) => {
  console.log('New candle:', candle);
  updateChart(candle);
});

// Handle errors
ws.onError((error) => {
  console.error('WebSocket error:', error);
  showNotification('Connection error', 'error');
});

// Connect
ws.connect();

// Cleanup on unmount
return () => {
  ws.disconnect();
};
```

### With React Hook

```typescript
import { useEffect } from 'react';
import { useTrading } from '@/contexts/TradingContext';

function TradingHub() {
  const { addCandle } = useTrading();

  useEffect(() => {
    const ws = new MarketDataWebSocket(
      import.meta.env.VITE_WS_URL
    );

    ws.onCandle(addCandle);
    ws.onError((error) => {
      console.error('WebSocket error:', error);
    });

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [addCandle]);

  return <div>Trading Hub</div>;
}
```

---

## 🧪 Testing

### Mock WebSocket

```typescript
import { vi } from 'vitest';

const mockWs = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
};

global.WebSocket = vi.fn(() => mockWs) as any;
```

### Simulate Messages

```typescript
// Simulate candle message
const candleMessage = {
  type: 'candle',
  data: {
    timestamp: Date.now(),
    open: 64000,
    high: 64500,
    low: 63800,
    close: 64200,
    volume: 100
  }
};

// Trigger message event
const messageEvent = new MessageEvent('message', {
  data: JSON.stringify(candleMessage)
});

mockWs.addEventListener.mock.calls
  .find(([event]) => event === 'message')[1](messageEvent);
```

---

## 🔒 Security

### Authentication

WebSocket connections inherit the HTTP session authentication. Ensure the user is authenticated before establishing the WebSocket connection.

### Rate Limiting

Server-side rate limiting prevents abuse:
- Max 1 connection per user
- Max 100 messages/second
- Auto-disconnect on violation

---

## 📊 Performance

### Message Frequency
- Candle updates: ~1 per second (1m timeframe)
- Bandwidth: ~200 bytes per message
- Expected throughput: ~200 bytes/second

### Optimization Tips
1. Batch chart updates (requestAnimationFrame)
2. Throttle state updates (max 60fps)
3. Use Web Workers for heavy processing
4. Implement message queue for burst handling

---

## 🐛 Debugging

### Enable Debug Logging

```typescript
const ws = new MarketDataWebSocket(url, {
  debug: true
});
```

### Chrome DevTools

1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Click connection to see messages
4. Monitor connection state

### Common Issues

**Issue:** Connection immediately closes
- **Cause:** Invalid URL or server not running
- **Fix:** Check VITE_WS_URL environment variable

**Issue:** No messages received
- **Cause:** Server not sending data or subscription issue
- **Fix:** Check server logs and subscription status

**Issue:** Frequent reconnections
- **Cause:** Network instability or server issues
- **Fix:** Check network connection and server health

---

## 📈 Monitoring

### Client-Side Metrics

```typescript
interface WebSocketMetrics {
  connectionAttempts: number;
  successfulConnections: number;
  messagesReceived: number;
  errors: number;
  averageLatency: number;
}
```

### Server-Side Metrics

- Active connections
- Messages sent per second
- Connection duration
- Error rate

---

## 🔮 Future Enhancements

- [ ] Binary message format (Protocol Buffers)
- [ ] Message compression (gzip)
- [ ] Multiple symbol subscriptions
- [ ] Heartbeat/ping-pong mechanism
- [ ] Message acknowledgment
- [ ] Replay missed messages on reconnect

---

## 📚 References

- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [RFC 6455 - WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [Backend WebSocket Implementation](../apps/api/src/websocket.ts)

---

*Last Updated: 2026-05-03 20:16 GMT*
