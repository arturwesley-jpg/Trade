#!/bin/bash

# E2E Test Runner Script
# Provides convenient commands for running E2E tests locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Setup test infrastructure
setup_infrastructure() {
    print_info "Setting up test infrastructure..."
    npm run test:e2e:setup

    print_info "Waiting for services to be healthy..."
    local timeout=60
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if docker compose -f tests/e2e/docker-compose.test.yml ps | grep -q "healthy"; then
            print_success "All services are healthy!"
            docker compose -f tests/e2e/docker-compose.test.yml ps
            return 0
        fi
        echo -n "."
        sleep 2
        elapsed=$((elapsed + 2))
    done

    print_error "Services failed to become healthy in time"
    docker compose -f tests/e2e/docker-compose.test.yml ps
    docker compose -f tests/e2e/docker-compose.test.yml logs
    exit 1
}

# Teardown test infrastructure
teardown_infrastructure() {
    print_info "Tearing down test infrastructure..."
    npm run test:e2e:teardown
    print_success "Infrastructure torn down"
}

# Run tests
run_tests() {
    local pattern="${1:-}"
    local coverage="${2:-false}"

    print_info "Running E2E tests..."

    if [ "$coverage" = "true" ]; then
        if [ -n "$pattern" ]; then
            npm run test:e2e:ci -- "$pattern"
        else
            npm run test:e2e:ci
        fi
    else
        if [ -n "$pattern" ]; then
            npm run test:e2e -- "$pattern"
        else
            npm run test:e2e
        fi
    fi
}

# Show service logs
show_logs() {
    local service="${1:-}"

    if [ -n "$service" ]; then
        print_info "Showing logs for $service..."
        docker compose -f tests/e2e/docker-compose.test.yml logs -f "$service"
    else
        print_info "Showing logs for all services..."
        npm run test:e2e:logs
    fi
}

# Show service status
show_status() {
    print_info "Service status:"
    npm run test:e2e:status
}

# Clean up test artifacts
clean_artifacts() {
    print_info "Cleaning up test artifacts..."
    rm -rf tests/e2e/coverage
    rm -rf tests/e2e/html
    rm -f tests/e2e/*.log
    rm -f tests/e2e/test-results*.json
    rm -rf tests/e2e/screenshots
    rm -rf tests/e2e/videos
    print_success "Artifacts cleaned"
}

# Full test cycle
full_cycle() {
    local pattern="${1:-}"
    local coverage="${2:-true}"

    check_docker
    setup_infrastructure

    if run_tests "$pattern" "$coverage"; then
        print_success "All tests passed!"
        teardown_infrastructure
        exit 0
    else
        print_error "Tests failed!"
        print_info "Showing service logs..."
        show_logs
        teardown_infrastructure
        exit 1
    fi
}

# Watch mode
watch_mode() {
    check_docker
    setup_infrastructure

    print_info "Starting watch mode..."
    print_warning "Press Ctrl+C to stop"

    trap teardown_infrastructure EXIT

    npm run test:e2e:watch
}

# Help message
show_help() {
    cat << EOF
E2E Test Runner

Usage: $0 [command] [options]

Commands:
    setup           Setup test infrastructure
    teardown        Teardown test infrastructure
    run [pattern]   Run tests (optionally with pattern)
    watch           Run tests in watch mode
    full [pattern]  Full test cycle (setup, run, teardown)
    logs [service]  Show service logs (optionally for specific service)
    status          Show service status
    clean           Clean test artifacts
    help            Show this help message

Examples:
    $0 setup                    # Setup infrastructure
    $0 run                      # Run all tests
    $0 run api                  # Run tests matching 'api'
    $0 full                     # Full test cycle
    $0 full integration         # Full cycle for integration tests
    $0 watch                    # Watch mode
    $0 logs                     # Show all logs
    $0 logs postgres-test       # Show PostgreSQL logs
    $0 status                   # Show service status
    $0 clean                    # Clean artifacts
    $0 teardown                 # Teardown infrastructure

Environment Variables:
    DATABASE_URL    PostgreSQL connection string
    REDIS_URL       Redis connection string
    BINGX_WS_URL    BingX WebSocket URL
    NODE_ENV        Node environment (default: test)

EOF
}

# Main script
main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        setup)
            check_docker
            setup_infrastructure
            ;;
        teardown)
            teardown_infrastructure
            ;;
        run)
            check_docker
            run_tests "$@"
            ;;
        watch)
            watch_mode
            ;;
        full)
            full_cycle "$@"
            ;;
        logs)
            show_logs "$@"
            ;;
        status)
            show_status
            ;;
        clean)
            clean_artifacts
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
