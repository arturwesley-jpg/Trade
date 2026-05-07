#!/bin/bash
set -e

# Smoke Tests Script
# Usage: ./scripts/smoke-tests.sh [environment]
# Environments: staging, production

ENVIRONMENT=${1:-staging}

echo "=========================================="
echo "Running Smoke Tests"
echo "Environment: $ENVIRONMENT"
echo "=========================================="

# Set API URL based on environment
if [ "$ENVIRONMENT" = "staging" ]; then
    API_URL=${STAGING_API_URL:-"https://staging.trading-bot.example.com"}
elif [ "$ENVIRONMENT" = "production" ]; then
    API_URL=${PRODUCTION_API_URL:-"https://trading-bot.example.com"}
else
    echo "Error: Unknown environment '$ENVIRONMENT'"
    exit 1
fi

echo "Testing API at: $API_URL"

# Test 1: Health Check
test_health_check() {
    echo ""
    echo "Test 1: Health Check"

    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")

    if [ "$response" -eq 200 ]; then
        echo "✓ Health check passed (HTTP $response)"
    else
        echo "✗ Health check failed (HTTP $response)"
        return 1
    fi
}

# Test 2: API Responsiveness
test_api_responsiveness() {
    echo ""
    echo "Test 2: API Responsiveness"

    response_time=$(curl -o /dev/null -s -w '%{time_total}' "$API_URL/health")

    echo "Response time: ${response_time}s"

    # Check if response time is acceptable (< 3 seconds)
    if (( $(echo "$response_time < 3.0" | bc -l) )); then
        echo "✓ API responsiveness acceptable"
    else
        echo "✗ API response time too slow"
        return 1
    fi
}

# Test 3: Metrics Endpoint
test_metrics_endpoint() {
    echo ""
    echo "Test 3: Metrics Endpoint"

    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/metrics")

    if [ "$response" -eq 200 ]; then
        echo "✓ Metrics endpoint accessible (HTTP $response)"
    else
        echo "✗ Metrics endpoint failed (HTTP $response)"
        return 1
    fi
}

# Test 4: API Version
test_api_version() {
    echo ""
    echo "Test 4: API Version"

    version=$(curl -s "$API_URL/health" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

    if [ "$version" != "unknown" ] && [ -n "$version" ]; then
        echo "✓ API version: $version"
    else
        echo "⚠ Could not determine API version (non-critical)"
    fi
}

# Test 5: Database Connectivity
test_database_connectivity() {
    echo ""
    echo "Test 5: Database Connectivity"

    db_status=$(curl -s "$API_URL/health" | grep -o '"database":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

    if [ "$db_status" = "connected" ] || [ "$db_status" = "healthy" ]; then
        echo "✓ Database connectivity OK"
    else
        echo "⚠ Database status: $db_status"
    fi
}

# Test 6: Redis Connectivity
test_redis_connectivity() {
    echo ""
    echo "Test 6: Redis Connectivity"

    redis_status=$(curl -s "$API_URL/health" | grep -o '"redis":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

    if [ "$redis_status" = "connected" ] || [ "$redis_status" = "healthy" ]; then
        echo "✓ Redis connectivity OK"
    else
        echo "⚠ Redis status: $redis_status"
    fi
}

# Test 7: Authentication Endpoint
test_auth_endpoint() {
    echo ""
    echo "Test 7: Authentication Endpoint"

    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/auth/login" -X POST -H "Content-Type: application/json" -d '{}')

    # Expecting 400 or 401 (bad request or unauthorized), not 500
    if [ "$response" -eq 400 ] || [ "$response" -eq 401 ]; then
        echo "✓ Auth endpoint responding correctly (HTTP $response)"
    elif [ "$response" -eq 404 ]; then
        echo "⚠ Auth endpoint not found (HTTP $response)"
    else
        echo "✗ Auth endpoint error (HTTP $response)"
        return 1
    fi
}

# Test 8: CORS Headers
test_cors_headers() {
    echo ""
    echo "Test 8: CORS Headers"

    cors_header=$(curl -s -I "$API_URL/health" | grep -i "access-control-allow-origin" || echo "")

    if [ -n "$cors_header" ]; then
        echo "✓ CORS headers present"
    else
        echo "⚠ CORS headers not found (may be intentional)"
    fi
}

# Run all tests
run_all_tests() {
    local failed=0

    test_health_check || failed=$((failed + 1))
    test_api_responsiveness || failed=$((failed + 1))
    test_metrics_endpoint || failed=$((failed + 1))
    test_api_version
    test_database_connectivity
    test_redis_connectivity
    test_auth_endpoint || failed=$((failed + 1))
    test_cors_headers

    echo ""
    echo "=========================================="
    if [ $failed -eq 0 ]; then
        echo "All Smoke Tests Passed!"
        echo "=========================================="
        return 0
    else
        echo "Smoke Tests Failed: $failed critical test(s)"
        echo "=========================================="
        return 1
    fi
}

# Main execution
run_all_tests
