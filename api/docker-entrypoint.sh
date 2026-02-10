#!/bin/bash
set -e

echo "=== Football Fantasy Manager API ==="

# Install dependencies if vendor is missing
if [ ! -d /app/vendor ] || [ ! -f /app/vendor/autoload.php ]; then
    echo "Installing PHP dependencies..."
    composer install --no-dev --optimize-autoloader
fi

# Create .env if missing
if [ ! -f /app/.env ]; then
    echo "Creating .env..."
    cat > /app/.env << 'EOF'
APP_NAME="Football Fantasy Manager"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
LOG_CHANNEL=stack
LOG_LEVEL=debug
DB_CONNECTION=sqlite
DB_DATABASE=/app/database/database.sqlite
CACHE_DRIVER=file
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120
EOF
fi

# Generate app key if not set
if ! grep -q "APP_KEY=base64:" /app/.env 2>/dev/null; then
    echo "Generating application key..."
    php artisan key:generate --force
fi

# Ensure SQLite database exists
mkdir -p /app/database
touch /app/database/database.sqlite

# Run migrations
echo "Running migrations..."
php artisan migrate --force

# Seed if database is empty (no teams = fresh DB)
TEAM_COUNT=$(php artisan tinker --execute="echo \App\Models\Team::count();" 2>/dev/null || echo "0")
if [ "$TEAM_COUNT" = "0" ] || [ -z "$TEAM_COUNT" ]; then
    echo "Seeding database..."
    php artisan db:seed --force
else
    echo "Database already seeded ($TEAM_COUNT teams found)"
fi

# Clear caches
php artisan config:clear
php artisan route:clear

echo "=== API ready on port 8000 ==="

# Start the server
exec php artisan serve --host=0.0.0.0 --port=8000
