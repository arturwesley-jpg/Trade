#!/bin/bash

# Monitoring Stack Startup Script
# This script starts the monitoring stack and verifies all services are healthy

set -e

echo "=========================================="
echo "Starting Trading Platform Monitoring Stack"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed."
    exit 1
fi

# Check if .env file exists
if [ ! -f "infrastructure/monitoring/.env" ]; then
    echo "Warning: .env file not found. Creating from example..."
    cp infrastructure/monitoring/.env.example infrastructure/monitoring/.env
    echo "Please edit infrastructure/monitoring/.env with your configuration."
    echo ""
fi

# Start monitoring stack
echo "Starting monitoring services..."
docker-compose -f docker-compose.monitoring.yml up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check service health
echo ""
echo "Checking service status..."
docker-compose -f docker-compose.monitoring.yml ps

echo ""
echo "=========================================="
echo "Monitoring Stack Started Successfully!"
echo "=========================================="
echo ""
echo "Access the following services:"
echo ""
echo "  Grafana:       http://localhost:3001"
echo "  Prometheus:    http://localhost:9090"
echo "  Alertmanager:  http://localhost:9093"
echo "  Jaeger:        http://localhost:16686"
echo ""
echo "Default Grafana credentials:"
echo "  Username: admin"
echo "  Password: (check your .env file)"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.monitoring.yml logs -f"
echo ""
echo "To stop:"
echo "  docker-compose -f docker-compose.monitoring.yml down"
echo ""
