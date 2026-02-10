#!/bin/bash

# Football Fantasy Manager - Docker Mode
# Starts all services using Docker Compose

set -e

echo "Football Fantasy Manager - Docker Mode"
echo "========================================"

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker and try again."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

echo "OK: Docker found"

ACTION=${1:-up}

case "$ACTION" in
    up|start)
        echo ""
        echo "Building and starting services..."
        echo ""
        docker compose up --build -d

        echo ""
        echo "Waiting for services to be ready..."
        sleep 5

        echo ""
        echo "Services running!"
        echo "=========================="
        echo ""
        echo "Frontend:      http://localhost:3000"
        echo "API:           http://localhost:8000"
        echo "Nginx proxy:   http://localhost:80"
        echo ""
        echo "To view logs:  ./docker.sh logs"
        echo "To stop:       ./docker.sh stop"
        echo ""

        # Run migrations and seed inside the container
        echo "Running database migrations and seed..."
        docker compose exec api php artisan migrate --force 2>/dev/null || true
        docker compose exec api php artisan db:seed --force 2>/dev/null || true
        echo "OK: Database ready"
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
        echo "Rebuilding all images from scratch..."
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        echo "All services rebuilt and started."
        ;;

    *)
        echo "Usage: ./docker.sh [command]"
        echo ""
        echo "Commands:"
        echo "  up|start     Build and start all services (default)"
        echo "  down|stop    Stop all services"
        echo "  restart      Stop, rebuild, and start"
        echo "  rebuild      Full rebuild from scratch (no cache)"
        echo "  logs         Follow logs (optionally: ./docker.sh logs api)"
        echo "  status|ps    Show running containers"
        ;;
esac
