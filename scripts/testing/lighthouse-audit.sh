#!/bin/bash

# Lighthouse Performance Audit Script
# Runs Google Lighthouse audits for performance, accessibility, SEO, and best practices

set -e

# Configuration
TARGET_URL="${TARGET_URL:-https://trade-bot.com}"
REPORT_DIR="${REPORT_DIR:-./lighthouse-reports}"
CHROME_FLAGS="--headless --no-sandbox --disable-gpu"

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

# Check if Lighthouse is installed
check_lighthouse() {
    if ! command -v lighthouse &> /dev/null; then
        log_error "Lighthouse not installed"
        log_info "Install with: npm install -g lighthouse"
        exit 1
    fi
    log_success "Lighthouse is installed"
}

# Run Lighthouse audit
run_audit() {
    local url=$1
    local output_name=$2
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local output_path="${REPORT_DIR}/${output_name}-${timestamp}"

    log_info "Running Lighthouse audit for: $url"

    lighthouse "$url" \
        --output html \
        --output json \
        --output-path "${output_path}" \
        --chrome-flags="$CHROME_FLAGS" \
        --preset=desktop \
        --throttling-method=simulate \
        --quiet

    if [ $? -eq 0 ]; then
        log_success "Audit completed: ${output_path}.html"
        return 0
    else
        log_error "Audit failed for: $url"
        return 1
    fi
}

# Run mobile audit
run_mobile_audit() {
    local url=$1
    local output_name=$2
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local output_path="${REPORT_DIR}/${output_name}-mobile-${timestamp}"

    log_info "Running mobile Lighthouse audit for: $url"

    lighthouse "$url" \
        --output html \
        --output json \
        --output-path "${output_path}" \
        --chrome-flags="$CHROME_FLAGS" \
        --preset=mobile \
        --throttling-method=simulate \
        --quiet

    if [ $? -eq 0 ]; then
        log_success "Mobile audit completed: ${output_path}.html"
        return 0
    else
        log_error "Mobile audit failed for: $url"
        return 1
    fi
}

# Analyze Lighthouse results
analyze_results() {
    local json_file=$1

    if [ ! -f "$json_file" ]; then
        log_warning "JSON report not found: $json_file"
        return
    fi

    log_info "=== Lighthouse Audit Results ==="

    # Extract scores
    local performance=$(jq -r '.categories.performance.score * 100' "$json_file")
    local accessibility=$(jq -r '.categories.accessibility.score * 100' "$json_file")
    local best_practices=$(jq -r '.categories["best-practices"].score * 100' "$json_file")
    local seo=$(jq -r '.categories.seo.score * 100' "$json_file")

    log_info "Performance: ${performance}%"
    log_info "Accessibility: ${accessibility}%"
    log_info "Best Practices: ${best_practices}%"
    log_info "SEO: ${seo}%"

    # Check thresholds
    if (( $(echo "$performance >= 90" | bc -l) )); then
        log_success "✓ Performance score is excellent (≥90%)"
    elif (( $(echo "$performance >= 50" | bc -l) )); then
        log_warning "⚠ Performance score needs improvement (50-89%)"
    else
        log_error "✗ Performance score is poor (<50%)"
    fi

    if (( $(echo "$accessibility >= 90" | bc -l) )); then
        log_success "✓ Accessibility score is excellent (≥90%)"
    else
        log_warning "⚠ Accessibility score needs improvement (<90%)"
    fi

    # Extract key metrics
    local fcp=$(jq -r '.audits["first-contentful-paint"].numericValue' "$json_file")
    local lcp=$(jq -r '.audits["largest-contentful-paint"].numericValue' "$json_file")
    local tti=$(jq -r '.audits["interactive"].numericValue' "$json_file")
    local tbt=$(jq -r '.audits["total-blocking-time"].numericValue' "$json_file")
    local cls=$(jq -r '.audits["cumulative-layout-shift"].numericValue' "$json_file")

    echo ""
    log_info "=== Core Web Vitals ==="
    log_info "First Contentful Paint (FCP): $(echo "scale=2; $fcp / 1000" | bc)s"
    log_info "Largest Contentful Paint (LCP): $(echo "scale=2; $lcp / 1000" | bc)s"
    log_info "Time to Interactive (TTI): $(echo "scale=2; $tti / 1000" | bc)s"
    log_info "Total Blocking Time (TBT): ${tbt}ms"
    log_info "Cumulative Layout Shift (CLS): $cls"

    # Check Core Web Vitals
    if (( $(echo "$lcp < 2500" | bc -l) )); then
        log_success "✓ LCP is good (<2.5s)"
    elif (( $(echo "$lcp < 4000" | bc -l) )); then
        log_warning "⚠ LCP needs improvement (2.5-4s)"
    else
        log_error "✗ LCP is poor (>4s)"
    fi

    if (( $(echo "$cls < 0.1" | bc -l) )); then
        log_success "✓ CLS is good (<0.1)"
    elif (( $(echo "$cls < 0.25" | bc -l) )); then
        log_warning "⚠ CLS needs improvement (0.1-0.25)"
    else
        log_error "✗ CLS is poor (>0.25)"
    fi
}

# Generate comparison report
generate_comparison() {
    log_info "=== Generating Comparison Report ==="

    local latest_desktop=$(ls -t "${REPORT_DIR}"/*-desktop-*.json 2>/dev/null | head -1)
    local latest_mobile=$(ls -t "${REPORT_DIR}"/*-mobile-*.json 2>/dev/null | head -1)

    if [ -n "$latest_desktop" ] && [ -n "$latest_mobile" ]; then
        log_info "Desktop vs Mobile Comparison:"

        local desktop_perf=$(jq -r '.categories.performance.score * 100' "$latest_desktop")
        local mobile_perf=$(jq -r '.categories.performance.score * 100' "$latest_mobile")

        log_info "Desktop Performance: ${desktop_perf}%"
        log_info "Mobile Performance: ${mobile_perf}%"

        local diff=$(echo "$desktop_perf - $mobile_perf" | bc)
        log_info "Difference: ${diff}%"
    fi
}

# Run CI mode (fail on low scores)
run_ci_mode() {
    local url=$1
    local min_score=${2:-50}

    log_info "Running Lighthouse in CI mode (min score: ${min_score}%)"

    lighthouse "$url" \
        --output json \
        --output-path "${REPORT_DIR}/ci-report.json" \
        --chrome-flags="$CHROME_FLAGS" \
        --preset=desktop \
        --quiet

    local performance=$(jq -r '.categories.performance.score * 100' "${REPORT_DIR}/ci-report.json")

    if (( $(echo "$performance >= $min_score" | bc -l) )); then
        log_success "✓ CI check passed (${performance}% ≥ ${min_score}%)"
        return 0
    else
        log_error "✗ CI check failed (${performance}% < ${min_score}%)"
        return 1
    fi
}

# Main
main() {
    log_info "=== Lighthouse Performance Audit Started ==="
    log_info "Target URL: $TARGET_URL"
    echo ""

    # Setup
    check_lighthouse
    mkdir -p "$REPORT_DIR"

    # Run audits
    log_info "Running desktop audit..."
    if run_audit "$TARGET_URL" "desktop"; then
        local latest_json=$(ls -t "${REPORT_DIR}"/desktop-*.json | head -1)
        analyze_results "$latest_json"
    fi

    echo ""
    log_info "Running mobile audit..."
    if run_mobile_audit "$TARGET_URL" "mobile"; then
        local latest_json=$(ls -t "${REPORT_DIR}"/mobile-*.json | head -1)
        analyze_results "$latest_json"
    fi

    echo ""
    generate_comparison

    echo ""
    log_info "Lighthouse reports saved to: $REPORT_DIR"
    log_success "Audit completed successfully"
}

# Handle signals
trap 'log_info "Audit interrupted"; exit 1' SIGTERM SIGINT

# Check for CI mode
if [ "$1" = "--ci" ]; then
    run_ci_mode "$TARGET_URL" "${2:-50}"
else
    main
fi
