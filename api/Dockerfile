FROM php:8.4-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    sqlite3 \
    libsqlite3-dev \
    supervisor \
    && docker-php-ext-install pdo_sqlite mbstring exif pcntl bcmath gd sockets

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy composer files
COPY composer.json composer.lock ./

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Copy application code
COPY . .

# Set permissions
RUN chown -R www-data:www-data /app \
    && chmod -R 755 /app/storage \
    && chmod -R 755 /app/bootstrap/cache

# Create SQLite database directory
RUN mkdir -p /app/database && touch /app/database/database.sqlite

# Install supervisor config for API (web server + queue worker)
COPY docker/supervisord-api.conf /etc/supervisor/conf.d/supervisord.conf

# Expose port
EXPOSE 8000

# Start supervisor to run both web server and queue worker
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]