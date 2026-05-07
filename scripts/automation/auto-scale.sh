#!/bin/bash

# Auto-scaling script for Trading Bot
# Monitors metrics and scales deployments accordingly

set -e

# Configuration
NAMESPACE="${NAMESPACE:-trading-bot}"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus:9090}"

# Thresholds
CPU_SCALE_UP_THRESHOLD=70
CPU_SCALE_DOWN_THRESHOLD=30
MEMORY_SCALE_UP_THRESHOLD=80
MEMORY_SCALE_DOWN_THRESHOLD=40
REQUEST_RATE_THRESHOLD=1000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Get current replica count
get_replicas() {
    local deployment=$1
    kubectl get deployment "$deployment" -n "$NAMESPACE" \
        -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0"
}

# Get CPU usage
get_cpu_usage() {
    local deployment=$1
    local query="avg(rate(container_cpu_usage_seconds_total{namespace=\"$NAMESPACE\",pod=~\"$deployment.*\"}[5m])) * 100"

    curl -s "${PROMETHEUS_URL}/api/v1/query?query=${query}" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0"
}

# Get memory usage
get_memory_usage() {
    local deployment=$1
    local query="avg(container_memory_working_set_bytes{namespace=\"$NAMESPACE\",pod=~\"$deployment.*\"} / container_spec_memory_limit_bytes{namespace=\"$NAMESPACE\",pod=~\"$deployment.*\"}) * 100"

    curl -s "${PROMETHEUS_URL}/api/v1/query?query=${query}" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0"
}

# Get request rate
get_request_rate() {
    local deployment=$1
    local query="sum(rate(http_requests_total{namespace=\"$NAMESPACE\",pod=~\"$deployment.*\"}[1m]))"

    curl -s "${PROMETHEUS_URL}/api/v1/query?query=${query}" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0"
}

# Scale deployment
scale_deployment() {
    local deployment=$1
    local replicas=$2

    log_info "Scaling $deployment to $replicas replicas..."

    kubectl scale deployment "$deployment" -n "$NAMESPACE" --replicas="$replicas"

    if [ $? -eq 0 ]; then
        log_success "Successfully scaled $deployment to $replicas replicas"
        return 0
    else
        log_error "Failed to scale $deployment"
        return 1
    fi
}

# Check and scale based on metrics
check_and_scale() {
    local deployment=$1
    local min_replicas=$2
    local max_replicas=$3

    local current_replicas=$(get_replicas "$deployment")
    local cpu_usage=$(get_cpu_usage "$deployment")
    local memory_usage=$(get_memory_usage "$deployment")
    local request_rate=$(get_request_rate "$deployment")

    log_info "=== $deployment ==="
    log_info "Current replicas: $current_replicas"
    log_info "CPU usage: ${cpu_usage}%"
    log_info "Memory usage: ${memory_usage}%"
    log_info "Request rate: ${request_rate} req/s"

    local new_replicas=$current_replicas
    local should_scale=false

    # Scale up conditions
    if (( $(echo "$cpu_usage > $CPU_SCALE_UP_THRESHOLD" | bc -l) )) || \
       (( $(echo "$memory_usage > $MEMORY_SCALE_UP_THRESHOLD" | bc -l) )) || \
       (( $(echo "$request_rate > $REQUEST_RATE_THRESHOLD" | bc -l) )); then

        new_replicas=$((current_replicas + 2))
        should_scale=true
        log_warning "Scale up triggered"

    # Scale down conditions
    elif (( $(echo "$cpu_usage < $CPU_SCALE_DOWN_THRESHOLD" | bc -l) )) && \
         (( $(echo "$memory_usage < $MEMORY_SCALE_DOWN_THRESHOLD" | bc -l) )) && \
         (( $(echo "$request_rate < $((REQUEST_RATE_THRESHOLD / 2))" | bc -l) )); then

        new_replicas=$((current_replicas - 1))
        should_scale=true
        log_warning "Scale down triggered"
    fi

    # Apply limits
    if [ $new_replicas -lt $min_replicas ]; then
        new_replicas=$min_replicas
    fi

    if [ $new_replicas -gt $max_replicas ]; then
        new_replicas=$max_replicas
    fi

    # Scale if needed
    if [ "$should_scale" = true ] && [ $new_replicas -ne $current_replicas ]; then
        scale_deployment "$deployment" "$new_replicas"
    else
        log_success "No scaling needed"
    fi

    echo ""
}

# Main monitoring loop
main() {
    log_info "=== Auto-scaling Monitor Started ==="
    log_info "Namespace: $NAMESPACE"
    log_info "Check interval: ${CHECK_INTERVAL}s"
    log_info "Prometheus: $PROMETHEUS_URL"
    echo ""

    while true; do
        # Check API deployment
        check_and_scale "trading-bot-api" 2 10

        # Check Web deployment
        check_and_scale "trading-bot-web" 2 8

        # Wait before next check
        log_info "Waiting ${CHECK_INTERVAL}s before next check..."
        sleep "$CHECK_INTERVAL"
    done
}

# Handle signals
trap 'log_info "Shutting down auto-scaling monitor..."; exit 0' SIGTERM SIGINT

# Run main
main
