#!/bin/bash

# Test Database Runner Script
# Starts PostgreSQL test database and runs tests

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting test database...${NC}"

# Start docker-compose for test database
docker-compose -f docker-compose.test.yml up -d

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}PostgreSQL is ready!${NC}"
    break
  fi

  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}PostgreSQL failed to start after ${max_attempts} attempts${NC}"
    docker-compose -f docker-compose.test.yml logs postgres-test
    exit 1
  fi

  echo -e "${YELLOW}Waiting... (${attempt}/${max_attempts})${NC}"
  sleep 1
done

# Set test database environment variables
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_NAME=trading_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=postgres

# Run tests
echo -e "${GREEN}Running tests...${NC}"
npm test "$@"

# Capture test exit code
test_exit_code=$?

# Stop and clean up (optional - comment out to keep database running)
if [ "${KEEP_DB_RUNNING}" != "true" ]; then
  echo -e "${YELLOW}Stopping test database...${NC}"
  docker-compose -f docker-compose.test.yml down
fi

exit $test_exit_code
