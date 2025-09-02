#!/bin/bash

# Football Fantasy Manager - Stop Script
# This script stops all running components

echo "🛑 Stopping Football Fantasy Manager..."
echo "====================================="

# Function to kill process by PID
kill_process() {
    local pid=$1
    local name=$2
    
    if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
        echo "🔪 Stopping $name (PID: $pid)..."
        kill -TERM $pid 2>/dev/null
        sleep 2
        
        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
            echo "   Force killing $name..."
            kill -KILL $pid 2>/dev/null
        fi
        echo "✅ $name stopped"
    else
        echo "ℹ️  $name was not running"
    fi
}

# Kill by stored PIDs
if [ -f ".app_pids" ]; then
    echo "📋 Reading stored process IDs..."
    PIDS=$(cat .app_pids)
    IFS=',' read -r API_PID MICRO_PID FRONTEND_PID <<< "$PIDS"
    
    kill_process "$API_PID" "Laravel API"
    kill_process "$MICRO_PID" "Match Simulator"
    kill_process "$FRONTEND_PID" "React Frontend"
    
    rm .app_pids
else
    echo "📋 No stored PIDs found, killing by port..."
    
    # Kill processes by port
    for port in 8000 8001 3000; do
        PID=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$PID" ]; then
            echo "🔪 Killing process on port $port (PID: $PID)..."
            kill -TERM $PID 2>/dev/null || true
            sleep 1
            kill -KILL $PID 2>/dev/null || true
        fi
    done
fi

# Clean up any remaining processes
echo ""
echo "🧹 Cleaning up any remaining processes..."

# Kill any remaining Laravel artisan processes
pkill -f "php artisan serve" 2>/dev/null || true

# Kill any remaining npm/node processes for our apps
pkill -f "npm start" 2>/dev/null || true
pkill -f "node.*football_fantasy" 2>/dev/null || true

echo ""
echo "✅ All services stopped!"
echo ""
echo "📁 Logs are preserved in ./logs/ directory"
echo "🚀 To start again, run: ./start.sh"