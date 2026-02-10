#!/bin/bash

# Football Fantasy Manager - Initial Setup Script
# Sets up the application for local development (non-Docker)
# For Docker, just run: ./docker.sh

set -e

echo "Football Fantasy Manager - Local Setup"
echo "========================================"
echo ""
echo "NOTE: For Docker (no local dependencies needed), just run: ./docker.sh"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check PHP
if ! command -v php &> /dev/null; then
    echo "ERROR: PHP is not installed. Please install PHP 8.1+ and try again."
    echo "       Or use Docker instead: ./docker.sh"
    exit 1
fi

PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "OK: PHP $PHP_VERSION found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 16+ and try again."
    echo "       Or use Docker instead: ./docker.sh"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "OK: Node.js $NODE_VERSION found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed. Please install npm and try again."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "OK: npm $NPM_VERSION found"

# Check Composer — fall back to Docker if not installed
USE_DOCKER_COMPOSER=false
if command -v composer &> /dev/null; then
    COMPOSER_VERSION=$(composer --version | cut -d' ' -f3)
    echo "OK: Composer $COMPOSER_VERSION found"
elif command -v docker &> /dev/null; then
    echo "WARNING: Composer not installed locally, using Docker container instead"
    USE_DOCKER_COMPOSER=true
else
    echo "ERROR: Neither Composer nor Docker is installed."
    echo "   Install Composer: https://getcomposer.org/download/"
    echo "   Or install Docker and run: ./docker.sh"
    exit 1
fi

echo ""
echo "1/2  Setting up Laravel API..."
echo "-----------------------------"
cd api

echo "Installing PHP dependencies..."
if [ "$USE_DOCKER_COMPOSER" = true ]; then
    docker run --rm -v "$(pwd):/app" -w /app composer:latest install
else
    composer install
fi

echo "Setting up environment..."
if [ ! -f ".env" ]; then
    cat > .env << EOF
APP_NAME="Football Fantasy Manager"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=sqlite
DB_DATABASE=./database/database.sqlite

BROADCAST_DRIVER=log
CACHE_DRIVER=file
FILESYSTEM_DRIVER=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

# OpenAI (optional - simulation works without it)
OPENAI_API_KEY=
EOF
fi

echo "Generating application key..."
php artisan key:generate

echo "Setting up database..."
touch database/database.sqlite
php artisan migrate --force

echo "Seeding database with sample data..."
php artisan db:seed --force

cd ..

echo ""
echo "2/2  Setting up React Frontend..."
echo "--------------------------------"
cd frontend

echo "Installing React dependencies..."
npm install

cd ..

echo ""
echo "Setup Complete!"
echo "=================="
echo ""
echo "Ready to start! Choose an option:"
echo ""
echo "   Local Mode:         ./start.sh"
echo "   Development Mode:   ./dev.sh"
echo "   Docker Mode:        ./docker.sh"
echo ""
echo "Check status:          ./status.sh"
echo "Stop services:         ./stop.sh"
echo ""
echo "After starting, visit: http://localhost:3000"
