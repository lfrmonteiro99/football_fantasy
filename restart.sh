#!/bin/bash

# Football Fantasy Manager - Restart Script
# This script stops and starts all components

echo "🔄 Restarting Football Fantasy Manager..."
echo "========================================"

# Stop all services
./stop.sh

echo ""
echo "⏳ Waiting 3 seconds before restart..."
sleep 3

# Start all services
./start.sh