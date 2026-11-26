\connect pedidos_db
CREATE TABLE IF NOT EXISTS pedidos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS pedido_detalles (
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL,
    nombre_producto VARCHAR(150) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)
);

GRANT USAGE ON SCHEMA public TO pedidos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pedidos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pedidos_user;
