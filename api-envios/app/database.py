import os

import psycopg
from psycopg.rows import dict_row


def get_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "envios_db"),
        user=os.getenv("DB_USER", "envios_user"),
        password=os.getenv("DB_PASSWORD"),
        row_factory=dict_row,
        connect_timeout=5,
    )


def init_db():
    """Agrega las columnas necesarias sin eliminar datos existentes."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                ALTER TABLE envios
                ADD COLUMN IF NOT EXISTS zona VARCHAR(20)
                    NOT NULL DEFAULT 'nacional',
                ADD COLUMN IF NOT EXISTS peso_kg NUMERIC(8,2)
                    NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS dias_estimados INTEGER
                    NOT NULL DEFAULT 5,
                ADD COLUMN IF NOT EXISTS fecha_estimada_entrega DATE,
                ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP
                    NOT NULL DEFAULT CURRENT_TIMESTAMP;
            """)

            cursor.execute("""
                UPDATE envios
                SET fecha_estimada_entrega =
                    creado_en::date + dias_estimados
                WHERE fecha_estimada_entrega IS NULL;
            """)
