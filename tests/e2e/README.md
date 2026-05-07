# E2E Test Suite

Complete end-to-end test suite for the Crypto Trading Bot project.

## Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Run with coverage
npm run test:e2e:ci

# Run in watch mode
npm run test:e2e:watch
```

## Structure

- `api.e2e.test.ts` - API workflow tests (15 tests)
- `integration.e2e.test.ts` - Service integration tests (13 tests)
- `performance.e2e.test.ts` - Performance and load tests (10 tests)
- `helpers.ts` - Test utilities and helpers
- `setup.ts` - Global test setup and teardown
- `vitest.config.e2e.ts` - Vitest configuration for E2E tests
- `docker-compose.test.yml` - Test infrastructure (PostgreSQL, Redis, Mock WebSocket)
- `mock-bingx-server.js` - Mock BingX WebSocket server
- `run-e2e.sh` - Test runner script

## Test Infrastructure

### Docker Services

1. **PostgreSQL** (port 5433)
   - Test database with tmpfs for fast I/O
   - Automatically cleared between tests

2. **Redis** (port 6380)
   - Test instance with tmpfs
   - Pub/sub messaging for real-time updates

3. **Mock BingX WebSocket** (port 8080)
   - Simulates real-time market data
   - Configurable tick interval
   - Health check endpoint

### Setup

```bash
# Start test infrastructure
npm run test:e2e:setup

# Stop test infrastructure
npm run test:e2e:teardown
```

## Test Categories

### API E2E Tests
- Market data flow (Worker → Redis → API → Frontend)
- Signal generation from market data
- Order execution (Signal → Order → Position → TP/SL)
- Data provider integrations (CoinGecko, sentiment, on-chain)
- Position closing and trade history

### Integration Tests
- Redis pub/sub messaging
- PostgreSQL CRUD and transactions
- WebSocket connections and subscriptions
- Telegram bot commands
- Failure scenarios and fallbacks

### Performance Tests
- API throughput (100+ req/s)
- Latency metrics (P50, P95, P99)
- Memory leak detection
- Resource cleanup verification

## Coverage

Target: 80% coverage across all metrics
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

View coverage report:
```bash
npm run test:e2e:ci
open coverage/index.html
```

## CI/CD

GitHub Actions workflow at `.github/workflows/e2e-tests.yml`:
- Runs on push and pull requests
- Uploads coverage to Codecov
- Uploads test artifacts
- Shows logs on failure

## Documentation

See `docs/TESTING.md` for complete testing guide.
