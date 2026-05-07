#!/bin/bash
set -e

# Deploy to Staging Script
# Usage: ./scripts/deploy-staging.sh [platform]
# Platforms: render, railway, fly

PLATFORM=${1:-render}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Deploying to Staging Environment"
echo "Platform: $PLATFORM"
echo "=========================================="

# Check if required tools are installed
check_requirements() {
    echo "Checking requirements..."

    if ! command -v git &> /dev/null; then
        echo "Error: git is not installed"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo "Error: docker is not installed"
        exit 1
    fi

    case $PLATFORM in
        fly)
            if ! command -v flyctl &> /dev/null; then
                echo "Error: flyctl is not installed"
                echo "Install: curl -L https://fly.io/install.sh | sh"
                exit 1
            fi
            ;;
        railway)
            if ! command -v railway &> /dev/null; then
                echo "Error: railway CLI is not installed"
                echo "Install: npm i -g @railway/cli"
                exit 1
            fi
            ;;
    esac

    echo "All requirements met!"
}

# Run pre-deployment checks
pre_deploy_checks() {
    echo ""
    echo "Running pre-deployment checks..."

    # Check if on correct branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
        echo "Warning: Not on main/master branch (current: $CURRENT_BRANCH)"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "Warning: You have uncommitted changes"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    echo "Pre-deployment checks passed!"
}

# Build Docker images locally for testing
build_images() {
    echo ""
    echo "Building Docker images..."

    cd "$PROJECT_ROOT"

    docker build -f apps/api/Dockerfile -t trade-api:staging .
    docker build -f apps/worker/Dockerfile -t trade-worker:staging .
    docker build -f apps/telegram-bot/Dockerfile -t trade-telegram-bot:staging .
    docker build -f apps/web/Dockerfile -t trade-web:staging .

    echo "Docker images built successfully!"
}

# Deploy to Render
deploy_render() {
    echo ""
    echo "Deploying to Render..."

    if [ -z "$RENDER_DEPLOY_HOOK_STAGING" ]; then
        echo "Error: RENDER_DEPLOY_HOOK_STAGING environment variable not set"
        exit 1
    fi

    curl -X POST "$RENDER_DEPLOY_HOOK_STAGING"

    echo "Deployment triggered on Render!"
    echo "Check status at: https://dashboard.render.com"
}

# Deploy to Railway
deploy_railway() {
    echo ""
    echo "Deploying to Railway..."

    cd "$PROJECT_ROOT"
    railway up --environment staging

    echo "Deployment completed on Railway!"
    echo "Check status at: https://railway.app/dashboard"
}

# Deploy to Fly.io
deploy_fly() {
    echo ""
    echo "Deploying to Fly.io..."

    cd "$PROJECT_ROOT"

    # Deploy API
    flyctl deploy --config infra/fly.staging.toml --remote-only

    echo "Deployment completed on Fly.io!"
    echo "Check status at: https://fly.io/dashboard"
}

# Wait for deployment to be ready
wait_for_deployment() {
    echo ""
    echo "Waiting for deployment to be ready..."

    MAX_ATTEMPTS=30
    ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f -s "$STAGING_API_URL/health" > /dev/null 2>&1; then
            echo "Deployment is ready!"
            return 0
        fi

        ATTEMPT=$((ATTEMPT + 1))
        echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting..."
        sleep 10
    done

    echo "Error: Deployment did not become ready in time"
    return 1
}

# Run smoke tests
run_smoke_tests() {
    echo ""
    echo "Running smoke tests..."

    if [ -z "$STAGING_API_URL" ]; then
        echo "Warning: STAGING_API_URL not set, skipping smoke tests"
        return 0
    fi

    # Test health endpoint
    if ! curl -f -s "$STAGING_API_URL/health" > /dev/null; then
        echo "Error: Health check failed"
        return 1
    fi

    echo "Smoke tests passed!"
}

# Main deployment flow
main() {
    check_requirements
    pre_deploy_checks
    build_images

    case $PLATFORM in
        render)
            deploy_render
            ;;
        railway)
            deploy_railway
            ;;
        fly)
            deploy_fly
            ;;
        *)
            echo "Error: Unknown platform '$PLATFORM'"
            echo "Supported platforms: render, railway, fly"
            exit 1
            ;;
    esac

    if [ -n "$STAGING_API_URL" ]; then
        wait_for_deployment
        run_smoke_tests
    fi

    echo ""
    echo "=========================================="
    echo "Staging Deployment Complete!"
    echo "=========================================="
}

main
