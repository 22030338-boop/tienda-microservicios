\connect carrito_db
CREATE TABLE IF NOT EXISTS carritos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carrito_items (
    id BIGSERIAL PRIMARY KEY,
    carrito_id BIGINT NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    UNIQUE (carrito_id, producto_id)
);

GRANT USAGE ON SCHEMA public TO carrito_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO carrito_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO carrito_user;
