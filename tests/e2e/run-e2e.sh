#!/bin/bash

# E2E Test Runner Script
# This script manages the complete E2E test lifecycle

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="tests/e2e/docker-compose.test.yml"
MAX_WAIT_TIME=60
CHECK_INTERVAL=2

echo -e "${GREEN}=== E2E Test Runner ===${NC}\n"

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running${NC}"
        exit 1
    fi
}

# Function to wait for services to be healthy
wait_for_services() {
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

    local elapsed=0
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        local healthy_count=$(docker compose -f "$DOCKER_COMPOSE_FILE" ps --format json 2>/dev/null | \
            jq -r 'select(.Health == "healthy" or .State == "running")' | \
            wc -l)

        if [ "$healthy_count" -ge 3 ]; then
            echo -e "${GREEN}All services are healthy!${NC}\n"
            return 0
        fi

        echo -n "."
        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
    done

    echo -e "\n${RED}Error: Services did not become healthy in time${NC}"
    docker compose -f "$DOCKER_COMPOSE_FILE" ps
    docker compose -f "$DOCKER_COMPOSE_FILE" logs
    return 1
}

# Function to setup test infrastructure
setup() {
    echo -e "${YELLOW}Setting up test infrastructure...${NC}"

    check_docker

    # Stop any existing services
    docker compose -f "$DOCKER_COMPOSE_FILE" down -v > /dev/null 2>&1 || true

    # Start services
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d --build

    # Wait for services
    if ! wait_for_services; then
        teardown
        exit 1
    fi
}

# Function to run tests
run_tests() {
    echo -e "${YELLOW}Running E2E tests...${NC}\n"

    if npm run test:e2e:ci; then
        echo -e "\n${GREEN}Tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}Tests failed!${NC}"
        return 1
    fi
}

# Function to teardown test infrastructure
teardown() {
    echo -e "\n${YELLOW}Tearing down test infrastructure...${NC}"
    docker compose -f "$DOCKER_COMPOSE_FILE" down -v
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}Service logs:${NC}\n"
    docker compose -f "$DOCKER_COMPOSE_FILE" logs
}

# Main execution
case "${1:-run}" in
    setup)
        setup
        ;;
    test)
        run_tests
        ;;
    teardown)
        teardown
        ;;
    logs)
        show_logs
        ;;
    run)
        setup
        if run_tests; then
            teardown
            exit 0
        else
            echo -e "\n${YELLOW}Keeping services running for debugging${NC}"
            echo -e "${YELLOW}View logs with: $0 logs${NC}"
            echo -e "${YELLOW}Teardown with: $0 teardown${NC}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {setup|test|teardown|logs|run}"
        echo ""
        echo "Commands:"
        echo "  setup    - Start test infrastructure"
        echo "  test     - Run E2E tests"
        echo "  teardown - Stop test infrastructure"
        echo "  logs     - Show service logs"
        echo "  run      - Complete test cycle (default)"
        exit 1
        ;;
esac
