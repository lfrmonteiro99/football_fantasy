#!/bin/bash

# Football Fantasy Manager - Development Mode
# Starts API and Frontend with live reloading

set -e

echo "Starting Football Fantasy Manager (Development Mode)..."
echo "========================================================="

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "WARNING: Port $port is already in use. Killing existing process..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Check required ports
echo "Checking ports..."
check_port 8000  # Laravel API
check_port 3000  # React Frontend

# Create log directory
mkdir -p logs

echo ""
echo "Starting services in development mode..."

# Function to open new terminal and run command
run_in_new_terminal() {
    local title=$1
    local command=$2
    local directory=$3

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell app \"Terminal\" to do script \"echo '=== $title ==='; cd '$PWD/$directory'; $command\""
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - try gnome-terminal, then xterm, then fallback to background
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal --title="$title" --working-directory="$PWD/$directory" -- bash -c "$command; exec bash"
        elif command -v xterm &> /dev/null; then
            xterm -title "$title" -e "cd '$PWD/$directory' && $command && bash" &
        else
            echo "No terminal emulator found. Starting $title in background..."
            cd "$PWD/$directory" && $command > "../logs/${title// /_}.log" 2>&1 &
            cd "$OLDPWD"
        fi
    else
        echo "Starting $title in background..."
        cd "$PWD/$directory" && $command > "../logs/${title// /_}.log" 2>&1 &
        cd "$OLDPWD"
    fi
}

# Start Laravel API
echo "Starting Laravel API..."
run_in_new_terminal "Laravel API" "php artisan serve --host=0.0.0.0 --port=8000" "api"

sleep 2

# Start React Frontend
echo "Starting React Frontend..."
run_in_new_terminal "React Frontend" "npm start" "frontend"

echo ""
echo "Development servers starting!"
echo "===================================================="
echo ""
echo "Frontend:      http://localhost:3000"
echo "Laravel API:   http://localhost:8000"
echo ""
echo "Development features:"
echo "   - Hot module replacement (React)"
echo "   - Error overlay in browser"
echo "   - API proxy to localhost:8000"
echo ""
echo "To stop all services, run: ./stop.sh"

# Wait a bit and try to open browser
sleep 5
if command -v open >/dev/null 2>&1; then
    echo ""
    echo "Opening browser..."
    open http://localhost:3000
fi
