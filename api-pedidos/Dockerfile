FROM php:8.2-cli-alpine

# Extensión PDO para PostgreSQL (libpq-dev para compilar, libpq para ejecutar)
RUN apk add --no-cache libpq \
    && apk add --no-cache --virtual .build-deps postgresql-dev \
    && docker-php-ext-install pdo_pgsql \
    && apk del .build-deps

WORKDIR /app

COPY . .

EXPOSE 8006

CMD ["php", "-S", "0.0.0.0:8006", "index.php"]