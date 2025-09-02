#!/bin/bash

# Football Fantasy Manager - Auto Start Script
# This script automatically starts all components of the application

set -e  # Exit on any error

echo "🏈 Starting Football Fantasy Manager..."
echo "=================================="

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use. Killing existing process..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url > /dev/null 2>&1; then
            echo "✅ $name is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $name failed to start after $max_attempts attempts"
    return 1
}

# Check required ports
echo "🔍 Checking ports..."
check_port 8000  # Laravel API
check_port 8001  # Microservice
check_port 3000  # React Frontend

# Create log directory
mkdir -p logs

echo ""
echo "1️⃣  Starting Laravel API (Backend)..."
echo "-----------------------------------"
cd api

# Install dependencies if needed
if [ ! -d "vendor" ]; then
    echo "📦 Installing Laravel dependencies..."
    composer install --no-dev --optimize-autoloader
fi

# Setup database if needed
if [ ! -f "database/database.sqlite" ]; then
    echo "🗄️  Setting up database..."
    php artisan migrate --force
    php artisan db:seed --force
fi

# Start Laravel API in background
echo "🚀 Starting Laravel API on port 8000..."
php artisan serve --host=0.0.0.0 --port=8000 > ../logs/api.log 2>&1 &
API_PID=$!
echo "Laravel API started with PID: $API_PID"

cd ..

echo ""
echo "2️⃣  Starting Match Simulator Microservice..."
echo "--------------------------------------------"
cd match-simulator

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Build if needed
if [ ! -d "dist" ]; then
    echo "🔨 Building TypeScript..."
    npm run build
fi

# Start microservice in background
echo "🚀 Starting Match Simulator on port 8001..."
npm start > ../logs/microservice.log 2>&1 &
MICRO_PID=$!
echo "Match Simulator started with PID: $MICRO_PID"

cd ..

echo ""
echo "3️⃣  Starting React Frontend..."
echo "------------------------------"
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing React dependencies..."
    npm install
fi

# Start React app in background
echo "🚀 Starting React Frontend on port 3000..."
BROWSER=none npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "React Frontend started with PID: $FRONTEND_PID"

cd ..

# Wait for all services to be ready
echo ""
echo "4️⃣  Waiting for services to be ready..."
echo "--------------------------------------"

wait_for_service "http://localhost:8000/api/v1/test" "Laravel API"
wait_for_service "http://localhost:8001/health" "Match Simulator"
wait_for_service "http://localhost:3000" "React Frontend"

# Save PIDs for cleanup
echo "$API_PID,$MICRO_PID,$FRONTEND_PID" > .app_pids

echo ""
echo "🎉 SUCCESS! All services are running!"
echo "===================================="
echo ""
echo "📱 Frontend:      http://localhost:3000"
echo "🔧 Laravel API:   http://localhost:8000"
echo "⚡ Microservice:  http://localhost:8001"
echo ""
echo "📋 Service Status:"
echo "   Laravel API:        PID $API_PID"
echo "   Match Simulator:    PID $MICRO_PID"
echo "   React Frontend:     PID $FRONTEND_PID"
echo ""
echo "📁 Logs are available in:"
echo "   ./logs/api.log"
echo "   ./logs/microservice.log"
echo "   ./logs/frontend.log"
echo ""
echo "🛑 To stop all services, run: ./stop.sh"
echo ""
echo "🎮 Ready to play! Open http://localhost:3000 in your browser"

# Optional: Open browser automatically
if command -v open >/dev/null 2>&1; then
    echo ""
    read -p "🌐 Open browser automatically? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open http://localhost:3000
    fi
fi