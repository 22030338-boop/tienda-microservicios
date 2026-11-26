\connect inventario_db
CREATE TABLE IF NOT EXISTS inventario (
    producto_id BIGINT PRIMARY KEY,
    existencias INTEGER NOT NULL DEFAULT 0 CHECK (existencias >= 0),
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservas (
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL,
    producto_id BIGINT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'confirmada', 'liberada')),
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

GRANT USAGE ON SCHEMA public TO inventario_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO inventario_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO inventario_user;
