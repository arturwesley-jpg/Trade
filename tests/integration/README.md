# Integration Tests

## Overview

Integration tests verify that different parts of the system work together correctly. These tests use real databases, Redis, and other services.

## Test Structure

```
integration/
├── api/                    # API endpoint tests
│   ├── auth.test.ts       # Authentication endpoints
│   ├── market.test.ts     # Market data endpoints
│   ├── signals.test.ts    # Signal generation endpoints
│   ├── orders.test.ts     # Order management endpoints
│   ├── backtest.test.ts   # Backtesting endpoints
│   └── alerts.test.ts     # Alert management endpoints
├── services/              # Service integration tests
│   ├── database.test.ts   # Database operations
│   ├── redis.test.ts      # Redis pub/sub
│   ├── websocket.test.ts  # WebSocket connections
│   └── market-data.test.ts # Market data providers
├── workflows/             # Complete workflows
│   ├── trading.test.ts    # Full trading workflow
│   ├── backtest.test.ts   # Backtest workflow
│   └── alerts.test.ts     # Alert workflow
├── helpers/               # Test utilities
│   ├── setup.ts          # Test setup/teardown
│   ├── factories.ts      # Test data factories
│   └── assertions.ts     # Custom assertions
└── README.md
```

## Running Tests

```bash
# All integration tests
npm run test:integration

# Specific test file
npm run test:integration -- api/auth.test.ts

# Watch mode
npm run test:integration:watch

# With coverage
npm run test:integration:coverage
```

## Test Environment

Integration tests require:
- PostgreSQL database (test instance)
- Redis server (test instance)
- Environment variables configured

### Setup

```bash
# Start test infrastructure
npm run test:db:start

# Run migrations
npm run db:migrate

# Seed test data (optional)
npm run test:db:seed
```

### Teardown

```bash
# Stop and clean test infrastructure
npm run test:db:clean
```

## Writing Integration Tests

### Example: API Endpoint Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '../helpers/setup';
import { createTestUser } from '../helpers/factories';

describe('Auth API', () => {
  let server: any;
  let token: string;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should register a new user', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('token');
  });

  it('should login with valid credentials', async () => {
    const user = await createTestUser();
    
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: user.email,
        password: 'password123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('token');
    token = response.json().token;
  });

  it('should get user profile with valid token', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('email');
  });
});
```

### Example: Service Integration Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '@trading-bot/database';
import { RedisService } from '@trade/shared';

describe('Database + Redis Integration', () => {
  let db: DatabaseService;
  let redis: RedisService;

  beforeAll(async () => {
    db = new DatabaseService(process.env.TEST_DATABASE_URL!);
    redis = new RedisService(process.env.TEST_REDIS_URL!);
    await db.connect();
    await redis.connect();
  });

  afterAll(async () => {
    await db.disconnect();
    await redis.disconnect();
  });

  it('should cache database queries in Redis', async () => {
    const userId = 'test-user-123';
    
    // First call - hits database
    const user1 = await db.users.findById(userId);
    
    // Cache in Redis
    await redis.set(`user:${userId}`, JSON.stringify(user1), 60);
    
    // Second call - hits cache
    const cached = await redis.get(`user:${userId}`);
    const user2 = JSON.parse(cached!);
    
    expect(user1).toEqual(user2);
  });
});
```

## Test Data Management

### Factories

Use factories to create consistent test data:

```typescript
// helpers/factories.ts
export async function createTestUser(overrides = {}) {
  return await db.users.create({
    email: `test-${Date.now()}@example.com`,
    password: await hash('password123'),
    name: 'Test User',
    ...overrides
  });
}

export async function createTestSignal(overrides = {}) {
  return await db.signals.create({
    symbol: 'BTCUSDT',
    type: 'LONG',
    confidence: 0.75,
    price: 50000,
    ...overrides
  });
}
```

### Cleanup

Always clean up test data:

```typescript
afterEach(async () => {
  await db.users.deleteMany({ email: { $like: 'test-%' } });
  await db.signals.deleteMany({ createdAt: { $gt: testStartTime } });
  await redis.flushdb();
});
```

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Use transactions** - Rollback after each test
3. **Mock external APIs** - Don't call real exchanges
4. **Test error cases** - Not just happy paths
5. **Use realistic data** - Match production patterns
6. **Clean up resources** - Close connections, delete data
7. **Fast tests** - Keep under 5 seconds per test
8. **Clear assertions** - Use descriptive expect messages

## Common Patterns

### Testing Authentication

```typescript
it('should reject invalid tokens', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: 'Bearer invalid-token'
    }
  });

  expect(response.statusCode).toBe(401);
});
```

### Testing Database Operations

```typescript
it('should handle concurrent writes', async () => {
  const promises = Array.from({ length: 10 }, (_, i) =>
    db.trades.create({ symbol: 'BTCUSDT', amount: i })
  );

  await Promise.all(promises);
  
  const trades = await db.trades.findMany({ symbol: 'BTCUSDT' });
  expect(trades).toHaveLength(10);
});
```

### Testing WebSocket

```typescript
it('should broadcast market ticks', async () => {
  const ws = await createWebSocketClient();
  const received: any[] = [];

  ws.on('message', (data) => {
    received.push(JSON.parse(data));
  });

  await redis.publish('market:ticks', JSON.stringify({
    symbol: 'BTCUSDT',
    price: 50000
  }));

  await sleep(100);
  
  expect(received).toHaveLength(1);
  expect(received[0].symbol).toBe('BTCUSDT');
});
```

## Troubleshooting

### Database connection errors
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $TEST_DATABASE_URL
```

### Redis connection errors
```bash
# Check if Redis is running
docker ps | grep redis

# Test connection
redis-cli -u $TEST_REDIS_URL ping
```

### Slow tests
```bash
# Run with profiling
npm run test:integration -- --reporter=verbose --profile

# Identify slow queries
# Enable query logging in PostgreSQL
```

## CI/CD Integration

Integration tests run on every PR:

```yaml
# .github/workflows/test.yml
- name: Run integration tests
  run: npm run test:integration
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    TEST_REDIS_URL: redis://localhost:6379
```

## Coverage Goals

- All API endpoints: 100%
- Service integrations: >90%
- Error handling: >80%
- Edge cases: >70%
