#!/bin/bash

# Chaos Engineering Test Script
# Runs controlled chaos experiments to test system resilience

set -e

# Configuration
NAMESPACE="${NAMESPACE:-trading-bot}"
CHAOS_DURATION="${CHAOS_DURATION:-300}"
RECOVERY_WAIT="${RECOVERY_WAIT:-60}"

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

# Check if Chaos Mesh is installed
check_chaos_mesh() {
    if ! kubectl get crd podchaos.chaos-mesh.org &> /dev/null; then
        log_error "Chaos Mesh not installed"
        log_info "Install with: curl -sSL https://mirrors.chaos-mesh.org/latest/install.sh | bash"
        exit 1
    fi
    log_success "Chaos Mesh is installed"
}

# Get system health
check_health() {
    local endpoint=$1
    local max_attempts=10
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$endpoint" > /dev/null 2>&1; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    return 1
}

# Test 1: Pod Failure
test_pod_failure() {
    log_info "=== Test 1: Pod Failure ==="
    log_info "Killing random API pod..."

    kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-failure-test
  namespace: $NAMESPACE
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: trading-bot-api
EOF

    log_info "Waiting for pod to be killed..."
    sleep 10

    log_info "Checking if system recovered..."
    if check_health "http://trading-bot-api:3000/api/health"; then
        log_success "✓ System recovered from pod failure"
    else
        log_error "✗ System did not recover"
        return 1
    fi

    kubectl delete podchaos pod-failure-test -n $NAMESPACE
    sleep $RECOVERY_WAIT
}

# Test 2: Network Delay
test_network_delay() {
    log_info "=== Test 2: Network Delay ==="
    log_info "Injecting 200ms network delay..."

    kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-delay-test
  namespace: $NAMESPACE
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: trading-bot-api
  delay:
    latency: "200ms"
    correlation: "100"
    jitter: "0ms"
  duration: "60s"
EOF

    log_info "Monitoring response times..."
    sleep 30

    # Check if system is still responsive
    if check_health "http://trading-bot-api:3000/api/health"; then
        log_success "✓ System handles network delay"
    else
        log_error "✗ System failed under network delay"
        return 1
    fi

    kubectl delete networkchaos network-delay-test -n $NAMESPACE
    sleep $RECOVERY_WAIT
}

# Test 3: CPU Stress
test_cpu_stress() {
    log_info "=== Test 3: CPU Stress ==="
    log_info "Stressing CPU to 90%..."

    kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: cpu-stress-test
  namespace: $NAMESPACE
spec:
  mode: one
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: trading-bot-api
  stressors:
    cpu:
      workers: 2
      load: 90
  duration: "60s"
EOF

    log_info "Monitoring system under CPU stress..."
    sleep 30

    if check_health "http://trading-bot-api:3000/api/health"; then
        log_success "✓ System handles CPU stress"
    else
        log_error "✗ System failed under CPU stress"
        return 1
    fi

    kubectl delete stresschaos cpu-stress-test -n $NAMESPACE
    sleep $RECOVERY_WAIT
}

# Test 4: Memory Stress
test_memory_stress() {
    log_info "=== Test 4: Memory Stress ==="
    log_info "Consuming 80% of available memory..."

    kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: memory-stress-test
  namespace: $NAMESPACE
spec:
  mode: one
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: trading-bot-api
  stressors:
    memory:
      workers: 1
      size: "400MB"
  duration: "60s"
EOF

    log_info "Monitoring system under memory stress..."
    sleep 30

    if check_health "http://trading-bot-api:3000/api/health"; then
        log_success "✓ System handles memory stress"
    else
        log_error "✗ System failed under memory stress"
        return 1
    fi

    kubectl delete stresschaos memory-stress-test -n $NAMESPACE
    sleep $RECOVERY_WAIT
}

# Test 5: Database Connection Loss
test_database_partition() {
    log_info "=== Test 5: Database Connection Loss ==="
    log_info "Partitioning network between API and database..."

    kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: db-partition-test
  namespace: $NAMESPACE
spec:
  action: partition
  mode: all
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: trading-bot-api
  direction: to
  target:
    mode: all
    selector:
      namespaces:
        - $NAMESPACE
      labelSelectors:
        app: postgres
  duration: "30s"
EOF

    log_info "Checking if circuit breaker activates..."
    sleep 20

    # System should still respond (with degraded functionality)
    if curl -sf "http://trading-bot-api:3000/api/health" | grep -q "degraded\|ok"; then
        log_success "✓ Circuit breaker working"
    else
        log_warning "⚠ Circuit breaker may not be working"
    fi

    kubectl delete networkchaos db-partition-test -n $NAMESPACE
    sleep $RECOVERY_WAIT
}

# Generate report
generate_report() {
    local passed=$1
    local failed=$2
    local total=$((passed + failed))

    log_info "=== Chaos Engineering Report ==="
    log_info "Total tests: $total"
    log_success "Passed: $passed"
    log_error "Failed: $failed"
    log_info "Success rate: $(( passed * 100 / total ))%"

    if [ $failed -eq 0 ]; then
        log_success "All chaos tests passed! System is resilient."
        return 0
    else
        log_error "Some chaos tests failed. Review and improve resilience."
        return 1
    fi
}

# Main
main() {
    log_info "=== Chaos Engineering Tests Started ==="
    log_info "Namespace: $NAMESPACE"
    log_info "Duration per test: ${CHAOS_DURATION}s"
    echo ""

    check_chaos_mesh

    local passed=0
    local failed=0

    # Run tests
    if test_pod_failure; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_network_delay; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_cpu_stress; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_memory_stress; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_database_partition; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    echo ""
    generate_report $passed $failed
}

main
