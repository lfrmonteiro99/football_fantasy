#!/bin/bash

# Football Fantasy Manager - Initial Setup Script
# This script sets up the entire application for first-time use

set -e

echo "⚽ Football Fantasy Manager - Initial Setup"
echo "=========================================="

# Check prerequisites
echo ""
echo "🔍 Checking prerequisites..."

# Check PHP
if ! command -v php &> /dev/null; then
    echo "❌ PHP is not installed. Please install PHP 8.1+ and try again."
    exit 1
fi

PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ PHP $PHP_VERSION found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm $NPM_VERSION found"

# Check Composer
if ! command -v composer &> /dev/null; then
    echo "❌ Composer is not installed. Please install Composer and try again."
    echo "   Visit: https://getcomposer.org/download/"
    exit 1
fi

COMPOSER_VERSION=$(composer --version | cut -d' ' -f3)
echo "✅ Composer $COMPOSER_VERSION found"

echo ""
echo "1️⃣  Setting up Laravel API..."
echo "-----------------------------"
cd api

echo "📦 Installing PHP dependencies..."
composer install

echo "🔧 Setting up environment..."
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

MEMCACHED_HOST=127.0.0.1

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=mailhog
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS=null
MAIL_FROM_NAME="\${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=mt1

MIX_PUSHER_APP_KEY="\${PUSHER_APP_KEY}"
MIX_PUSHER_APP_CLUSTER="\${PUSHER_APP_CLUSTER}"

# Match Simulator Configuration
MATCH_SIMULATOR_URLS=http://localhost:8001
MATCH_SIMULATOR_TIMEOUT=300
MATCH_SIMULATOR_MAX_CONCURRENT=3

# OpenAI (optional)
OPENAI_API_KEY=
EOF
fi

echo "🔑 Generating application key..."
php artisan key:generate

echo "🗄️  Setting up database..."
touch database/database.sqlite
php artisan migrate --force

echo "🌱 Seeding database with sample data..."
php artisan db:seed --force

cd ..

echo ""
echo "2️⃣  Setting up Match Simulator Microservice..."
echo "----------------------------------------------"
cd match-simulator

echo "📦 Installing Node.js dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

cd ..

echo ""
echo "3️⃣  Setting up React Frontend..."
echo "--------------------------------"
cd frontend

echo "📦 Installing React dependencies..."
npm install

cd ..

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "🚀 Ready to start! Choose an option:"
echo ""
echo "   Production Mode:    ./start.sh"
echo "   Development Mode:   ./dev.sh"
echo "   Docker Mode:        npm run docker:up"
echo ""
echo "📊 Check status:       ./status.sh"
echo "🛑 Stop services:      ./stop.sh"
echo ""
echo "🌐 After starting, visit: http://localhost:3000"