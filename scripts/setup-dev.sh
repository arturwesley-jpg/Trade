#!/bin/bash

# Local development setup script

set -e

echo "🚀 Setting up Trading Platform for local development"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    log_warn "Node.js not found. Please install Node.js 20+"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    log_warn "Docker not found. Please install Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_warn "Docker Compose not found. Please install Docker Compose"
    exit 1
fi

# Create .env file if not exists
if [ ! -f ".env" ]; then
    log_info "Creating .env file from .env.example..."
    cp .env.example .env
    log_warn "Please update .env with your configuration"
fi

# Install dependencies
log_info "Installing dependencies..."
npm install

# Start databases
log_info "Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for databases
log_info "Waiting for databases to be ready..."
sleep 5

# Run migrations
log_info "Running database migrations..."
npm run migrate

# Seed database (optional)
read -p "Seed database with sample data? (y/n): " SEED
if [ "$SEED" = "y" ]; then
    log_info "Seeding database..."
    npm run seed
fi

# Build packages
log_info "Building packages..."
npm run build

log_info "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  npm run dev          # Start all services"
echo "  npm run dev:api      # Start API only"
echo "  npm run dev:web      # Start Web only"
echo "  npm run dev:worker   # Start Worker only"
echo ""
echo "To run tests:"
echo "  npm test             # Run all tests"
echo "  npm run test:watch   # Run tests in watch mode"
echo "  npm run test:e2e     # Run E2E tests"
echo ""
echo "Database:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "Services will be available at:"
echo "  API: http://localhost:3001"
echo "  Web: http://localhost:3000"
echo "  Grafana: http://localhost:3000 (after docker-compose up)"
