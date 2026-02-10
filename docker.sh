#!/bin/bash

# Football Fantasy Manager - Docker Mode
# Just run ./docker.sh and start playing

set -e

echo "Football Fantasy Manager - Docker Mode"
echo "========================================"

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker and try again."
    exit 1
fi

if ! docker compose version &> /dev/null 2>&1 && ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed."
    exit 1
fi

echo "OK: Docker found"

ACTION=${1:-up}

case "$ACTION" in
    up|start)
        echo ""
        echo "Building and starting services..."
        echo "(first run takes a few minutes to build images)"
        echo ""
        docker compose up --build -d

        echo ""
        echo "Waiting for API to be ready (migrations + seed running)..."

        # Wait for API health check
        MAX_ATTEMPTS=60
        ATTEMPT=1
        while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
            if curl -s http://localhost:8000/api/v1/test > /dev/null 2>&1; then
                break
            fi
            sleep 2
            ATTEMPT=$((ATTEMPT + 1))
        done

        if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
            echo "WARNING: API may still be starting. Check logs with: ./docker.sh logs api"
        fi

        echo ""
        echo "Ready! Open http://localhost:3000"
        echo "================================="
        echo ""
        echo "Frontend:      http://localhost:3000"
        echo "API:           http://localhost:8000"
        echo "Nginx proxy:   http://localhost:80"
        echo ""
        echo "Commands:"
        echo "  ./docker.sh logs       Follow logs"
        echo "  ./docker.sh logs api   Follow API logs only"
        echo "  ./docker.sh stop       Stop everything"
        echo "  ./docker.sh restart    Restart everything"
        echo "  ./docker.sh status     Show container status"
        ;;

    down|stop)
        echo "Stopping all services..."
        docker compose down
        echo "All services stopped."
        ;;

    logs)
        docker compose logs -f "${@:2}"
        ;;

    restart)
        echo "Restarting all services..."
        docker compose down
        docker compose up --build -d
        echo "All services restarted."
        ;;

    status|ps)
        docker compose ps
        ;;

    rebuild)
        echo "Full rebuild from scratch (no cache)..."
        docker compose down -v
        docker compose build --no-cache
        docker compose up -d
        echo "All services rebuilt and started."
        ;;

    reset)
        echo "Resetting database (fresh migrations + seed)..."
        docker compose exec api php artisan migrate:fresh --force --seed
        echo "Database reset complete."
        ;;

    *)
        echo "Usage: ./docker.sh [command]"
        echo ""
        echo "Commands:"
        echo "  up|start     Build and start everything (default)"
        echo "  stop         Stop all services"
        echo "  restart      Stop, rebuild, and start"
        echo "  rebuild      Full rebuild from scratch (no cache)"
        echo "  reset        Reset database (fresh migrate + seed)"
        echo "  logs         Follow logs (optionally: ./docker.sh logs api)"
        echo "  status       Show running containers"
        ;;
esac
