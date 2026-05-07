#!/bin/bash

# Load Testing Script for Trading Bot
# Uses k6 for load testing and performance benchmarking

set -e

# Configuration
TARGET_URL="${TARGET_URL:-https://trade-bot.com}"
API_URL="${API_URL:-https://api.trade-bot.com}"
DURATION="${DURATION:-5m}"
VUS="${VUS:-100}"
REPORT_DIR="${REPORT_DIR:-./load-test-reports}"

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

# Check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        log_error "k6 not installed"
        log_info "Install with: brew install k6 (macOS) or snap install k6 (Linux)"
        exit 1
    fi
    log_success "k6 is installed"
}

# Create k6 test script
create_k6_script() {
    local script_file="$1"

    cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');

// Test configuration
export const options = {
    stages: [
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 100 },  // Stay at 100 users
        { duration: '1m', target: 200 },  // Spike to 200 users
        { duration: '2m', target: 100 },  // Scale down to 100
        { duration: '1m', target: 0 },    // Ramp down to 0
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.05'],
        'errors': ['rate<0.1'],
    },
};

const BASE_URL = __ENV.TARGET_URL || 'https://trade-bot.com';
const API_URL = __ENV.API_URL || 'https://api.trade-bot.com';

// Test scenarios
export default function () {
    // Scenario 1: Homepage load
    let res = http.get(`${BASE_URL}/`);
    check(res, {
        'homepage status is 200': (r) => r.status === 200,
        'homepage loads in <500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    sleep(1);

    // Scenario 2: API health check
    res = http.get(`${API_URL}/api/health`);
    check(res, {
        'health check status is 200': (r) => r.status === 200,
        'health check responds in <100ms': (r) => r.timings.duration < 100,
    }) || errorRate.add(1);

    sleep(1);

    // Scenario 3: Market data fetch
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    res = http.get(`${API_URL}/api/market/ticker/${symbol}`);
    apiResponseTime.add(res.timings.duration);

    const success = check(res, {
        'market data status is 200': (r) => r.status === 200,
        'market data has valid structure': (r) => {
            try {
                const data = JSON.parse(r.body);
                return data.symbol && data.price;
            } catch {
                return false;
            }
        },
    });

    if (success) {
        successfulRequests.add(1);
    } else {
        errorRate.add(1);
    }

    sleep(2);

    // Scenario 4: Order book fetch
    res = http.get(`${API_URL}/api/market/orderbook/${symbol}`);
    check(res, {
        'orderbook status is 200': (r) => r.status === 200,
        'orderbook responds in <200ms': (r) => r.timings.duration < 200,
    }) || errorRate.add(1);

    sleep(1);

    // Scenario 5: Trading stats
    res = http.get(`${API_URL}/api/stats/global`);
    check(res, {
        'stats status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(2);
}

// Setup function
export function setup() {
    console.log('Starting load test...');
    console.log(`Target URL: ${BASE_URL}`);
    console.log(`API URL: ${API_URL}`);
}

// Teardown function
export function teardown(data) {
    console.log('Load test completed');
}
EOF

    log_success "Created k6 test script: $script_file"
}

# Run load test
run_load_test() {
    local test_name=$1
    local script_file="${REPORT_DIR}/k6-script.js"
    local report_file="${REPORT_DIR}/${test_name}-$(date +%Y%m%d-%H%M%S)"

    log_info "Running load test: $test_name"
    log_info "Duration: $DURATION, VUs: $VUS"

    # Run k6 with JSON output
    k6 run \
        --vus "$VUS" \
        --duration "$DURATION" \
        --out "json=${report_file}.json" \
        --summary-export="${report_file}-summary.json" \
        "$script_file" \
        2>&1 | tee "${report_file}.log"

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log_success "Load test completed successfully"
        return 0
    else
        log_error "Load test failed"
        return 1
    fi
}

# Run spike test
run_spike_test() {
    log_info "=== Spike Test ==="

    local script_file="${REPORT_DIR}/spike-test.js"

    cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 100 },
        { duration: '1m', target: 1000 },  // Sudden spike
        { duration: '10s', target: 100 },
        { duration: '10s', target: 0 },
    ],
};

const API_URL = __ENV.API_URL || 'https://api.trade-bot.com';

export default function () {
    const res = http.get(`${API_URL}/api/health`);
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
    sleep(1);
}
EOF

    k6 run --out "json=${REPORT_DIR}/spike-test.json" "$script_file"
}

# Run stress test
run_stress_test() {
    log_info "=== Stress Test ==="

    local script_file="${REPORT_DIR}/stress-test.js"

    cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 400 },
        { duration: '2m', target: 0 },
    ],
};

const API_URL = __ENV.API_URL || 'https://api.trade-bot.com';

export default function () {
    const res = http.get(`${API_URL}/api/market/tickers`);
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
    sleep(1);
}
EOF

    k6 run --out "json=${REPORT_DIR}/stress-test.json" "$script_file"
}

# Run soak test
run_soak_test() {
    log_info "=== Soak Test (Long Duration) ==="

    local script_file="${REPORT_DIR}/soak-test.js"

    cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '2m', target: 50 },
        { duration: '30m', target: 50 },  // Stay at 50 for 30 minutes
        { duration: '2m', target: 0 },
    ],
};

const API_URL = __ENV.API_URL || 'https://api.trade-bot.com';

export default function () {
    const res = http.get(`${API_URL}/api/health`);
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
    sleep(5);
}
EOF

    k6 run --out "json=${REPORT_DIR}/soak-test.json" "$script_file"
}

# Generate HTML report
generate_html_report() {
    local json_file=$1
    local html_file="${json_file%.json}.html"

    log_info "Generating HTML report..."

    # Use k6-reporter if available
    if command -v k6-reporter &> /dev/null; then
        k6-reporter "$json_file" --output "$html_file"
        log_success "HTML report generated: $html_file"
    else
        log_warning "k6-reporter not found, skipping HTML report generation"
    fi
}

# Analyze results
analyze_results() {
    local summary_file=$1

    if [ ! -f "$summary_file" ]; then
        log_warning "Summary file not found: $summary_file"
        return
    fi

    log_info "=== Load Test Results ==="

    # Parse JSON summary
    local p95=$(jq -r '.metrics.http_req_duration.values.["p(95)"]' "$summary_file")
    local p99=$(jq -r '.metrics.http_req_duration.values.["p(99)"]' "$summary_file")
    local error_rate=$(jq -r '.metrics.http_req_failed.values.rate' "$summary_file")
    local requests=$(jq -r '.metrics.http_reqs.values.count' "$summary_file")

    log_info "Total Requests: $requests"
    log_info "P95 Response Time: ${p95}ms"
    log_info "P99 Response Time: ${p99}ms"
    log_info "Error Rate: $(echo "$error_rate * 100" | bc)%"

    # Check thresholds
    if (( $(echo "$p95 < 500" | bc -l) )); then
        log_success "✓ P95 response time is acceptable (<500ms)"
    else
        log_error "✗ P95 response time exceeds threshold (>500ms)"
    fi

    if (( $(echo "$error_rate < 0.05" | bc -l) )); then
        log_success "✓ Error rate is acceptable (<5%)"
    else
        log_error "✗ Error rate exceeds threshold (>5%)"
    fi
}

# Main
main() {
    log_info "=== Load Testing Started ==="
    log_info "Target URL: $TARGET_URL"
    log_info "API URL: $API_URL"
    echo ""

    # Setup
    check_k6
    mkdir -p "$REPORT_DIR"

    # Create test script
    create_k6_script "${REPORT_DIR}/k6-script.js"
    echo ""

    # Run tests
    if run_load_test "baseline"; then
        local latest_summary=$(ls -t "${REPORT_DIR}"/*-summary.json | head -1)
        analyze_results "$latest_summary"
    fi

    echo ""
    log_info "Load test reports saved to: $REPORT_DIR"
}

# Handle signals
trap 'log_info "Load test interrupted"; exit 1' SIGTERM SIGINT

# Run main
main
