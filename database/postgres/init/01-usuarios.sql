\connect usuarios_db
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'cliente'
        CHECK (rol IN ('cliente', 'administrador')),
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

GRANT USAGE ON SCHEMA public TO usuarios_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO usuarios_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO usuarios_user;
