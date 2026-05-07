#!/bin/bash
set -e

# Rollback Script
# Usage: ./scripts/rollback.sh [platform] [backup-tag]

PLATFORM=${1:-render}
BACKUP_TAG=$2
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "ROLLBACK PROCEDURE"
echo "Platform: $PLATFORM"
echo "=========================================="

# Find latest backup tag if not provided
find_backup_tag() {
    if [ -z "$BACKUP_TAG" ]; then
        echo "Finding latest backup tag..."
        BACKUP_TAG=$(git tag -l "backup-*" | sort -r | head -n 1)

        if [ -z "$BACKUP_TAG" ]; then
            echo "Error: No backup tags found"
            exit 1
        fi

        echo "Latest backup: $BACKUP_TAG"
    fi
}

# Confirm rollback
confirm_rollback() {
    echo ""
    echo "WARNING: You are about to rollback to: $BACKUP_TAG"
    echo "This will revert the production environment to a previous state."
    echo ""
    read -p "Are you sure? Type 'ROLLBACK' to continue: " CONFIRMATION

    if [ "$CONFIRMATION" != "ROLLBACK" ]; then
        echo "Rollback cancelled."
        exit 0
    fi
}

# Checkout backup tag
checkout_backup() {
    echo ""
    echo "Checking out backup tag..."

    cd "$PROJECT_ROOT"
    git fetch --all --tags
    git checkout "$BACKUP_TAG"

    echo "Checked out: $BACKUP_TAG"
}

# Rollback on Render
rollback_render() {
    echo ""
    echo "Rolling back on Render..."

    if [ -z "$RENDER_DEPLOY_HOOK_PRODUCTION" ]; then
        echo "Error: RENDER_DEPLOY_HOOK_PRODUCTION not set"
        exit 1
    fi

    # Trigger deployment with backup tag
    curl -X POST "$RENDER_DEPLOY_HOOK_PRODUCTION"

    echo "Rollback triggered on Render!"
}

# Rollback on Railway
rollback_railway() {
    echo ""
    echo "Rolling back on Railway..."

    cd "$PROJECT_ROOT"

    # Get previous deployment
    PREVIOUS_DEPLOYMENT=$(railway deployment list --json | jq -r '.[1].id')

    if [ -z "$PREVIOUS_DEPLOYMENT" ]; then
        echo "Error: Could not find previous deployment"
        exit 1
    fi

    railway deployment rollback "$PREVIOUS_DEPLOYMENT"

    echo "Rollback completed on Railway!"
}

# Rollback on Fly.io
rollback_fly() {
    echo ""
    echo "Rolling back on Fly.io..."

    cd "$PROJECT_ROOT"

    # Deploy previous version
    flyctl deploy --config infra/fly.toml --remote-only

    echo "Rollback completed on Fly.io!"
}

# Wait for rollback to complete
wait_for_rollback() {
    echo ""
    echo "Waiting for rollback to complete..."

    MAX_ATTEMPTS=30
    ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f -s "$PRODUCTION_API_URL/health" > /dev/null 2>&1; then
            echo "Rollback is complete!"
            return 0
        fi

        ATTEMPT=$((ATTEMPT + 1))
        echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting..."
        sleep 10
    done

    echo "Error: Rollback did not complete in time"
    return 1
}

# Verify rollback
verify_rollback() {
    echo ""
    echo "Verifying rollback..."

    if [ -z "$PRODUCTION_API_URL" ]; then
        echo "Warning: PRODUCTION_API_URL not set, skipping verification"
        return 0
    fi

    # Test health endpoint
    if ! curl -f -s "$PRODUCTION_API_URL/health" > /dev/null; then
        echo "Error: Health check failed after rollback"
        return 1
    fi

    echo "Rollback verified successfully!"
}

# Return to main branch
return_to_main() {
    echo ""
    echo "Returning to main branch..."

    cd "$PROJECT_ROOT"
    MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
    git checkout "$MAIN_BRANCH"

    echo "Returned to $MAIN_BRANCH branch"
}

# Main rollback flow
main() {
    find_backup_tag
    confirm_rollback
    checkout_backup

    case $PLATFORM in
        render)
            rollback_render
            ;;
        railway)
            rollback_railway
            ;;
        fly)
            rollback_fly
            ;;
        *)
            echo "Error: Unknown platform '$PLATFORM'"
            exit 1
            ;;
    esac

    if ! wait_for_rollback; then
        echo ""
        echo "=========================================="
        echo "ROLLBACK FAILED"
        echo "Manual intervention required!"
        echo "=========================================="
        exit 1
    fi

    verify_rollback
    return_to_main

    echo ""
    echo "=========================================="
    echo "ROLLBACK SUCCESSFUL"
    echo "Reverted to: $BACKUP_TAG"
    echo "=========================================="
}

main
