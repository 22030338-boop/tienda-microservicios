\connect envios_db
CREATE TABLE IF NOT EXISTS envios (
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL UNIQUE,
    destinatario VARCHAR(150) NOT NULL,
    direccion TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    costo NUMERIC(10,2) NOT NULL CHECK (costo >= 0),
    numero_seguimiento VARCHAR(100) UNIQUE,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

GRANT USAGE ON SCHEMA public TO envios_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO envios_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO envios_user;
