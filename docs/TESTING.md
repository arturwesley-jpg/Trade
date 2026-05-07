# Testing Guide

## Overview

This document describes the complete testing strategy for the Crypto Trading Bot project, including unit tests, integration tests, and end-to-end (E2E) tests.

## Test Structure

```
Trade/
├── apps/
│   ├── api/src/app.test.ts          # API unit tests
│   ├── telegram-bot/src/*.test.ts   # Telegram bot tests
│   └── web/src/*.test.ts            # Frontend tests
├── packages/
│   └── */src/*.test.ts              # Package unit tests
└── tests/
    └── e2e/                         # E2E test suite
        ├── api.e2e.test.ts          # API E2E tests
        ├── integration.e2e.test.ts  # Integration tests
        ├── performance.e2e.test.ts  # Performance tests
        ├── helpers.ts               # Test utilities
        ├── setup.ts                 # Test setup
        ├── vitest.config.e2e.ts     # E2E config
        ├── docker-compose.test.yml  # Test infrastructure
        ├── mock-bingx-server.js     # Mock WebSocket server
        └── Dockerfile.mock-ws       # Mock server Docker
```

## Running Tests

### Unit Tests

Run all unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test -- --watch
```

### E2E Tests

#### Setup Test Infrastructure

Start Docker services (PostgreSQL, Redis, Mock WebSocket):
```bash
npm run test:e2e:setup
```

#### Run E2E Tests

Run all E2E tests:
```bash
npm run test:e2e
```

Run E2E tests in watch mode:
```bash
npm run test:e2e:watch
```

Run E2E tests with coverage:
```bash
npm run test:e2e:ci
```

#### Teardown Test Infrastructure

Stop and remove Docker services:
```bash
npm run test:e2e:teardown
```

## Test Infrastructure

### Docker Services

The E2E test suite uses Docker Compose to provide isolated test infrastructure:

1. **PostgreSQL Test Database**
   - Port: 5433
   - User: test_user
   - Password: test_password
   - Database: trade_test_db
   - Uses tmpfs for fast I/O

2. **Redis Test Instance**
   - Port: 6380
   - Uses tmpfs for fast I/O

3. **Mock BingX WebSocket Server**
   - Port: 8080
   - Endpoint: ws://localhost:8080/swap-market
   - Simulates real-time market data
   - Configurable tick interval

### Mock WebSocket Server

The mock BingX WebSocket server simulates real market data:

- Supports BTC-USDT and ETH-USDT symbols
- Generates realistic price movements (±0.1% variance)
- Configurable tick interval (default: 100ms)
- Health check endpoint: http://localhost:8080/health

## Test Categories

### 1. API E2E Tests (`api.e2e.test.ts`)

Tests complete API workflows:

#### Market Data Flow
- Worker publishes tick → API receives → Frontend updates
- Multiple concurrent ticks without data loss
- WebSocket real-time updates

#### Signal Generation Flow
- Market data → Technical indicators → Signal generation
- RSI, MACD, Bollinger Bands calculations
- Signal strength and direction

#### Order Execution Flow
- Signal → Order intent → Position opened
- Take profit execution
- Stop loss execution
- Idempotent order creation

#### Data Providers Integration
- CoinGecko market data
- Sentiment aggregation
- On-chain metrics

#### Position Closing Flow
- Position closure
- Trade history recording
- Audit log verification

### 2. Integration Tests (`integration.e2e.test.ts`)

Tests service integrations:

#### Redis PubSub
- Publish/subscribe messaging
- Multiple subscribers
- Connection failure handling

#### PostgreSQL
- CRUD operations
- Transaction rollback
- Concurrent writes without deadlock

#### WebSocket
- Connection to mock BingX server
- Multiple symbol subscriptions
- Reconnection after connection loss

#### Failure Scenarios
- PostgreSQL down → InMemory fallback
- Redis timeout handling
- API timeout with simulated data
- WebSocket reconnection

### 3. Performance Tests (`performance.e2e.test.ts`)

Tests system performance:

#### API Throughput
- 100 concurrent GET requests
- 50 concurrent POST requests
- Throughput measurement (req/s)

#### API Latency
- P50, P95, P99 latency metrics
- Latency under load

#### Memory Leak Detection
- Stable memory usage over time
- Resource cleanup verification
- Memory growth rate analysis

#### Performance Benchmarks
- API: 100+ req/s throughput
- Latency: P50 <50ms, P95 <200ms, P99 <500ms
- Memory: <20% growth rate, <50MB total growth

## Test Utilities

### Helper Functions (`helpers.ts`)

- `createTestContext()` - Creates isolated test environment
- `waitForRedisMessage()` - Waits for Redis pub/sub message
- `waitForWebSocketMessage()` - Waits for WebSocket message
- `waitForCondition()` - Polls until condition is met
- `generateIdempotencyKey()` - Generates unique keys
- `sleep()` - Async delay utility

## Coverage Requirements

Minimum coverage thresholds:
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

View coverage report:
```bash
npm run test:e2e:ci
# Open coverage/index.html in browser
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install
      - run: npm run test:e2e:setup
      - run: npm run test:e2e:ci
      - run: npm run test:e2e:teardown
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Best Practices

### Test Isolation
- Each test has independent setup/teardown
- Database and Redis are cleared between tests
- No shared state between tests

### Deterministic Tests
- Use fixed seeds for random data
- Mock external API calls
- Control time with fixed timestamps

### Fast Tests
- Use tmpfs for database/Redis (in-memory)
- Parallel test execution where possible
- Mock slow external services

### Readable Tests
- Descriptive test names
- Clear arrange-act-assert structure
- Meaningful assertions with good error messages

## Troubleshooting

### Docker Services Not Starting

Check Docker is running:
```bash
docker ps
```

View service logs:
```bash
docker compose -f tests/e2e/docker-compose.test.yml logs
```

### Tests Timing Out

Increase test timeout in `vitest.config.e2e.ts`:
```typescript
test: {
  testTimeout: 60000, // 60 seconds
}
```

### Port Conflicts

Check if ports are already in use:
```bash
lsof -i :5433  # PostgreSQL
lsof -i :6380  # Redis
lsof -i :8080  # Mock WebSocket
```

### Memory Issues

Run tests with increased memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run test:e2e
```

## Future Enhancements

- [ ] Visual regression testing for frontend
- [ ] Load testing with k6 or autocannon
- [ ] Chaos engineering tests (random failures)
- [ ] Contract testing for API
- [ ] Mutation testing for code quality
- [ ] Performance regression tracking
- [ ] Test data factories for complex scenarios
- [ ] Snapshot testing for API responses

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Fastify Testing](https://www.fastify.io/docs/latest/Guides/Testing/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
