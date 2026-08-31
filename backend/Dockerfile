FROM php:8.3-fpm-alpine

# Install system dependencies + nginx + supervisor
# git + unzip let Composer fall back to a git clone if a dist zip download
# from GitHub returns a transient error (e.g. HTTP 400 from codeload).
RUN apk add --no-cache \
    autoconf \
    g++ \
    make \
    openssl-dev \
    curl \
    git \
    unzip \
    nginx \
    supervisor

# Install PDO MySQL extension (MariaDB)
RUN docker-php-ext-install pdo pdo_mysql

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy nginx and supervisor configs
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisord.conf

WORKDIR /var/www/html

COPY composer.json composer.lock* ./
# COMPOSER_ALLOW_SUPERUSER silences the root warning; if a dist (zip) download
# fails transiently, retry once preferring source (git clone) instead.
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --optimize-autoloader --no-security-blocking --no-progress \
    || composer install --no-dev --optimize-autoloader --no-security-blocking --no-progress --prefer-source
COPY . .

COPY frontend/ /var/www/frontend/

RUN chown -R www-data:www-data /var/www/html && \
    chown -R www-data:www-data /var/www/frontend

EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
