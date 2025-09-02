#!/bin/bash

echo "FORCEFULLY DROPPING ALL TABLES AND RUNNING MIGRATIONS!"

# Delete database.sqlite file if it exists
if [ -f database/database.sqlite ]; then
  echo "Deleting SQLite database file..."
  rm database/database.sqlite
fi

# Create database.sqlite file if it doesn't exist
if [ ! -f database/database.sqlite ]; then
  echo "Creating new SQLite database file..."
  touch database/database.sqlite
fi

# Run migrations on fresh database
echo "Running migrations on fresh database..."
php artisan migrate --force
echo "All migrations have been run successfully on a fresh database."

# Run database seeders
echo "Running database seeders..."
php artisan db:seed --force
echo "All seeders have been run successfully."
