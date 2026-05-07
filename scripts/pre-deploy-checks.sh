#!/bin/bash
set -e

# Pre-deployment Checks Script
# Usage: ./scripts/pre-deploy-checks.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Pre-Deployment Checks"
echo "=========================================="

cd "$PROJECT_ROOT"

# Check 1: Git status
check_git_status() {
    echo ""
    echo "Check 1: Git Status"

    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠ Warning: Uncommitted changes detected"
        git status --short
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo "✓ Working directory clean"
    fi
}

# Check 2: Dependencies
check_dependencies() {
    echo ""
    echo "Check 2: Dependencies"

    if [ ! -d "node_modules" ]; then
        echo "✗ node_modules not found"
        echo "Run: npm install"
        exit 1
    fi

    echo "✓ Dependencies installed"
}

# Check 3: TypeScript compilation
check_typescript() {
    echo ""
    echo "Check 3: TypeScript Compilation"

    if npm run typecheck > /dev/null 2>&1; then
        echo "✓ TypeScript compilation successful"
    else
        echo "✗ TypeScript compilation failed"
        echo "Run: npm run typecheck"
        exit 1
    fi
}

# Check 4: Tests
check_tests() {
    echo ""
    echo "Check 4: Unit Tests"

    if npm test > /dev/null 2>&1; then
        echo "✓ All tests passing"
    else
        echo "✗ Tests failing"
        echo "Run: npm test"
        exit 1
    fi
}

# Check 5: Build
check_build() {
    echo ""
    echo "Check 5: Build"

    if npm run build > /dev/null 2>&1; then
        echo "✓ Build successful"
    else
        echo "✗ Build failed"
        echo "Run: npm run build"
        exit 1
    fi
}

# Check 6: Environment variables
check_env_vars() {
    echo ""
    echo "Check 6: Environment Variables"

    required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
    )

    missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -eq 0 ]; then
        echo "✓ All required environment variables set"
    else
        echo "⚠ Warning: Missing environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
    fi
}

# Check 7: Security audit
check_security() {
    echo ""
    echo "Check 7: Security Audit"

    audit_output=$(npm audit --audit-level=high 2>&1 || true)

    if echo "$audit_output" | grep -q "found 0 vulnerabilities"; then
        echo "✓ No high/critical vulnerabilities found"
    else
        echo "⚠ Security vulnerabilities detected:"
        echo "$audit_output" | grep -E "high|critical" || echo "  Check npm audit for details"
    fi
}

# Run all checks
run_all_checks() {
    local failed=0

    check_git_status || failed=$((failed + 1))
    check_dependencies || failed=$((failed + 1))
    check_typescript || failed=$((failed + 1))
    check_tests || failed=$((failed + 1))
    check_build || failed=$((failed + 1))
    check_env_vars
    check_security

    echo ""
    echo "=========================================="
    if [ $failed -eq 0 ]; then
        echo "All Pre-Deployment Checks Passed!"
        echo "=========================================="
        return 0
    else
        echo "Pre-Deployment Checks Failed: $failed check(s)"
        echo "=========================================="
        return 1
    fi
}

# Main execution
run_all_checks
