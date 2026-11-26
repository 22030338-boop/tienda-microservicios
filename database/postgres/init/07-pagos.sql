\connect pagos_db
CREATE TABLE IF NOT EXISTS pagos (
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL,
    metodo VARCHAR(30) NOT NULL,
    monto NUMERIC(10,2) NOT NULL CHECK (monto >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    referencia VARCHAR(100),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

GRANT USAGE ON SCHEMA public TO pagos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pagos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pagos_user;
