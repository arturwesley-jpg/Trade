# E2E Testing CI/CD Integration - Quick Reference

## Quick Start

### Local Testing

```bash
# Full test cycle (recommended)
./tests/e2e/run-tests.sh full

# Setup infrastructure only
./tests/e2e/run-tests.sh setup

# Run tests
npm run test:e2e

# Run with coverage
npm run test:e2e:ci

# Watch mode
npm run test:e2e:watch

# Teardown
./tests/e2e/run-tests.sh teardown
```

### CI/CD Pipeline

Tests run automatically on:
- Push to main/develop
- Pull requests
- Nightly at 2 AM UTC

## Key Features

### 1. Parallel Execution (3 Shards)
- Reduces test time by ~66%
- Each shard runs independently
- Automatic test distribution

### 2. Automatic Retries
- 2 retries per failed test in CI
- Handles flaky tests automatically
- No retries in local development

### 3. Service Health Checks
- PostgreSQL (port 5433)
- Redis (port 6380)
- Mock BingX WebSocket (port 8080)

### 4. Comprehensive Reporting
- JSON results
- HTML interactive reports
- Coverage reports (LCOV, HTML)
- PR comments with results

### 5. Artifact Management
- Coverage: 30 days retention
- Test results: 30 days retention
- Screenshots/videos: 7 days retention (on failure)

## Workflow Files

- `.github/workflows/e2e-tests.yml` - Main E2E workflow
- `.github/workflows/e2e-nightly.yml` - Nightly full suite
- `.github/workflows/ci.yml` - Main CI pipeline

## Configuration

### Vitest Config
- **File**: `tests/e2e/vitest.config.e2e.ts`
- **Retry**: 2 in CI, 0 locally
- **Workers**: 3 max per shard
- **Timeout**: 30s per test

### Docker Services
- **File**: `tests/e2e/docker-compose.test.yml`
- **Services**: PostgreSQL, Redis, Mock BingX WS
- **Health checks**: All services monitored

## Scripts

```json
{
  "test:e2e": "Run E2E tests",
  "test:e2e:ci": "Run with coverage and reports",
  "test:e2e:watch": "Watch mode",
  "test:e2e:setup": "Setup infrastructure",
  "test:e2e:teardown": "Teardown infrastructure",
  "test:e2e:logs": "Show service logs",
  "test:e2e:status": "Show service status"
}
```

## Troubleshooting

### Tests Timeout
1. Check service health: `./tests/e2e/run-tests.sh status`
2. View logs: `./tests/e2e/run-tests.sh logs`
3. Increase timeout in workflow

### Flaky Tests
1. Retry logic enabled in CI (2 retries)
2. Use `test.retry(2)` for specific tests
3. Check test isolation

### Service Connection Issues
1. Verify ports: 5433, 6380, 8080
2. Check Docker: `docker ps`
3. Review health checks

## Monitoring

### GitHub Actions
- Test execution time per shard
- Success/failure rates
- Flaky test patterns

### Codecov
- Per-shard coverage
- Merged coverage report
- Coverage trends

## Best Practices

1. **Write isolated tests** - Each test independent
2. **Clean up data** - Always clean test data
3. **Set timeouts** - Appropriate for async ops
4. **Use descriptive names** - Clear test names
5. **Handle failures** - Proper error handling

## Documentation

Full documentation: `docs/E2E_CI_SETUP.md`

## Support

- Check GitHub Actions logs
- Review test artifacts
- Contact DevOps team
