#!/bin/bash
set -e

# Health Check Script
# Usage: ./scripts/health-check.sh [url]

API_URL=${1:-"http://localhost:3000"}

echo "=========================================="
echo "Health Check"
echo "API URL: $API_URL"
echo "=========================================="

# Check if API is responding
echo ""
echo "Checking API health..."

response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" || echo "000")

if [ "$response" -eq 200 ]; then
    echo "✓ API is healthy (HTTP $response)"

    # Get detailed health info
    health_data=$(curl -s "$API_URL/health")
    echo ""
    echo "Health Details:"
    echo "$health_data" | grep -o '"[^"]*":"[^"]*"' | while read -r line; do
        echo "  $line"
    done

    exit 0
else
    echo "✗ API health check failed (HTTP $response)"
    exit 1
fi
