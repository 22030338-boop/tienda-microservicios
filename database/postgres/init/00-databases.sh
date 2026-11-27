#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -v usuarios_password="$USUARIOS_DB_PASSWORD" \
    -v productos_password="$PRODUCTOS_DB_PASSWORD" \
    -v envios_password="$ENVIOS_DB_PASSWORD" \
    -v inventario_password="$INVENTARIO_DB_PASSWORD" \
    -v carrito_password="$CARRITO_DB_PASSWORD" \
    -v pedidos_password="$PEDIDOS_DB_PASSWORD" \
    -v pagos_password="$PAGOS_DB_PASSWORD" <<'EOSQL'

CREATE ROLE usuarios_user LOGIN PASSWORD :'usuarios_password';
CREATE DATABASE usuarios_db OWNER usuarios_user;

CREATE ROLE productos_user LOGIN PASSWORD :'productos_password';
CREATE DATABASE productos_db OWNER productos_user;

CREATE ROLE envios_user LOGIN PASSWORD :'envios_password';
CREATE DATABASE envios_db OWNER envios_user;

CREATE ROLE inventario_user LOGIN PASSWORD :'inventario_password';
CREATE DATABASE inventario_db OWNER inventario_user;

CREATE ROLE carrito_user LOGIN PASSWORD :'carrito_password';
CREATE DATABASE carrito_db OWNER carrito_user;

CREATE ROLE pedidos_user LOGIN PASSWORD :'pedidos_password';
CREATE DATABASE pedidos_db OWNER pedidos_user;

CREATE ROLE pagos_user LOGIN PASSWORD :'pagos_password';
CREATE DATABASE pagos_db OWNER pagos_user;

EOSQL
