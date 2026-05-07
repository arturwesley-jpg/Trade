#!/bin/bash

# Deployment script for Trading Platform
# Usage: ./deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}

echo "🚀 Deploying Trading Platform to $ENVIRONMENT"
echo "📦 Version: $VERSION"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "docker not found. Please install docker."
        exit 1
    fi

    if ! command -v helm &> /dev/null; then
        log_warn "helm not found. Some features may not work."
    fi

    log_info "Prerequisites check passed ✓"
}

build_images() {
    log_info "Building Docker images..."

    # Build API
    log_info "Building API image..."
    docker build -t trading-api:$VERSION -f apps/api/Dockerfile .

    # Build Web
    log_info "Building Web image..."
    docker build -t trading-web:$VERSION -f apps/web/Dockerfile .

    # Build Worker
    log_info "Building Worker image..."
    docker build -t trading-worker:$VERSION -f apps/worker/Dockerfile .

    # Build Telegram Bot
    log_info "Building Telegram Bot image..."
    docker build -t trading-telegram-bot:$VERSION -f apps/telegram-bot/Dockerfile .

    log_info "Docker images built successfully ✓"
}

push_images() {
    log_info "Pushing Docker images to registry..."

    REGISTRY=${DOCKER_REGISTRY:-ghcr.io/your-org}

    docker tag trading-api:$VERSION $REGISTRY/trading-api:$VERSION
    docker tag trading-web:$VERSION $REGISTRY/trading-web:$VERSION
    docker tag trading-worker:$VERSION $REGISTRY/trading-worker:$VERSION
    docker tag trading-telegram-bot:$VERSION $REGISTRY/trading-telegram-bot:$VERSION

    docker push $REGISTRY/trading-api:$VERSION
    docker push $REGISTRY/trading-web:$VERSION
    docker push $REGISTRY/trading-worker:$VERSION
    docker push $REGISTRY/trading-telegram-bot:$VERSION

    log_info "Images pushed successfully ✓"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure..."

    NAMESPACE="trading-platform-$ENVIRONMENT"

    # Create namespace if not exists
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

    # Apply secrets
    if [ -f ".env.$ENVIRONMENT" ]; then
        log_info "Creating secrets from .env.$ENVIRONMENT"
        kubectl create secret generic trading-secrets \
            --from-env-file=.env.$ENVIRONMENT \
            -n $NAMESPACE \
            --dry-run=client -o yaml | kubectl apply -f -
    else
        log_warn "No .env.$ENVIRONMENT file found. Using existing secrets."
    fi

    # Deploy databases
    log_info "Deploying PostgreSQL and Redis..."
    kubectl apply -f kubernetes/deployment.yml -n $NAMESPACE

    # Wait for databases
    log_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s

    log_info "Infrastructure deployed successfully ✓"
}

deploy_applications() {
    log_info "Deploying applications..."

    NAMESPACE="trading-platform-$ENVIRONMENT"
    REGISTRY=${DOCKER_REGISTRY:-ghcr.io/your-org}

    # Update image tags in deployment
    kubectl set image deployment/trading-api \
        api=$REGISTRY/trading-api:$VERSION \
        -n $NAMESPACE

    kubectl set image deployment/trading-web \
        web=$REGISTRY/trading-web:$VERSION \
        -n $NAMESPACE

    kubectl set image deployment/trading-worker \
        worker=$REGISTRY/trading-worker:$VERSION \
        -n $NAMESPACE

    # Wait for rollout
    log_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/trading-api -n $NAMESPACE --timeout=5m
    kubectl rollout status deployment/trading-web -n $NAMESPACE --timeout=5m
    kubectl rollout status deployment/trading-worker -n $NAMESPACE --timeout=5m

    log_info "Applications deployed successfully ✓"
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."

    NAMESPACE="trading-platform-$ENVIRONMENT"

    kubectl apply -f kubernetes/monitoring.yml -n $NAMESPACE

    log_info "Monitoring deployed successfully ✓"
}

run_migrations() {
    log_info "Running database migrations..."

    NAMESPACE="trading-platform-$ENVIRONMENT"

    # Get API pod
    API_POD=$(kubectl get pod -l app=trading-api -n $NAMESPACE -o jsonpath="{.items[0].metadata.name}")

    if [ -z "$API_POD" ]; then
        log_error "No API pod found"
        exit 1
    fi

    # Run migrations
    kubectl exec -it $API_POD -n $NAMESPACE -- npm run migrate

    log_info "Migrations completed successfully ✓"
}

run_smoke_tests() {
    log_info "Running smoke tests..."

    NAMESPACE="trading-platform-$ENVIRONMENT"

    # Get service URL
    if [ "$ENVIRONMENT" = "production" ]; then
        API_URL="https://api.trading.example.com"
    else
        API_URL="https://api.staging.trading.example.com"
    fi

    # Health check
    log_info "Checking API health..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)

    if [ "$HTTP_CODE" = "200" ]; then
        log_info "Health check passed ✓"
    else
        log_error "Health check failed (HTTP $HTTP_CODE)"
        exit 1
    fi

    # Run E2E tests
    if [ -f "package.json" ]; then
        log_info "Running E2E tests..."
        API_URL=$API_URL npm run test:e2e
    fi

    log_info "Smoke tests passed ✓"
}

rollback() {
    log_warn "Rolling back deployment..."

    NAMESPACE="trading-platform-$ENVIRONMENT"

    kubectl rollout undo deployment/trading-api -n $NAMESPACE
    kubectl rollout undo deployment/trading-web -n $NAMESPACE
    kubectl rollout undo deployment/trading-worker -n $NAMESPACE

    log_info "Rollback completed ✓"
}

show_status() {
    log_info "Deployment status:"

    NAMESPACE="trading-platform-$ENVIRONMENT"

    echo ""
    echo "Pods:"
    kubectl get pods -n $NAMESPACE

    echo ""
    echo "Services:"
    kubectl get svc -n $NAMESPACE

    echo ""
    echo "Ingress:"
    kubectl get ingress -n $NAMESPACE

    echo ""
    echo "HPA:"
    kubectl get hpa -n $NAMESPACE
}

# Main deployment flow
main() {
    check_prerequisites

    if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
        log_error "Invalid environment. Use 'staging' or 'production'"
        exit 1
    fi

    # Confirmation for production
    if [ "$ENVIRONMENT" = "production" ]; then
        log_warn "You are about to deploy to PRODUCTION!"
        read -p "Are you sure? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi

    # Build and push images
    build_images
    push_images

    # Deploy
    deploy_infrastructure
    deploy_applications
    deploy_monitoring

    # Run migrations
    run_migrations

    # Test
    if ! run_smoke_tests; then
        log_error "Smoke tests failed!"
        read -p "Rollback? (yes/no): " ROLLBACK
        if [ "$ROLLBACK" = "yes" ]; then
            rollback
        fi
        exit 1
    fi

    # Show status
    show_status

    echo ""
    log_info "🎉 Deployment completed successfully!"
    echo ""

    if [ "$ENVIRONMENT" = "staging" ]; then
        echo "Staging URL: https://staging.trading.example.com"
    else
        echo "Production URL: https://trading.example.com"
    fi
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        rollback
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 [staging|production] [version]"
        echo "       $0 rollback [staging|production]"
        echo "       $0 status [staging|production]"
        exit 1
        ;;
esac
