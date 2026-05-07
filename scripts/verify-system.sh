#!/bin/bash

# System Verification Script
# Verifies all components of the trading bot are functioning correctly

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
TIMEOUT=10

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

# Test functions
test_api_health() {
    print_test "API Health Check"

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$API_URL/health" 2>/dev/null || echo "000")

    if [ "$response" == "200" ]; then
        print_pass "API is healthy (HTTP $response)"
    else
        print_fail "API health check failed (HTTP $response)"
    fi
}

test_api_version() {
    print_test "API Version Check"

    version=$(curl -s --max-time $TIMEOUT "$API_URL/version" 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$version" ]; then
        print_pass "API version: $version"
    else
        print_fail "Could not retrieve API version"
    fi
}

test_api_metrics() {
    print_test "API Metrics Endpoint"

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$API_URL/metrics" 2>/dev/null || echo "000")

    if [ "$response" == "200" ]; then
        print_pass "Metrics endpoint accessible"
    else
        print_fail "Metrics endpoint failed (HTTP $response)"
    fi
}

test_database() {
    print_test "Database Connection"

    if command -v psql &> /dev/null; then
        if psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-trading_bot}" -c "SELECT 1;" &>/dev/null; then
            print_pass "Database connection successful"

            # Check table count
            table_count=$(psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-trading_bot}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
            print_pass "Database has $table_count tables"
        else
            print_fail "Database connection failed"
        fi
    else
        print_warn "psql not installed, skipping database check"
    fi
}

test_redis() {
    print_test "Redis Connection"

    if command -v redis-cli &> /dev/null; then
        if redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping &>/dev/null; then
            print_pass "Redis connection successful"

            # Check memory usage
            memory=$(redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" INFO memory | grep "used_memory_human" | cut -d':' -f2 | tr -d '\r')
            print_pass "Redis memory usage: $memory"
        else
            print_fail "Redis connection failed"
        fi
    else
        print_warn "redis-cli not installed, skipping Redis check"
    fi
}

test_docker_services() {
    print_test "Docker Services"

    if command -v docker &> /dev/null; then
        services=$(docker-compose ps --services 2>/dev/null | wc -l)
        running=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)

        if [ "$services" -eq "$running" ]; then
            print_pass "All $services Docker services running"
        else
            print_fail "Only $running/$services Docker services running"
        fi
    else
        print_warn "Docker not available, skipping service check"
    fi
}

test_kubernetes_pods() {
    print_test "Kubernetes Pods"

    if command -v kubectl &> /dev/null; then
        total=$(kubectl get pods -n trading-bot --no-headers 2>/dev/null | wc -l)
        running=$(kubectl get pods -n trading-bot --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)

        if [ "$total" -eq "$running" ] && [ "$total" -gt 0 ]; then
            print_pass "All $running Kubernetes pods running"
        elif [ "$total" -eq 0 ]; then
            print_warn "No Kubernetes pods found"
        else
            print_fail "Only $running/$total Kubernetes pods running"
        fi
    else
        print_warn "kubectl not available, skipping Kubernetes check"
    fi
}

test_disk_space() {
    print_test "Disk Space"

    usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ "$usage" -lt 80 ]; then
        print_pass "Disk usage: ${usage}%"
    elif [ "$usage" -lt 90 ]; then
        print_warn "Disk usage high: ${usage}%"
    else
        print_fail "Disk usage critical: ${usage}%"
    fi
}

test_memory() {
    print_test "Memory Usage"

    if command -v free &> /dev/null; then
        usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')

        if [ "$usage" -lt 80 ]; then
            print_pass "Memory usage: ${usage}%"
        elif [ "$usage" -lt 90 ]; then
            print_warn "Memory usage high: ${usage}%"
        else
            print_fail "Memory usage critical: ${usage}%"
        fi
    else
        print_warn "free command not available"
    fi
}

test_cpu() {
    print_test "CPU Usage"

    if command -v top &> /dev/null; then
        usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
        usage_int=${usage%.*}

        if [ "$usage_int" -lt 70 ]; then
            print_pass "CPU usage: ${usage}%"
        elif [ "$usage_int" -lt 90 ]; then
            print_warn "CPU usage high: ${usage}%"
        else
            print_fail "CPU usage critical: ${usage}%"
        fi
    else
        print_warn "top command not available"
    fi
}

test_web_frontend() {
    print_test "Web Frontend"

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$WEB_URL" 2>/dev/null || echo "000")

    if [ "$response" == "200" ]; then
        print_pass "Web frontend accessible (HTTP $response)"
    else
        print_fail "Web frontend failed (HTTP $response)"
    fi
}

test_websocket() {
    print_test "WebSocket Connection"

    # Simple WebSocket test using curl
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        "$API_URL/ws" 2>/dev/null || echo "000")

    if [ "$response" == "101" ] || [ "$response" == "200" ]; then
        print_pass "WebSocket endpoint accessible"
    else
        print_warn "WebSocket endpoint returned HTTP $response"
    fi
}

test_external_apis() {
    print_test "External API Connectivity"

    # Test BingX API
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://open-api.bingx.com/openApi/swap/v2/server/time" 2>/dev/null || echo "000")

    if [ "$response" == "200" ]; then
        print_pass "BingX API accessible"
    else
        print_warn "BingX API returned HTTP $response"
    fi

    # Test Telegram API
    if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" 2>/dev/null || echo "000")

        if [ "$response" == "200" ]; then
            print_pass "Telegram API accessible"
        else
            print_warn "Telegram API returned HTTP $response"
        fi
    else
        print_warn "TELEGRAM_BOT_TOKEN not set, skipping Telegram check"
    fi
}

test_ssl_certificates() {
    print_test "SSL Certificates"

    if [[ "$API_URL" == https://* ]]; then
        domain=$(echo "$API_URL" | sed -e 's|^https://||' -e 's|/.*||')
        expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

        if [ -n "$expiry" ]; then
            expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry" +%s 2>/dev/null)
            now_epoch=$(date +%s)
            days_left=$(( ($expiry_epoch - $now_epoch) / 86400 ))

            if [ "$days_left" -gt 30 ]; then
                print_pass "SSL certificate valid for $days_left days"
            elif [ "$days_left" -gt 7 ]; then
                print_warn "SSL certificate expires in $days_left days"
            else
                print_fail "SSL certificate expires in $days_left days"
            fi
        else
            print_warn "Could not check SSL certificate"
        fi
    else
        print_warn "Not using HTTPS, skipping SSL check"
    fi
}

test_monitoring() {
    print_test "Monitoring Services"

    # Check Prometheus
    prom_response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "http://localhost:9090/-/healthy" 2>/dev/null || echo "000")
    if [ "$prom_response" == "200" ]; then
        print_pass "Prometheus is healthy"
    else
        print_warn "Prometheus not accessible (HTTP $prom_response)"
    fi

    # Check Grafana
    grafana_response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "http://localhost:3000/api/health" 2>/dev/null || echo "000")
    if [ "$grafana_response" == "200" ]; then
        print_pass "Grafana is healthy"
    else
        print_warn "Grafana not accessible (HTTP $grafana_response)"
    fi
}

# Main execution
main() {
    print_header "Trading Bot System Verification"
    echo "Started: $(date)"
    echo ""

    print_header "API Tests"
    test_api_health
    test_api_version
    test_api_metrics
    test_websocket

    print_header "Database Tests"
    test_database
    test_redis

    print_header "Infrastructure Tests"
    test_docker_services
    test_kubernetes_pods

    print_header "Resource Tests"
    test_disk_space
    test_memory
    test_cpu

    print_header "Frontend Tests"
    test_web_frontend

    print_header "External Services"
    test_external_apis
    test_ssl_certificates

    print_header "Monitoring Tests"
    test_monitoring

    # Summary
    print_header "Summary"
    echo -e "${GREEN}Passed:${NC} $PASSED"
    echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
    echo -e "${RED}Failed:${NC} $FAILED"
    echo ""
    echo "Completed: $(date)"

    # Exit code
    if [ "$FAILED" -gt 0 ]; then
        echo -e "\n${RED}Verification FAILED${NC}"
        exit 1
    elif [ "$WARNINGS" -gt 0 ]; then
        echo -e "\n${YELLOW}Verification PASSED with warnings${NC}"
        exit 0
    else
        echo -e "\n${GREEN}Verification PASSED${NC}"
        exit 0
    fi
}

# Run main
main "$@"
