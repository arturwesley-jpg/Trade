#!/bin/bash

# Sentiment API Test Script
# Tests all 5 sentiment endpoints

API_URL="${API_URL:-http://localhost:4000}"
SYMBOL="${SYMBOL:-BTC-USDT}"

echo "Testing Sentiment API Endpoints"
echo "================================"
echo ""

# Test 1: Get sentiment for a symbol
echo "1. Testing GET /api/sentiment/:symbol"
echo "   Request: GET $API_URL/api/sentiment/$SYMBOL"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/sentiment/$SYMBOL")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "   ✓ Status: $http_code"
    echo "   Response: $body" | head -c 200
    echo "..."
else
    echo "   ✗ Status: $http_code"
    echo "   Response: $body"
fi
echo ""

# Test 2: Batch sentiment
echo "2. Testing POST /api/sentiment/batch"
echo "   Request: POST $API_URL/api/sentiment/batch"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/sentiment/batch" \
    -H "Content-Type: application/json" \
    -d '{"symbols":["BTC-USDT","ETH-USDT"]}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "   ✓ Status: $http_code"
    echo "   Response: $body" | head -c 200
    echo "..."
else
    echo "   ✗ Status: $http_code"
    echo "   Response: $body"
fi
echo ""

# Test 3: Get news
echo "3. Testing GET /api/sentiment/news"
echo "   Request: GET $API_URL/api/sentiment/news?symbol=BTC&limit=5"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/sentiment/news?symbol=BTC&limit=5")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "   ✓ Status: $http_code"
    echo "   Response: $body" | head -c 200
    echo "..."
else
    echo "   ✗ Status: $http_code"
    echo "   Response: $body"
fi
echo ""

# Test 4: Get Fear & Greed Index
echo "4. Testing GET /api/sentiment/fear-greed"
echo "   Request: GET $API_URL/api/sentiment/fear-greed"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/sentiment/fear-greed")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "   ✓ Status: $http_code"
    echo "   Response: $body" | head -c 200
    echo "..."
else
    echo "   ✗ Status: $http_code"
    echo "   Response: $body"
fi
echo ""

# Test 5: Get Fear & Greed History
echo "5. Testing GET /api/sentiment/fear-greed/history"
echo "   Request: GET $API_URL/api/sentiment/fear-greed/history?limit=7"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/sentiment/fear-greed/history?limit=7")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "   ✓ Status: $http_code"
    echo "   Response: $body" | head -c 200
    echo "..."
else
    echo "   ✗ Status: $http_code"
    echo "   Response: $body"
fi
echo ""

echo "================================"
echo "Sentiment API Tests Complete"
