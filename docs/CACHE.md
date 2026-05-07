# Redis Cache System

Complete Redis-based caching implementation for the trading platform.

## Overview

The cache system provides:
- **Key-value storage** with TTL support
- **Batch operations** for efficient multi-key access
- **Pattern matching** for bulk operations
- **Counter operations** for rate limiting and metrics
- **Cache patterns** (cache-aside, write-through, write-behind)
- **Automatic reconnection** and error handling
- **Metrics integration** for cache hit/miss tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  User Cache  │  Market Data Cache  │  Cache Middleware      │
├─────────────────────────────────────────────────────────────┤
│                    Cache Client (Redis)                      │
├─────────────────────────────────────────────────────────────┤
│                      Redis Server                            │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. CacheClient (`packages/shared/src/cache.ts`)

Main Redis client with comprehensive operations:

```typescript
import { cache } from "@trade/shared/cache";

// Connect to Redis
await cache.connect();

// Basic operations
await cache.set("key", { data: "value" }, 60); // TTL in seconds
const value = await cache.get<{ data: string }>("key");
await cache.del("key");

// Batch operations
const values = await cache.mget<string>(["key1", "key2", "key3"]);
await cache.mset([
  { key: "key1", value: "value1", ttl: 60 },
  { key: "key2", value: "value2", ttl: 60 }
]);

// Pattern operations
const keys = await cache.keys("user:*");
await cache.clear("session:*");

// Counter operations
await cache.increment("counter", 1);
await cache.decrement("counter", 1);

// Connection management
cache.isConnected(); // Check connection status
await cache.disconnect();
```

**Features:**
- Automatic JSON serialization/deserialization
- Configurable key prefix for namespace isolation
- Default TTL with per-key override
- Error handling with logging and metrics
- Connection state management

### 2. Cache Patterns

#### Cache-Aside (Lazy Loading)

```typescript
import { cacheAside } from "@trade/shared/cache";

const user = await cacheAside(
  `user:${userId}`,
  async () => {
    // Fetch from database if not in cache
    return await db.getUser(userId);
  },
  300 // TTL in seconds
);
```

#### Write-Through

```typescript
import { writeThrough } from "@trade/shared/cache";

await writeThrough(
  `user:${userId}`,
  userData,
  async (data) => {
    // Write to database
    await db.updateUser(userId, data);
  },
  300
);
```

#### Write-Behind (Async Write)

```typescript
import { writeBehind } from "@trade/shared/cache";

await writeBehind(
  `user:${userId}`,
  userData,
  async (data) => {
    // Write to database asynchronously
    await db.updateUser(userId, data);
  },
  300
);
```

### 3. Cache Decorator

```typescript
import { Cacheable } from "@trade/shared/cache";

class UserService {
  @Cacheable(300) // Cache for 5 minutes
  async getUser(userId: string) {
    return await db.getUser(userId);
  }
}
```

### 4. User Cache (`apps/api/src/services/user-cache.ts`)

Specialized cache for user data:

```typescript
import { userCache } from "./services/user-cache";

// Get user with automatic caching
const user = await userCache.getUser(userId, async () => {
  return await db.getUser(userId);
});

// Update user with write-through
await userCache.updateUser(userId, userData, async (data) => {
  await db.updateUser(userId, data);
});

// Session management
await userCache.setUserSession(sessionId, { userId, expiresAt });
const session = await userCache.getUserSession(sessionId);
await userCache.invalidateUserSession(sessionId);
await userCache.invalidateAllUserSessions(userId);

// User preferences
await userCache.setUserPreferences(userId, preferences);
const prefs = await userCache.getUserPreferences(userId);
```

### 5. Market Data Cache (`apps/api/src/services/market-data-cache.ts`)

Specialized cache for market data with short TTLs:

```typescript
import { marketDataCache } from "./services/market-data-cache";

// Cache ticker data (5 second TTL)
const ticker = await marketDataCache.getTicker(symbol, async () => {
  return await exchange.getTicker(symbol);
});

// Batch fetch multiple tickers
const tickers = await marketDataCache.getMultipleTickers(
  ["BTC-USDT", "ETH-USDT"],
  async (symbol) => await exchange.getTicker(symbol)
);

// Cache candle data (1 minute TTL)
const candles = await marketDataCache.getCandles(symbol, "1h", async () => {
  return await exchange.getCandles(symbol, "1h");
});

// Cache order book (2 second TTL)
const orderBook = await marketDataCache.getOrderBook(symbol, async () => {
  return await exchange.getOrderBook(symbol);
});

// Invalidation
await marketDataCache.invalidateTicker(symbol);
await marketDataCache.invalidateAllTickers();
await marketDataCache.invalidateCandles(symbol, "1h");
```

### 6. Cache Middleware (`apps/api/src/middleware/cache.ts`)

HTTP response caching for Express/Fastify:

```typescript
import { cacheMiddleware, invalidateCache } from "./middleware/cache";

// Cache GET requests
app.get("/api/ticker/:symbol", 
  cacheMiddleware({ 
    ttl: 5,
    keyGenerator: (req) => `ticker:${req.params.symbol}`,
    condition: (req) => req.query.cache !== "false"
  }),
  async (req, res) => {
    // Handler
  }
);

// Invalidate cache on mutations
app.post("/api/orders",
  invalidateCache("ticker:*"),
  async (req, res) => {
    // Handler
  }
);
```

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# Optional: Redis password
REDIS_PASSWORD=your-password

# Optional: Redis database number
REDIS_DB=0
```

### Cache Options

```typescript
const cache = new CacheClient({
  url: "redis://localhost:6379",
  ttl: 300,        // Default TTL in seconds
  prefix: "trade:" // Key prefix for namespace isolation
});
```

## TTL Strategy

Different data types have different TTL requirements:

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Ticker data | 5s | Real-time market data |
| Order book | 2s | High-frequency updates |
| Candle data | 60s | Historical data, less volatile |
| User data | 5m | Infrequently changed |
| User sessions | 1h | Security vs performance balance |
| User preferences | 5m | Rarely changed |
| API responses | 30-60s | Balance freshness and load |

## Cache Invalidation

### Manual Invalidation

```typescript
// Single key
await cache.del("user:123");

// Pattern-based
await cache.clear("user:*");
await cache.clear("session:*");

// All keys
await cache.clear();
```

### Automatic Invalidation

```typescript
// On user update
await userCache.invalidateUser(userId);

// On logout
await userCache.invalidateUserSession(sessionId);

// On market data update
await marketDataCache.invalidateTicker(symbol);
```

### Middleware-based Invalidation

```typescript
// Invalidate on POST/PUT/DELETE
app.post("/api/users/:id", 
  invalidateCache("user:*"),
  handler
);
```

## Monitoring

### Metrics

The cache system automatically tracks:
- **Cache hits**: `cache_hits_total{key}`
- **Cache misses**: `cache_misses_total{key}`
- **Cache errors**: `errors_total{type="cache_set_error"}`

### Health Checks

```typescript
import { healthCheck } from "@trade/shared/health-check";
import { cache } from "@trade/shared/cache";

// Register Redis health check
healthCheck.registerRedis(cache);

// Check health
const health = await healthCheck.detailed();
console.log(health.components.redis);
```

### Logging

All cache operations are logged with structured logging:

```json
{
  "level": "debug",
  "msg": "Cache set",
  "key": "user:123",
  "ttl": 300
}
```

## Performance Optimization

### 1. Batch Operations

Use `mget` and `mset` for multiple keys:

```typescript
// Bad: Multiple round trips
const user1 = await cache.get("user:1");
const user2 = await cache.get("user:2");
const user3 = await cache.get("user:3");

// Good: Single round trip
const [user1, user2, user3] = await cache.mget(["user:1", "user:2", "user:3"]);
```

### 2. Pipeline Operations

For complex operations, use Redis pipelines (future enhancement).

### 3. Connection Pooling

The Redis client automatically manages connection pooling.

### 4. Key Design

Use hierarchical keys for efficient pattern matching:

```
user:{userId}
user:{userId}:preferences
user:{userId}:sessions:{sessionId}
ticker:{symbol}
candles:{symbol}:{interval}
```

## Error Handling

The cache system is designed to fail gracefully:

```typescript
// If Redis is down, operations return null/empty
const value = await cache.get("key"); // Returns null if Redis is down
await cache.set("key", "value"); // Logs error but doesn't throw

// Check connection before critical operations
if (cache.isConnected()) {
  await cache.set("key", "value");
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CacheClient } from "@trade/shared/cache";

describe("CacheClient", () => {
  let cache: CacheClient;

  beforeEach(async () => {
    cache = new CacheClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
      prefix: "test:"
    });
    await cache.connect();
    await cache.clear();
  });

  afterEach(async () => {
    await cache.clear();
    await cache.disconnect();
  });

  it("should set and get a value", async () => {
    await cache.set("key1", { data: "value1" });
    const result = await cache.get<{ data: string }>("key1");
    expect(result).toEqual({ data: "value1" });
  });
});
```

### Integration Tests

Run tests with a real Redis instance:

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Run tests
npm test
```

## Best Practices

1. **Always set TTL**: Prevent memory leaks by setting appropriate TTLs
2. **Use namespaces**: Prefix keys to avoid collisions
3. **Handle failures gracefully**: Cache should enhance, not break functionality
4. **Monitor cache hit rate**: Aim for >80% hit rate for frequently accessed data
5. **Invalidate proactively**: Clear cache on data mutations
6. **Use batch operations**: Reduce round trips with mget/mset
7. **Choose appropriate TTLs**: Balance freshness and performance
8. **Test without cache**: Ensure app works when Redis is down

## Troubleshooting

### Cache Not Working

```bash
# Check Redis connection
redis-cli ping

# Check Redis logs
docker logs <redis-container>

# Check application logs
grep "Redis" logs/app.log
```

### Low Hit Rate

- Verify TTLs are appropriate
- Check if keys are being invalidated too frequently
- Monitor key patterns for consistency

### Memory Issues

```bash
# Check Redis memory usage
redis-cli info memory

# Check key count
redis-cli dbsize

# Find large keys
redis-cli --bigkeys
```

### Connection Issues

- Verify REDIS_URL environment variable
- Check network connectivity
- Verify Redis is running and accepting connections
- Check firewall rules

## Future Enhancements

- [ ] Redis Cluster support for horizontal scaling
- [ ] Redis Sentinel for high availability
- [ ] Pipeline operations for batch writes
- [ ] Pub/Sub for cache invalidation across instances
- [ ] Cache warming strategies
- [ ] Distributed locks for critical sections
- [ ] Rate limiting with sliding windows
- [ ] Bloom filters for existence checks
