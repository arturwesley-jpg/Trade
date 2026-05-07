#!/bin/bash

# Progressive Canary Rollout Script
# Gradually shifts traffic from stable to canary version

set -e

# Configuration
NAMESPACE="${NAMESPACE:-trading-bot}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-trading-bot-api}"
CANARY_IMAGE="${CANARY_IMAGE:-trading-bot-api:canary}"
STABLE_IMAGE="${STABLE_IMAGE:-trading-bot-api:stable}"
INITIAL_WEIGHT="${INITIAL_WEIGHT:-5}"
STEP_WEIGHT="${STEP_WEIGHT:-5}"
MAX_WEIGHT="${MAX_WEIGHT:-50}"
STEP_DURATION="${STEP_DURATION:-300}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-5}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if Flagger is installed
check_flagger() {
    if ! kubectl get crd canaries.flagger.app &> /dev/null; then
        log_error "Flagger CRD not found. Please install Flagger first."
        log_info "Install with: kubectl apply -k github.com/fluxcd/flagger//kustomize/istio"
        exit 1
    fi
    log_success "Flagger is installed"
}

# Deploy canary version
deploy_canary() {
    log_info "Deploying canary version: ${CANARY_IMAGE}"

    # Update canary deployment
    kubectl set image deployment/${DEPLOYMENT_NAME} \
        ${DEPLOYMENT_NAME}=${CANARY_IMAGE} \
        -n ${NAMESPACE}

    # Wait for canary pods to be ready
    kubectl wait --for=condition=ready pod \
        -l app=${DEPLOYMENT_NAME},version=canary \
        -n ${NAMESPACE} \
        --timeout=300s

    log_success "Canary deployment ready"
}

# Get current error rate
get_error_rate() {
    # Query Prometheus for error rate
    local error_rate=$(kubectl exec -n monitoring prometheus-0 -- \
        promtool query instant \
        'sum(rate(http_requests_total{job="trading-bot-api",status=~"5.."}[1m])) / sum(rate(http_requests_total{job="trading-bot-api"}[1m])) * 100' \
        2>/dev/null | grep -oP '\d+\.\d+' || echo "0")

    echo "$error_rate"
}

# Get current response time P99
get_response_time() {
    local p99=$(kubectl exec -n monitoring prometheus-0 -- \
        promtool query instant \
        'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="trading-bot-api"}[1m])) by (le)) * 1000' \
        2>/dev/null | grep -oP '\d+\.\d+' || echo "0")

    echo "$p99"
}

# Check canary health
check_canary_health() {
    local weight=$1

    log_info "Checking canary health at ${weight}% traffic..."

    # Get metrics
    local error_rate=$(get_error_rate)
    local response_time=$(get_response_time)

    log_info "Error rate: ${error_rate}%"
    log_info "Response time P99: ${response_time}ms"

    # Check thresholds
    if (( $(echo "$error_rate > $ERROR_THRESHOLD" | bc -l) )); then
        log_error "Error rate too high: ${error_rate}% (threshold: ${ERROR_THRESHOLD}%)"
        return 1
    fi

    if (( $(echo "$response_time > 500" | bc -l) )); then
        log_warning "Response time high: ${response_time}ms (threshold: 500ms)"
    fi

    log_success "Canary health check passed"
    return 0
}

# Shift traffic to canary
shift_traffic() {
    local weight=$1

    log_info "Shifting ${weight}% traffic to canary..."

    # Update Istio VirtualService or Flagger Canary
    kubectl patch canary ${DEPLOYMENT_NAME} -n ${NAMESPACE} \
        --type=merge \
        -p "{\"spec\":{\"analysis\":{\"stepWeight\":${STEP_WEIGHT},\"maxWeight\":${weight}}}}"

    log_success "Traffic shifted to ${weight}%"
}

# Rollback canary
rollback_canary() {
    log_error "Rolling back canary deployment..."

    # Shift all traffic back to stable
    kubectl patch canary ${DEPLOYMENT_NAME} -n ${NAMESPACE} \
        --type=merge \
        -p '{"spec":{"analysis":{"maxWeight":0}}}'

    # Scale down canary
    kubectl scale deployment/${DEPLOYMENT_NAME}-canary -n ${NAMESPACE} --replicas=0

    log_success "Rollback completed"
}

# Promote canary to stable
promote_canary() {
    log_info "Promoting canary to stable..."

    # Update stable deployment with canary image
    kubectl set image deployment/${DEPLOYMENT_NAME}-primary \
        ${DEPLOYMENT_NAME}=${CANARY_IMAGE} \
        -n ${NAMESPACE}

    # Wait for rollout
    kubectl rollout status deployment/${DEPLOYMENT_NAME}-primary -n ${NAMESPACE}

    # Shift all traffic to stable
    kubectl patch canary ${DEPLOYMENT_NAME} -n ${NAMESPACE} \
        --type=merge \
        -p '{"spec":{"analysis":{"maxWeight":0}}}'

    log_success "Canary promoted to stable"
}

# Main progressive rollout
main() {
    log_info "=== Progressive Canary Rollout Started ==="
    log_info "Namespace: ${NAMESPACE}"
    log_info "Deployment: ${DEPLOYMENT_NAME}"
    log_info "Canary Image: ${CANARY_IMAGE}"
    log_info "Initial Weight: ${INITIAL_WEIGHT}%"
    log_info "Step Weight: ${STEP_WEIGHT}%"
    log_info "Max Weight: ${MAX_WEIGHT}%"
    log_info "Step Duration: ${STEP_DURATION}s"
    echo ""

    # Check prerequisites
    check_flagger

    # Deploy canary
    deploy_canary

    # Progressive traffic shift
    current_weight=$INITIAL_WEIGHT

    while [ $current_weight -le $MAX_WEIGHT ]; do
        log_info "=== Traffic Weight: ${current_weight}% ==="

        # Shift traffic
        shift_traffic $current_weight

        # Wait for metrics to stabilize
        log_info "Waiting ${STEP_DURATION}s for metrics to stabilize..."
        sleep $STEP_DURATION

        # Check canary health
        if ! check_canary_health $current_weight; then
            log_error "Canary health check failed at ${current_weight}%"
            rollback_canary
            exit 1
        fi

        # Increase weight
        current_weight=$((current_weight + STEP_WEIGHT))
        echo ""
    done

    # All checks passed, promote canary
    log_success "All canary checks passed!"
    promote_canary

    log_success "=== Progressive Canary Rollout Completed ==="
}

# Run main
main
