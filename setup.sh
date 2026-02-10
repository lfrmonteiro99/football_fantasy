#!/bin/bash

# Football Fantasy Manager - Initial Setup Script
# This script sets up the entire application for first-time use

set -e

echo "Football Fantasy Manager - Initial Setup"
echo "=========================================="

# Check prerequisites
echo ""
echo "Checking prerequisites..."

# Check PHP
if ! command -v php &> /dev/null; then
    echo "ERROR: PHP is not installed. Please install PHP 8.1+ and try again."
    exit 1
fi

PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "OK: PHP $PHP_VERSION found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 16+ and try again."
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

# Check Composer
if ! command -v composer &> /dev/null; then
    echo "ERROR: Composer is not installed. Please install Composer and try again."
    echo "   Visit: https://getcomposer.org/download/"
    exit 1
fi

COMPOSER_VERSION=$(composer --version | cut -d' ' -f3)
echo "OK: Composer $COMPOSER_VERSION found"

echo ""
echo "1/2  Setting up Laravel API..."
echo "-----------------------------"
cd api

echo "Installing PHP dependencies..."
composer install

echo "Setting up environment..."
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || echo "No .env.example found, creating basic .env"
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
echo "   Docker Mode:        docker-compose up --build"
echo ""
echo "Check status:          ./status.sh"
echo "Stop services:         ./stop.sh"
echo ""
echo "After starting, visit: http://localhost:3000"
