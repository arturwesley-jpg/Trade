# Test Database Setup Guide

This guide explains how to run integration tests that require a PostgreSQL database.

## Overview

The notification system integration tests require a PostgreSQL database. The test suite will automatically skip these tests if PostgreSQL is not available, allowing unit tests to run without database dependencies.

## Quick Start

### Option 1: Using Docker Compose (Recommended)

Start the test database and run all tests:

```bash
./scripts/test-with-db.sh
```

This script will:
1. Start PostgreSQL and Redis in Docker containers
2. Wait for PostgreSQL to be ready
3. Run the test suite with database connection
4. Stop the containers after tests complete

To keep the database running after tests:

```bash
KEEP_DB_RUNNING=true ./scripts/test-with-db.sh
```

### Option 2: Manual Docker Compose

Start the test database:

```bash
docker-compose -f docker-compose.test.yml up -d
```

Run tests:

```bash
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_NAME=trading_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=postgres

npm test
```

Stop the test database:

```bash
docker-compose -f docker-compose.test.yml down
```

### Option 3: Local PostgreSQL

If you have PostgreSQL installed locally:

1. Create test database:

```bash
createdb trading_test
```

2. Set environment variables:

```bash
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_NAME=trading_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=your_password
```

3. Run tests:

```bash
npm test
```

## Environment Variables

The test suite uses these environment variables for database connection:

- `TEST_DB_HOST` - Database host (default: localhost)
- `TEST_DB_PORT` - Database port (default: 5432)
- `TEST_DB_NAME` - Database name (default: trading_test)
- `TEST_DB_USER` - Database user (default: postgres)
- `TEST_DB_PASSWORD` - Database password (default: postgres)

## Test Behavior

### With Database Available

When PostgreSQL is available, the test suite will:

1. Create database schema from `packages/trading-core/src/notifications/schema.sql`
2. Insert test fixtures (users, templates)
3. Run all integration tests
4. Clean up data between tests
5. Drop all tables after tests complete

### Without Database Available

When PostgreSQL is not available:

- Integration tests are automatically skipped
- A warning message is displayed
- Unit tests continue to run normally
- Test suite exits with success (skipped tests don't fail the build)

## CI/CD Integration

### GitHub Actions

Add this step to your workflow before running tests:

```yaml
- name: Start test database
  run: docker-compose -f docker-compose.test.yml up -d

- name: Wait for PostgreSQL
  run: |
    for i in {1..30}; do
      if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres; then
        echo "PostgreSQL is ready"
        break
      fi
      echo "Waiting for PostgreSQL... ($i/30)"
      sleep 1
    done

- name: Run tests
  env:
    TEST_DB_HOST: localhost
    TEST_DB_PORT: 5432
    TEST_DB_NAME: trading_test
    TEST_DB_USER: postgres
    TEST_DB_PASSWORD: postgres
  run: npm test

- name: Stop test database
  if: always()
  run: docker-compose -f docker-compose.test.yml down
```

Or use the script:

```yaml
- name: Run tests with database
  run: ./scripts/test-with-db.sh
```

## Troubleshooting

### Port 5432 already in use

If you have PostgreSQL running locally on port 5432:

1. Stop local PostgreSQL temporarily
2. Or modify `docker-compose.test.yml` to use a different port:

```yaml
ports:
  - "5433:5432"  # Use port 5433 on host
```

Then set `TEST_DB_PORT=5433` when running tests.

### Connection refused errors

If tests fail with `ECONNREFUSED`:

1. Check if PostgreSQL container is running:

```bash
docker-compose -f docker-compose.test.yml ps
```

2. Check PostgreSQL logs:

```bash
docker-compose -f docker-compose.test.yml logs postgres-test
```

3. Verify PostgreSQL is ready:

```bash
docker-compose -f docker-compose.test.yml exec postgres-test pg_isready -U postgres
```

### Schema creation fails

If schema creation fails:

1. Check the schema file exists:

```bash
ls -la packages/trading-core/src/notifications/schema.sql
```

2. Manually test schema:

```bash
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U postgres -d trading_test < packages/trading-core/src/notifications/schema.sql
```

## Test Database Schema

The test database includes:

- `notifications` - Notification records
- `notification_preferences` - User notification preferences
- `notification_templates` - Notification templates
- `notification_delivery_log` - Delivery tracking
- `alerts` - Alert definitions
- `alert_rules` - Alert rule configurations
- `alert_events` - Alert event history

See `packages/trading-core/src/notifications/schema.sql` for complete schema.

## Cleaning Up

Remove test database volumes:

```bash
docker-compose -f docker-compose.test.yml down -v
```

This will delete all test data and free up disk space.
