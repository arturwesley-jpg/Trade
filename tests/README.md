# Comprehensive Testing Infrastructure

## Overview

This directory contains a complete testing suite for the Trading Bot platform, covering all aspects from unit tests to chaos engineering.

## Test Categories

### 1. Load Testing (`/load`)
- **k6-based load tests** for realistic trading scenarios
- Tests: normal-load, stress, spike, endurance, peak-load
- Simulates 100-1000 concurrent users
- Measures latency, throughput, error rates

### 2. Integration Tests (`/integration`)
- **API endpoint testing** with real database
- **Service integration** tests (DB, Redis, WebSocket)
- **Authentication flows** end-to-end
- **Trading workflows** (signals, orders, positions)

### 3. E2E Tests (`/e2e`)
- **Complete user journeys** (signup → trade → backtest)
- **Frontend + Backend** integration
- **Real browser testing** with Playwright
- Docker-based test environment

### 4. Performance Tests (`/performance`)
- **Latency benchmarks** for critical paths
- **Memory profiling** and leak detection
- **Database query optimization** tests
- **Cache effectiveness** measurements

### 5. Security Tests (`/security`)
- **OWASP ZAP** automated scans
- **Penetration testing** scripts
- **Authentication/Authorization** tests
- **Input validation** and injection tests
- **Rate limiting** verification

### 6. Chaos Tests (`/chaos`)
- **Failure injection** (DB down, Redis down)
- **Network issues** simulation
- **Resource exhaustion** tests
- **Recovery verification**

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install k6 (load testing)
brew install k6  # macOS
# or
sudo apt-get install k6  # Ubuntu

# Install OWASP ZAP (security testing)
docker pull zaproxy/zap-stable

# Start test infrastructure
npm run test:db:start
```

### Running Tests

```bash
# All tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Load tests
npm run test:load

# Security tests
npm run test:security

# Chaos tests
npm run test:chaos

# Performance tests
npm run test:performance
```

## CI/CD Integration

All tests are integrated into GitHub Actions:

- **PR checks**: Unit + Integration tests
- **Nightly**: E2E + Load + Security tests
- **Weekly**: Chaos + Performance tests

## Test Coverage Goals

- **Unit tests**: >80% coverage
- **Integration tests**: All API endpoints
- **E2E tests**: All critical user flows
- **Load tests**: 1000 concurrent users
- **Security tests**: OWASP Top 10

## Documentation

- [Load Testing Guide](./load/README.md)
- [Integration Testing Guide](./integration/README.md)
- [E2E Testing Guide](./e2e/README.md)
- [Security Testing Guide](./security/README.md)
- [Chaos Testing Guide](./chaos/README.md)
- [Performance Testing Guide](./performance/README.md)

## Monitoring Test Results

- **Test reports**: `tests/reports/`
- **Coverage reports**: `coverage/`
- **Load test results**: `tests/load/results/`
- **Security scan results**: `tests/security/reports/`

## Best Practices

1. **Run tests locally** before pushing
2. **Keep tests fast** (unit tests < 1s each)
3. **Use test data factories** for consistency
4. **Clean up after tests** (database, files)
5. **Mock external services** in unit tests
6. **Use real services** in integration tests
7. **Document test scenarios** clearly
8. **Update tests** when features change

## Troubleshooting

### Tests failing locally
```bash
# Clean test database
npm run test:db:clean
npm run test:db:start

# Clear cache
rm -rf node_modules/.cache
```

### Slow tests
```bash
# Run specific test file
npm test -- path/to/test.ts

# Run with verbose output
npm test -- --reporter=verbose
```

### CI/CD failures
- Check GitHub Actions logs
- Verify environment variables
- Ensure test database is accessible
- Check for flaky tests

## Contributing

When adding new features:
1. Write unit tests first (TDD)
2. Add integration tests for API endpoints
3. Update E2E tests for user flows
4. Run full test suite before PR
5. Update test documentation

## Contact

For questions or issues with tests, contact the development team or open an issue on GitHub.
