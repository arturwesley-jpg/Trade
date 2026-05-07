#!/bin/bash

# Traffic Switching Script for Blue-Green Deployment
# Quickly switch traffic between blue and green environments

set -e

# Configuration
NAMESPACE="${NAMESPACE:-trading-bot}"
SERVICE_NAME="${SERVICE_NAME:-trading-bot-api}"
TARGET_ENV="${1}"

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current active environment
get_active_environment() {
    kubectl get service ${SERVICE_NAME} -n ${NAMESPACE} \
        -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "blue"
}

# Validate target environment
if [ -z "$TARGET_ENV" ]; then
    log_error "Usage: $0 <blue|green>"
    exit 1
fi

if [ "$TARGET_ENV" != "blue" ] && [ "$TARGET_ENV" != "green" ]; then
    log_error "Invalid environment. Must be 'blue' or 'green'"
    exit 1
fi

# Get current environment
CURRENT_ENV=$(get_active_environment)

if [ "$CURRENT_ENV" == "$TARGET_ENV" ]; then
    log_info "Already running on ${TARGET_ENV} environment"
    exit 0
fi

log_info "Current environment: ${CURRENT_ENV}"
log_info "Switching to: ${TARGET_ENV}"

# Confirm switch
read -p "Are you sure you want to switch traffic to ${TARGET_ENV}? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Traffic switch cancelled"
    exit 0
fi

# Switch traffic
log_info "Switching traffic..."
kubectl patch service ${SERVICE_NAME} -n ${NAMESPACE} \
    -p "{\"spec\":{\"selector\":{\"version\":\"${TARGET_ENV}\"}}}"

# Verify switch
sleep 2
NEW_ENV=$(get_active_environment)

if [ "$NEW_ENV" == "$TARGET_ENV" ]; then
    log_success "Traffic successfully switched to ${TARGET_ENV}"
    log_info "Previous environment (${CURRENT_ENV}) is still running for quick rollback"
else
    log_error "Traffic switch verification failed"
    exit 1
fi
