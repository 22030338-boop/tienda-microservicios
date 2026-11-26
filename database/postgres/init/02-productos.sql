\connect productos_db
CREATE TABLE IF NOT EXISTS categorias (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS productos (
    id BIGSERIAL PRIMARY KEY,
    categoria_id BIGINT REFERENCES categorias(id),
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

GRANT USAGE ON SCHEMA public TO productos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO productos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO productos_user;
