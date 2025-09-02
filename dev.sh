#!/bin/bash

# Football Fantasy Manager - Development Mode
# This script starts all services in development mode with live reloading

set -e

echo "🔧 Starting Football Fantasy Manager (Development Mode)..."
echo "========================================================="

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use. Killing existing process..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Check required ports
echo "🔍 Checking ports..."
check_port 8000  # Laravel API
check_port 8001  # Microservice
check_port 3000  # React Frontend

# Create log directory
mkdir -p logs

echo ""
echo "🔥 Starting services in development mode..."
echo "(This will open multiple terminal windows/tabs)"

# Function to open new terminal and run command
run_in_new_terminal() {
    local title=$1
    local command=$2
    local directory=$3
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell app \"Terminal\" to do script \"echo '=== $title ==='; cd '$PWD/$directory'; $command\""
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - try gnome-terminal, then xterm
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal --title="$title" --working-directory="$PWD/$directory" -- bash -c "$command; exec bash"
        elif command -v xterm &> /dev/null; then
            xterm -title "$title" -e "cd '$PWD/$directory' && $command && bash" &
        else
            echo "⚠️  Cannot open new terminal. Please run manually:"
            echo "   cd $directory && $command"
        fi
    else
        echo "⚠️  Unsupported OS. Please run manually:"
        echo "   cd $directory && $command"
    fi
}

# Start Laravel API in new terminal
echo "🚀 Starting Laravel API (with auto-reload)..."
run_in_new_terminal "Laravel API" "php artisan serve --host=0.0.0.0 --port=8000" "api"

sleep 2

# Start Match Simulator in new terminal
echo "🚀 Starting Match Simulator (with auto-reload)..."
run_in_new_terminal "Match Simulator" "npm run dev" "match-simulator"

sleep 2

# Start React Frontend in new terminal
echo "🚀 Starting React Frontend (with live reload)..."
run_in_new_terminal "React Frontend" "npm start" "frontend"

echo ""
echo "🎉 Development servers starting in separate terminals!"
echo "===================================================="
echo ""
echo "📱 Frontend:      http://localhost:3000"
echo "🔧 Laravel API:   http://localhost:8000"
echo "⚡ Microservice:  http://localhost:8001"
echo ""
echo "🔥 Development features:"
echo "   ✅ Auto-reload on file changes"
echo "   ✅ Hot module replacement (React)"
echo "   ✅ Error overlay in browser"
echo "   ✅ Detailed logging in terminals"
echo ""
echo "🛑 To stop all services, run: ./stop.sh"
echo "   (or close the terminal windows)"

# Wait a bit and try to open browser
sleep 5
if command -v open >/dev/null 2>&1; then
    echo ""
    echo "🌐 Opening browser..."
    open http://localhost:3000
fi