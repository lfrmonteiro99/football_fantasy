#!/bin/bash

# Football Fantasy Manager - Status Check Script
# Checks the status of all services

echo "Football Fantasy Manager - Status Check"
echo "=========================================="

# Function to check service status
check_service() {
    local url=$1
    local name=$2
    local port=$3

    printf "%-20s" "$name:"

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        if curl -s --max-time 5 "$url" >/dev/null 2>&1; then
            echo "RUNNING (Port $port)"
        else
            echo "PORT ACTIVE but not responding (Port $port)"
        fi
    else
        echo "NOT RUNNING (Port $port)"
    fi
}

# Function to get process info
get_process_info() {
    local port=$1

    PID=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PID" ]; then
        CMD=$(ps -p "$PID" -o comm= 2>/dev/null)
        echo "   PID: $PID, Process: $CMD"
    fi
}

echo ""
echo "Service Status:"
echo "------------------"

check_service "http://localhost:8000/api/v1/test" "Laravel API" "8000"
get_process_info "8000"

check_service "http://localhost:3000" "React Frontend" "3000"
get_process_info "3000"

echo ""
echo "Service URLs:"
echo "----------------"
echo "Frontend:      http://localhost:3000"
echo "Laravel API:   http://localhost:8000"

# Check for stored PIDs
echo ""
echo "Stored Process IDs:"
echo "----------------------"
if [ -f ".app_pids" ]; then
    PIDS=$(cat .app_pids)
    IFS=',' read -r API_PID FRONTEND_PID <<< "$PIDS"
    echo "Laravel API:     $API_PID"
    echo "React Frontend:  $FRONTEND_PID"
else
    echo "No stored PIDs (services may have been started manually)"
fi

# Check logs
echo ""
echo "Recent Log Activity:"
echo "-----------------------"
if [ -d "logs" ]; then
    for log in logs/*.log; do
        if [ -f "$log" ]; then
            size=$(wc -l < "$log" 2>/dev/null || echo "0")
            echo "$(basename "$log"): $size lines"
        fi
    done
else
    echo "No logs directory found"
fi

echo ""
echo "Quick Actions:"
echo "-----------------"
echo "./start.sh              - Start all services"
echo "./stop.sh               - Stop all services"
echo "./restart.sh            - Restart all services"
echo "./dev.sh                - Start in development mode"
echo "docker-compose up       - Start with Docker"
