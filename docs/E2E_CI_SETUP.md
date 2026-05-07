# E2E Testing CI/CD Setup

## Overview

This document describes the CI/CD pipeline configuration for End-to-End (E2E) testing in the Trade project. The pipeline is designed to run comprehensive E2E tests automatically on every push and pull request, with advanced features like parallel execution, automatic retries, and detailed reporting.

## Pipeline Architecture

### Workflow File
- **Location**: `.github/workflows/e2e-tests.yml`
- **Triggers**: Push to main/develop branches, Pull Requests, Manual dispatch
- **Concurrency**: Cancels previous runs on the same branch to save resources

### Jobs Overview

1. **e2e-tests**: Main E2E test execution with parallel sharding
2. **merge-reports**: Combines results from all shards
3. **unit-tests**: Runs unit tests in parallel
4. **test-summary**: Final status check and summary

## Key Features

### 1. Parallel Test Execution (Sharding)

Tests are split across 3 parallel shards to reduce execution time:

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3]
    total-shards: [3]
```

**Benefits**:
- Reduces total test time by ~66%
- Each shard runs independently
- Failures in one shard don't stop others

**How it works**:
- Vitest automatically distributes tests across shards
- Each shard runs: `--shard=1/3`, `--shard=2/3`, `--shard=3/3`

### 2. Automatic Retry Logic

Failed tests are automatically retried to handle flaky tests:

```yaml
- name: Retry failed tests
  if: failure()
  run: npm run test:e2e:ci -- --retry=2
```

**Configuration**:
- In CI: 2 retries per failed test
- Locally: No retries (fail fast)
- Configured in `vitest.config.e2e.ts`

### 3. Service Health Checks

Ensures all Docker services are healthy before running tests:

```bash
timeout=60
while [ $elapsed -lt $timeout ]; do
  if docker compose ps | grep -q "healthy"; then
    exit 0
  fi
  sleep 5
done
```

**Services monitored**:
- PostgreSQL (port 5433)
- Redis (port 6380)
- Mock BingX WebSocket (port 8080)

### 4. Comprehensive Reporting

Multiple report formats are generated:

- **JSON**: Machine-readable test results
- **HTML**: Interactive test report with coverage
- **LCOV**: Coverage data for Codecov
- **Verbose**: Detailed console output

### 5. Artifact Management

Test artifacts are preserved for debugging:

**Always uploaded**:
- Coverage reports (30 days retention)
- Test results JSON (30 days retention)
- HTML reports (30 days retention)

**On failure only**:
- Screenshots (7 days retention)
- Videos (7 days retention)
- Service logs (7 days retention)

### 6. PR Comments

Automatic PR comments with test results:
- Test execution summary
- Coverage metrics
- Link to full results
- Shard-by-shard breakdown

## Test Infrastructure

### Docker Compose Services

**File**: `tests/e2e/docker-compose.test.yml`

Services:
1. **postgres-test**: PostgreSQL 16 with tmpfs for speed
2. **redis-test**: Redis 7 with tmpfs for speed
3. **mock-bingx-ws**: Mock WebSocket server for BingX API

All services include health checks to ensure readiness.

### Environment Variables

Required environment variables for E2E tests:

```bash
NODE_ENV=test
DATABASE_URL=postgresql://test_user:test_password@localhost:5433/trade_test_db
REDIS_URL=redis://localhost:6380
BINGX_WS_URL=ws://localhost:8080/swap-market
CI=true
```

## Running Tests

### Locally

```bash
# Setup test infrastructure
npm run test:e2e:setup

# Run all E2E tests
npm run test:e2e

# Run with coverage
npm run test:e2e:ci

# Run specific test file
npm run test:e2e -- api.e2e.test.ts

# Watch mode
npm run test:e2e:watch

# Teardown infrastructure
npm run test:e2e:teardown
```

### In CI

Tests run automatically on:
- Push to main/develop branches
- Pull requests to main/develop
- Manual workflow dispatch

### Manual Trigger

You can manually trigger the workflow with custom test patterns:

1. Go to Actions tab in GitHub
2. Select "E2E Tests" workflow
3. Click "Run workflow"
4. Optionally specify test pattern (e.g., `api`, `integration`)

## Performance Optimization

### Caching Strategy

1. **Node modules cache**: Speeds up dependency installation
2. **Docker layer cache**: Reuses Docker build layers
3. **Vitest cache**: Reuses test results when possible

### Parallel Execution

- 3 shards run simultaneously
- Each shard uses up to 3 worker threads
- Total parallelism: up to 9 concurrent test files

### Resource Limits

- Timeout: 30 minutes per shard
- Max workers: 3 per shard
- Max concurrency: 3 tests per worker

## Troubleshooting

### Tests Timing Out

If tests timeout:
1. Check service health in logs
2. Verify Docker containers are running
3. Increase timeout in workflow (default: 30 min)

### Flaky Tests

For flaky tests:
1. Check retry logic is enabled (CI only)
2. Review test isolation settings
3. Check for race conditions in test code
4. Use `test.retry(2)` for specific flaky tests

### Service Connection Issues

If services fail to connect:
1. Verify health check passes
2. Check port mappings (5433, 6380, 8080)
3. Review Docker Compose logs
4. Ensure network configuration is correct

### Coverage Threshold Failures

If coverage drops below 80%:
1. Review uncovered code in HTML report
2. Add tests for uncovered paths
3. Consider adjusting thresholds if appropriate

## Monitoring and Metrics

### GitHub Actions Metrics

Monitor in GitHub Actions dashboard:
- Test execution time per shard
- Success/failure rates
- Flaky test patterns
- Resource usage

### Codecov Integration

Coverage reports are uploaded to Codecov:
- Per-shard coverage
- Merged coverage report
- Coverage trends over time
- PR coverage diff

## Configuration Files

### Key Files

1. `.github/workflows/e2e-tests.yml` - Main workflow
2. `tests/e2e/vitest.config.e2e.ts` - Vitest configuration
3. `tests/e2e/docker-compose.test.yml` - Test infrastructure
4. `tests/e2e/setup.ts` - Test setup and teardown
5. `package.json` - Test scripts

### Vitest Configuration

Key settings in `vitest.config.e2e.ts`:

```typescript
{
  retry: process.env.CI ? 2 : 0,
  maxWorkers: 3,
  maxConcurrency: 3,
  reporters: ["verbose", "json", "html"],
  coverage: {
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  }
}
```

## Best Practices

### Writing E2E Tests

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Timeouts**: Set appropriate timeouts for async operations
4. **Assertions**: Use specific, meaningful assertions
5. **Naming**: Use descriptive test names

### CI/CD Best Practices

1. **Fast feedback**: Fail fast on critical errors
2. **Parallel execution**: Use sharding for large test suites
3. **Retry logic**: Handle transient failures automatically
4. **Artifact preservation**: Keep artifacts for debugging
5. **Clear reporting**: Provide actionable feedback

### Maintenance

1. **Regular updates**: Keep dependencies up to date
2. **Monitor flakiness**: Track and fix flaky tests
3. **Review coverage**: Maintain high coverage standards
4. **Optimize performance**: Continuously improve test speed
5. **Documentation**: Keep this document updated

## Integration with Main CI Pipeline

The E2E workflow integrates with the main CI pipeline (`ci.yml`):

1. E2E tests run in parallel with unit tests
2. Both must pass for CI success
3. Coverage reports are merged
4. Deployment blocked if tests fail

## Future Enhancements

Planned improvements:

1. **Visual regression testing**: Screenshot comparison
2. **Performance benchmarks**: Track test execution time
3. **Test result trends**: Historical test data analysis
4. **Slack notifications**: Alert on test failures
5. **Automatic issue creation**: Create issues for flaky tests

## Support

For issues or questions:
- Check GitHub Actions logs
- Review test output artifacts
- Consult team documentation
- Contact DevOps team

## References

- [Vitest Documentation](https://vitest.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Codecov Documentation](https://docs.codecov.com/)
