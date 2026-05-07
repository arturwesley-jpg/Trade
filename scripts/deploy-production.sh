#!/bin/bash
set -e

# Deploy to Production Script
# Usage: ./scripts/deploy-production.sh [platform]
# Platforms: render, railway, fly

PLATFORM=${1:-render}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "PRODUCTION DEPLOYMENT"
echo "Platform: $PLATFORM"
echo "=========================================="

# Confirmation prompt
confirm_production_deploy() {
    echo ""
    echo "WARNING: You are about to deploy to PRODUCTION!"
    echo "This will affect live users and real trading operations."
    echo ""
    read -p "Are you absolutely sure? Type 'DEPLOY' to continue: " CONFIRMATION

    if [ "$CONFIRMATION" != "DEPLOY" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
}

# Check if required tools are installed
check_requirements() {
    echo ""
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
                exit 1
            fi
            ;;
        railway)
            if ! command -v railway &> /dev/null; then
                echo "Error: railway CLI is not installed"
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

    # Must be on main/master branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
        echo "Error: Must be on main/master branch for production deploy"
        echo "Current branch: $CURRENT_BRANCH"
        exit 1
    fi

    # No uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "Error: You have uncommitted changes"
        echo "Commit or stash changes before deploying to production"
        exit 1
    fi

    # Pull latest changes
    echo "Pulling latest changes..."
    git pull origin "$CURRENT_BRANCH"

    echo "Pre-deployment checks passed!"
}

# Create backup
create_backup() {
    echo ""
    echo "Creating backup..."

    BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"
    git tag -a "$BACKUP_TAG" -m "Backup before production deployment"
    git push origin "$BACKUP_TAG"

    echo "Backup created: $BACKUP_TAG"
}

# Build and test Docker images
build_and_test_images() {
    echo ""
    echo "Building and testing Docker images..."

    cd "$PROJECT_ROOT"

    # Build images
    docker build -f apps/api/Dockerfile -t trade-api:production .
    docker build -f apps/worker/Dockerfile -t trade-worker:production .
    docker build -f apps/telegram-bot/Dockerfile -t trade-telegram-bot:production .
    docker build -f apps/web/Dockerfile -t trade-web:production .

    # Test images
    echo "Testing API image..."
    docker run --rm trade-api:production node -e "console.log('API image OK')"

    echo "Docker images built and tested successfully!"
}

# Deploy to Render
deploy_render() {
    echo ""
    echo "Deploying to Render..."

    if [ -z "$RENDER_DEPLOY_HOOK_PRODUCTION" ]; then
        echo "Error: RENDER_DEPLOY_HOOK_PRODUCTION environment variable not set"
        exit 1
    fi

    curl -X POST "$RENDER_DEPLOY_HOOK_PRODUCTION"

    echo "Deployment triggered on Render!"
}

# Deploy to Railway
deploy_railway() {
    echo ""
    echo "Deploying to Railway..."

    cd "$PROJECT_ROOT"
    railway up --environment production

    echo "Deployment completed on Railway!"
}

# Deploy to Fly.io
deploy_fly() {
    echo ""
    echo "Deploying to Fly.io..."

    cd "$PROJECT_ROOT"
    flyctl deploy --config infra/fly.toml --remote-only

    echo "Deployment completed on Fly.io!"
}

# Wait for deployment
wait_for_deployment() {
    echo ""
    echo "Waiting for deployment to be ready..."

    MAX_ATTEMPTS=60
    ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f -s "$PRODUCTION_API_URL/health" > /dev/null 2>&1; then
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

# Run production smoke tests
run_smoke_tests() {
    echo ""
    echo "Running production smoke tests..."

    if [ -z "$PRODUCTION_API_URL" ]; then
        echo "Error: PRODUCTION_API_URL not set"
        return 1
    fi

    # Test health endpoint
    if ! curl -f -s "$PRODUCTION_API_URL/health" > /dev/null; then
        echo "Error: Health check failed"
        return 1
    fi

    # Test API responsiveness
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$PRODUCTION_API_URL/health")
    echo "API response time: ${RESPONSE_TIME}s"

    echo "Smoke tests passed!"
}

# Create release tag
create_release_tag() {
    echo ""
    echo "Creating release tag..."

    RELEASE_TAG="v$(date +%Y%m%d-%H%M%S)"
    git tag -a "$RELEASE_TAG" -m "Production release"
    git push origin "$RELEASE_TAG"

    echo "Release tag created: $RELEASE_TAG"
}

# Main deployment flow
main() {
    confirm_production_deploy
    check_requirements
    pre_deploy_checks
    create_backup
    build_and_test_images

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
            exit 1
            ;;
    esac

    if ! wait_for_deployment; then
        echo ""
        echo "=========================================="
        echo "DEPLOYMENT FAILED"
        echo "Run ./scripts/rollback.sh to revert"
        echo "=========================================="
        exit 1
    fi

    if ! run_smoke_tests; then
        echo ""
        echo "=========================================="
        echo "SMOKE TESTS FAILED"
        echo "Run ./scripts/rollback.sh to revert"
        echo "=========================================="
        exit 1
    fi

    create_release_tag

    echo ""
    echo "=========================================="
    echo "PRODUCTION DEPLOYMENT SUCCESSFUL!"
    echo "Release: $RELEASE_TAG"
    echo "=========================================="
}

main
