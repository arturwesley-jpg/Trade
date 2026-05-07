#!/bin/bash

# Cache Warming Script for Trading Bot
# Pre-populates CDN and application caches with frequently accessed data

set -e

# Configuration
BASE_URL="${BASE_URL:-https://trade-bot.com}"
API_URL="${API_URL:-https://api.trade-bot.com}"
CONCURRENCY="${CONCURRENCY:-10}"
TIMEOUT="${TIMEOUT:-30}"

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

# Warm a single URL
warm_url() {
    local url=$1
    local response_code

    response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time "$TIMEOUT" \
        -H "User-Agent: CacheWarmer/1.0" \
        -H "X-Cache-Warmer: true" \
        "$url")

    if [ "$response_code" = "200" ]; then
        log_success "✓ $url (${response_code})"
        return 0
    else
        log_warning "⚠ $url (${response_code})"
        return 1
    fi
}

# Warm multiple URLs in parallel
warm_urls() {
    local -n urls=$1
    local total=${#urls[@]}
    local success=0
    local failed=0

    log_info "Warming ${total} URLs with concurrency ${CONCURRENCY}..."

    # Use GNU parallel if available, otherwise xargs
    if command -v parallel &> /dev/null; then
        printf '%s\n' "${urls[@]}" | \
            parallel -j "$CONCURRENCY" --bar \
            "curl -s -o /dev/null -w '%{http_code}' --max-time $TIMEOUT '{}' > /dev/null && echo 'SUCCESS: {}' || echo 'FAILED: {}'"
    else
        printf '%s\n' "${urls[@]}" | \
            xargs -P "$CONCURRENCY" -I {} \
            bash -c "warm_url '{}'"
    fi

    log_success "Cache warming completed"
}

# Warm static assets
warm_static_assets() {
    log_info "=== Warming Static Assets ==="

    local static_urls=(
        "${BASE_URL}/"
        "${BASE_URL}/index.html"
        "${BASE_URL}/favicon.ico"
        "${BASE_URL}/manifest.json"
        "${BASE_URL}/robots.txt"
    )

    # Find all JS and CSS files
    if [ -d "dist" ]; then
        while IFS= read -r file; do
            static_urls+=("${BASE_URL}/${file#dist/}")
        done < <(find dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.woff2" \))
    fi

    warm_urls static_urls
}

# Warm API endpoints
warm_api_endpoints() {
    log_info "=== Warming API Endpoints ==="

    local api_urls=(
        "${API_URL}/api/health"
        "${API_URL}/api/market/symbols"
        "${API_URL}/api/market/tickers"
        "${API_URL}/api/stats/global"
    )

    # Add popular trading pairs
    local symbols=("BTCUSDT" "ETHUSDT" "BNBUSDT" "ADAUSDT" "SOLUSDT" "XRPUSDT" "DOTUSDT" "DOGEUSDT")
    for symbol in "${symbols[@]}"; do
        api_urls+=(
            "${API_URL}/api/market/ticker/${symbol}"
            "${API_URL}/api/market/orderbook/${symbol}"
            "${API_URL}/api/market/trades/${symbol}"
            "${API_URL}/api/market/klines/${symbol}?interval=1h"
        )
    done

    warm_urls api_urls
}

# Warm Redis cache
warm_redis_cache() {
    log_info "=== Warming Redis Cache ==="

    # Check if Redis CLI is available
    if ! command -v redis-cli &> /dev/null; then
        log_warning "redis-cli not found, skipping Redis cache warming"
        return
    fi

    local redis_host="${REDIS_HOST:-localhost}"
    local redis_port="${REDIS_PORT:-6379}"

    log_info "Connecting to Redis at ${redis_host}:${redis_port}..."

    # Warm market data cache
    local symbols=("BTCUSDT" "ETHUSDT" "BNBUSDT" "ADAUSDT" "SOLUSDT")
    for symbol in "${symbols[@]}"; do
        # Simulate cache population by making API calls
        curl -s "${API_URL}/api/market/ticker/${symbol}" > /dev/null
        log_success "✓ Cached market data for ${symbol}"
    done
}

# Warm database query cache
warm_database_cache() {
    log_info "=== Warming Database Query Cache ==="

    # Execute common queries to populate PostgreSQL query cache
    local queries=(
        "SELECT * FROM users WHERE status = 'active' LIMIT 100;"
        "SELECT * FROM trades WHERE status = 'executed' ORDER BY created_at DESC LIMIT 100;"
        "SELECT * FROM positions WHERE status = 'open' LIMIT 100;"
        "SELECT symbol, COUNT(*) as count FROM trades GROUP BY symbol ORDER BY count DESC LIMIT 20;"
    )

    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        log_warning "psql not found, skipping database cache warming"
        return
    fi

    local db_url="${DATABASE_URL:-postgresql://localhost:5432/trading_bot}"

    for query in "${queries[@]}"; do
        if psql "$db_url" -c "$query" > /dev/null 2>&1; then
            log_success "✓ Executed query: ${query:0:50}..."
        else
            log_warning "⚠ Failed query: ${query:0:50}..."
        fi
    done
}

# Warm materialized views
warm_materialized_views() {
    log_info "=== Refreshing Materialized Views ==="

    if ! command -v psql &> /dev/null; then
        log_warning "psql not found, skipping materialized view refresh"
        return
    fi

    local db_url="${DATABASE_URL:-postgresql://localhost:5432/trading_bot}"

    local views=(
        "user_trading_stats"
        "symbol_trading_stats"
        "daily_trading_summary"
    )

    for view in "${views[@]}"; do
        log_info "Refreshing ${view}..."
        if psql "$db_url" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY ${view};" > /dev/null 2>&1; then
            log_success "✓ Refreshed ${view}"
        else
            log_warning "⚠ Failed to refresh ${view}"
        fi
    done
}

# Generate cache warming report
generate_report() {
    local start_time=$1
    local end_time=$2
    local duration=$((end_time - start_time))

    log_info "=== Cache Warming Report ==="
    log_info "Duration: ${duration}s"
    log_info "Base URL: ${BASE_URL}"
    log_info "API URL: ${API_URL}"
    log_info "Concurrency: ${CONCURRENCY}"
    log_success "Cache warming completed successfully"
}

# Main
main() {
    local start_time=$(date +%s)

    log_info "=== Cache Warming Started ==="
    log_info "Base URL: ${BASE_URL}"
    log_info "API URL: ${API_URL}"
    log_info "Concurrency: ${CONCURRENCY}"
    echo ""

    # Warm different cache layers
    warm_static_assets
    echo ""

    warm_api_endpoints
    echo ""

    warm_redis_cache
    echo ""

    warm_database_cache
    echo ""

    warm_materialized_views
    echo ""

    local end_time=$(date +%s)
    generate_report "$start_time" "$end_time"
}

# Handle signals
trap 'log_info "Cache warming interrupted"; exit 1' SIGTERM SIGINT

# Run main
main
