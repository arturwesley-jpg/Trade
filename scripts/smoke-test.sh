#!/bin/bash

# Smoke Test Script
# Quick tests to verify critical functionality after deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
TIMEOUT=5

# Counters
PASSED=0
FAILED=0

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

# Test 1: Health Check
print_test "Health Check"
response=$(curl -s --max-time $TIMEOUT "$API_URL/health" 2>/dev/null)
if echo "$response" | grep -q "ok"; then
    print_pass "Health check passed"
else
    print_fail "Health check failed"
fi

# Test 2: Version Check
print_test "Version Check"
version=$(curl -s --max-time $TIMEOUT "$API_URL/version" 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
if [ -n "$version" ]; then
    print_pass "Version: $version"
else
    print_fail "Could not retrieve version"
fi

# Test 3: Metrics
print_test "Metrics Endpoint"
response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$API_URL/metrics" 2>/dev/null)
if [ "$response" == "200" ]; then
    print_pass "Metrics accessible"
else
    print_fail "Metrics failed (HTTP $response)"
fi

# Test 4: Database
print_test "Database Query"
response=$(curl -s --max-time $TIMEOUT "$API_URL/api/health/db" 2>/dev/null)
if echo "$response" | grep -q "ok"; then
    print_pass "Database connection OK"
else
    print_fail "Database connection failed"
fi

# Test 5: Redis
print_test "Redis Connection"
response=$(curl -s --max-time $TIMEOUT "$API_URL/api/health/redis" 2>/dev/null)
if echo "$response" | grep -q "ok"; then
    print_pass "Redis connection OK"
else
    print_fail "Redis connection failed"
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo "========================================="

if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}Smoke tests FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Smoke tests PASSED${NC}"
    exit 0
fi
