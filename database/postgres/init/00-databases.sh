
#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" <<'EOSQL'

-- Usuarios
CREATE ROLE usuarios_user LOGIN PASSWORD 'SECRET_USUARIOS';
CREATE DATABASE usuarios_db OWNER usuarios_user;

-- Productos
CREATE ROLE productos_user LOGIN PASSWORD 'SECRET_PRODUCTOS';
CREATE DATABASE productos_db OWNER productos_user;

-- Envíos
CREATE ROLE envios_user LOGIN PASSWORD 'SECRET_ENVIOS';
CREATE DATABASE envios_db OWNER envios_user;

-- Inventario
CREATE ROLE inventario_user LOGIN PASSWORD 'SECRET_INVENTARIO';
CREATE DATABASE inventario_db OWNER inventario_user;

-- Carrito
CREATE ROLE carrito_user LOGIN PASSWORD 'SECRET_CARRITO';
CREATE DATABASE carrito_db OWNER carrito_user;

-- Pedidos
CREATE ROLE pedidos_user LOGIN PASSWORD 'SECRET_PEDIDOS';
CREATE DATABASE pedidos_db OWNER pedidos_user;

-- Pagos
CREATE ROLE pagos_user LOGIN PASSWORD 'SECRET_PAGOS';
CREATE DATABASE pagos_db OWNER pagos_user;

EOSQL
