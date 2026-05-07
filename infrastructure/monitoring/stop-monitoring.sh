#!/bin/bash

# Monitoring Stack Shutdown Script
# This script stops the monitoring stack gracefully

set -e

echo "=========================================="
echo "Stopping Trading Platform Monitoring Stack"
echo "=========================================="
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed."
    exit 1
fi

# Stop monitoring stack
echo "Stopping monitoring services..."
docker-compose -f docker-compose.monitoring.yml down

echo ""
echo "=========================================="
echo "Monitoring Stack Stopped Successfully!"
echo "=========================================="
echo ""
echo "To remove all data (WARNING: This will delete all metrics and logs):"
echo "  docker-compose -f docker-compose.monitoring.yml down -v"
echo ""
