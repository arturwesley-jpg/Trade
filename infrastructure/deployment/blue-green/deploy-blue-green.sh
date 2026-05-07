#!/bin/bash

# Blue-Green Deployment Script for Trading Bot
# This script performs zero-downtime deployments using blue-green strategy

set -e

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE="${NAMESPACE:-trading-bot}"
SERVICE_NAME="${SERVICE_NAME:-trading-bot-api}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3000/api/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
SMOKE_TEST_TIMEOUT="${SMOKE_TEST_TIMEOUT:-60}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current active environment (blue or green)
get_active_environment() {
    kubectl get service ${SERVICE_NAME} -n ${NAMESPACE} \
        -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "blue"
}

# Get inactive environment
get_inactive_environment() {
    local active=$(get_active_environment)
    if [ "$active" == "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Deploy to inactive environment
deploy_inactive() {
    local inactive=$(get_inactive_environment)
    local active=$(get_active_environment)

    log_info "Current active environment: ${active}"
    log_info "Deploying to inactive environment: ${inactive}"

    # Update deployment with new image
    kubectl set image deployment/${SERVICE_NAME}-${inactive} \
        ${SERVICE_NAME}=${SERVICE_NAME}:${IMAGE_TAG} \
        -n ${NAMESPACE}

    # Wait for rollout to complete
    log_info "Waiting for deployment to complete..."
    kubectl rollout status deployment/${SERVICE_NAME}-${inactive} \
        -n ${NAMESPACE} \
        --timeout=${HEALTH_CHECK_TIMEOUT}s

    log_success "Deployment to ${inactive} environment completed"
}

# Health check
health_check() {
    local environment=$1
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / 5))
    local attempt=0

    log_info "Running health check on ${environment} environment..."

    # Get pod IP
    local pod_ip=$(kubectl get pods -n ${NAMESPACE} \
        -l app=${SERVICE_NAME},version=${environment} \
        -o jsonpath='{.items[0].status.podIP}' 2>/dev/null)

    if [ -z "$pod_ip" ]; then
        log_error "Could not get pod IP for ${environment} environment"
        return 1
    fi

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "http://${pod_ip}:3000/api/health" > /dev/null 2>&1; then
            log_success "Health check passed for ${environment} environment"
            return 0
        fi

        attempt=$((attempt + 1))
        log_info "Health check attempt ${attempt}/${max_attempts}..."
        sleep 5
    done

    log_error "Health check failed for ${environment} environment"
    return 1
}

# Smoke tests
run_smoke_tests() {
    local environment=$1

    log_info "Running smoke tests on ${environment} environment..."

    # Get pod IP
    local pod_ip=$(kubectl get pods -n ${NAMESPACE} \
        -l app=${SERVICE_NAME},version=${environment} \
        -o jsonpath='{.items[0].status.podIP}')

    local base_url="http://${pod_ip}:3000"

    # Test 1: Health endpoint
    if ! curl -sf "${base_url}/api/health" | grep -q "ok"; then
        log_error "Smoke test failed: Health endpoint"
        return 1
    fi
    log_success "✓ Health endpoint"

    # Test 2: Metrics endpoint
    if ! curl -sf "${base_url}/api/metrics" > /dev/null; then
        log_error "Smoke test failed: Metrics endpoint"
        return 1
    fi
    log_success "✓ Metrics endpoint"

    # Test 3: Database connectivity
    if ! curl -sf "${base_url}/api/health/db" | grep -q "connected"; then
        log_error "Smoke test failed: Database connectivity"
        return 1
    fi
    log_success "✓ Database connectivity"

    # Test 4: Redis connectivity
    if ! curl -sf "${base_url}/api/health/redis" | grep -q "connected"; then
        log_error "Smoke test failed: Redis connectivity"
        return 1
    fi
    log_success "✓ Redis connectivity"

    log_success "All smoke tests passed for ${environment} environment"
    return 0
}

# Switch traffic to new environment
switch_traffic() {
    local new_environment=$1
    local old_environment=$(get_active_environment)

    log_info "Switching traffic from ${old_environment} to ${new_environment}..."

    # Update service selector to point to new environment
    kubectl patch service ${SERVICE_NAME} -n ${NAMESPACE} \
        -p "{\"spec\":{\"selector\":{\"version\":\"${new_environment}\"}}}"

    # Wait a moment for changes to propagate
    sleep 5

    # Verify traffic switch
    local current=$(get_active_environment)
    if [ "$current" == "$new_environment" ]; then
        log_success "Traffic successfully switched to ${new_environment}"
        return 0
    else
        log_error "Traffic switch failed"
        return 1
    fi
}

# Rollback to previous environment
rollback() {
    local previous_environment=$1

    log_warning "Rolling back to ${previous_environment} environment..."

    kubectl patch service ${SERVICE_NAME} -n ${NAMESPACE} \
        -p "{\"spec\":{\"selector\":{\"version\":\"${previous_environment}\"}}}"

    log_success "Rollback completed"
}

# Scale down old environment
scale_down_old() {
    local old_environment=$1

    log_info "Scaling down ${old_environment} environment..."

    kubectl scale deployment/${SERVICE_NAME}-${old_environment} \
        -n ${NAMESPACE} \
        --replicas=0

    log_success "${old_environment} environment scaled down"
}

# Main deployment flow
main() {
    log_info "=== Blue-Green Deployment Started ==="
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Namespace: ${NAMESPACE}"
    log_info "Service: ${SERVICE_NAME}"
    log_info "Image Tag: ${IMAGE_TAG}"
    echo ""

    # Get environments
    local active=$(get_active_environment)
    local inactive=$(get_inactive_environment)

    # Step 1: Deploy to inactive environment
    log_info "Step 1: Deploying to inactive environment (${inactive})..."
    if ! deploy_inactive; then
        log_error "Deployment failed"
        exit 1
    fi
    echo ""

    # Step 2: Health check
    log_info "Step 2: Running health checks..."
    if ! health_check "$inactive"; then
        log_error "Health check failed"
        exit 1
    fi
    echo ""

    # Step 3: Smoke tests
    log_info "Step 3: Running smoke tests..."
    if ! run_smoke_tests "$inactive"; then
        log_error "Smoke tests failed"
        exit 1
    fi
    echo ""

    # Step 4: Switch traffic
    log_info "Step 4: Switching traffic to ${inactive} environment..."
    if ! switch_traffic "$inactive"; then
        log_error "Traffic switch failed, rolling back..."
        rollback "$active"
        exit 1
    fi
    echo ""

    # Step 5: Monitor new environment
    log_info "Step 5: Monitoring new environment for 30 seconds..."
    sleep 30

    if ! health_check "$inactive"; then
        log_error "Post-switch health check failed, rolling back..."
        rollback "$active"
        exit 1
    fi
    echo ""

    # Step 6: Scale down old environment (optional)
    log_info "Step 6: Keeping old environment (${active}) for quick rollback..."
    log_info "To scale down old environment, run:"
    log_info "  kubectl scale deployment/${SERVICE_NAME}-${active} -n ${NAMESPACE} --replicas=0"
    echo ""

    log_success "=== Blue-Green Deployment Completed Successfully ==="
    log_success "Active environment: ${inactive}"
    log_success "Previous environment: ${active} (still running for quick rollback)"
    echo ""
    log_info "To rollback, run:"
    log_info "  ./switch-traffic.sh ${active}"
}

# Run main function
main
