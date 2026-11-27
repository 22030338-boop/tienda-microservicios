import json
import os

from fastapi.middleware.cors import CORSMiddleware
from datetime import date, timedelta
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from psycopg.errors import UniqueViolation

from app.database import get_connection
from app.models import calcular_tarifa
from app.schemas import (
    ActualizarEstadoRequest,
    CotizacionRequest,
    CrearEnvioRequest,
)


API_PEDIDOS_URL = os.getenv(
    "API_PEDIDOS_URL",
    "http://api-pedidos:8006",
)


app = FastAPI(
    title="API de Envíos",
    description=(
        "Microservicio para cotizar, registrar "
        "y rastrear envíos de la tienda."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def consultar_pedido(pedido_id: int):
    url = (
        f"{API_PEDIDOS_URL.rstrip('/')}"
        f"/api/pedidos/{pedido_id}"
    )

    request = Request(
        url,
        headers={"Accept": "application/json"},
    )

    try:
        with urlopen(request, timeout=5) as response:
            pedido = json.loads(
                response.read().decode("utf-8")
            )

    except HTTPError as error:
        if error.code == 404:
            raise HTTPException(
                status_code=404,
                detail="El pedido no existe",
            )

        raise HTTPException(
            status_code=502,
            detail="Error al consultar el pedido",
        )

    except (URLError, TimeoutError, json.JSONDecodeError):
        raise HTTPException(
            status_code=502,
            detail="No se pudo comunicar con api-pedidos",
        )

    if not isinstance(pedido, dict):
        raise HTTPException(
            status_code=502,
            detail="Respuesta inválida de api-pedidos",
        )

    return pedido


@app.get("/api/salud")
def salud():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()

        return {
            "servicio": "api-envios",
            "estado": "activo",
            "base_datos": "conectada",
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="No se pudo conectar con PostgreSQL",
        )


@app.post("/api/envios/cotizar")
def cotizar_envio(datos: CotizacionRequest):
    cotizacion = calcular_tarifa(
        datos.zona,
        datos.peso_kg,
    )

    return {
        "mensaje": "Cotización calculada correctamente",
        "cotizacion": cotizacion,
    }


@app.post(
    "/api/envios",
    status_code=status.HTTP_201_CREATED,
)
def crear_envio(datos: CrearEnvioRequest):

    # Validar que el pedido exista.
    pedido = consultar_pedido(datos.pedido_id)

    # Solo se permiten pedidos pagados.
    if pedido.get("estado") != "pagado":
        raise HTTPException(
            status_code=409,
            detail=(
                "No se puede generar un envío. "
                "El pedido debe estar pagado."
            ),
        )

    cotizacion = calcular_tarifa(
        datos.zona,
        datos.peso_kg,
    )

    numero_seguimiento = (
        f"ENV-{uuid4().hex[:12].upper()}"
    )

    fecha_estimada = (
        date.today()
        + timedelta(days=cotizacion["dias_estimados"])
    )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO envios (
                        pedido_id,
                        destinatario,
                        direccion,
                        ciudad,
                        costo,
                        numero_seguimiento,
                        estado,
                        zona,
                        peso_kg,
                        dias_estimados,
                        fecha_estimada_entrega
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s,
                        'pendiente', %s, %s, %s, %s
                    )
                    RETURNING *;
                    """,
                    (
                        datos.pedido_id,
                        datos.destinatario,
                        datos.direccion,
                        datos.ciudad,
                        cotizacion["costo"],
                        numero_seguimiento,
                        datos.zona,
                        datos.peso_kg,
                        cotizacion["dias_estimados"],
                        fecha_estimada,
                    ),
                )

                envio = cursor.fetchone()

        return {
            "mensaje": "Envío registrado correctamente",
            "envio": envio,
        }

    except UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="Ya existe un envío para este pedido",
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="No se pudo registrar el envío",
        )


@app.get("/api/envios/{envio_id}")
def obtener_envio(envio_id: int):

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM envios WHERE id = %s",
                (envio_id,),
            )

            envio = cursor.fetchone()

    if not envio:
        raise HTTPException(
            status_code=404,
            detail="Envío no encontrado",
        )

    return {"envio": envio}


@app.get("/api/envios/pedido/{pedido_id}")
def obtener_envio_por_pedido(pedido_id: int):

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM envios
                WHERE pedido_id = %s
                """,
                (pedido_id,),
            )

            envio = cursor.fetchone()

    if not envio:
        raise HTTPException(
            status_code=404,
            detail="No existe un envío para este pedido",
        )

    return {"envio": envio}


@app.get("/api/envios/rastreo/{numero_seguimiento}")
def rastrear_envio(numero_seguimiento: str):

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    pedido_id,
                    destinatario,
                    ciudad,
                    numero_seguimiento,
                    estado,
                    creado_en,
                    fecha_estimada_entrega,
                    actualizado_en
                FROM envios
                WHERE numero_seguimiento = %s
                """,
                (numero_seguimiento,),
            )

            envio = cursor.fetchone()

    if not envio:
        raise HTTPException(
            status_code=404,
            detail="Número de seguimiento no encontrado",
        )

    return {
        "mensaje": "Información de seguimiento",
        "seguimiento": envio,
    }


@app.put("/api/envios/{envio_id}/estado")
def actualizar_estado(
    envio_id: int,
    datos: ActualizarEstadoRequest,
):

    transiciones = {
        "pendiente": ["preparando", "cancelado"],
        "preparando": ["en_transito", "cancelado"],
        "en_transito": ["entregado"],
        "entregado": [],
        "cancelado": [],
    }

    with get_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                """
                SELECT estado FROM envios
                WHERE id = %s
                FOR UPDATE
                """,
                (envio_id,),
            )

            envio_actual = cursor.fetchone()

            if not envio_actual:
                raise HTTPException(
                    status_code=404,
                    detail="Envío no encontrado",
                )

            estado_actual = envio_actual["estado"]

            estados_permitidos = transiciones.get(
                estado_actual,
                [],
            )

            if datos.estado not in estados_permitidos:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"No se permite cambiar de "
                        f"{estado_actual} a {datos.estado}"
                    ),
                )

            cursor.execute(
                """
                UPDATE envios
                SET estado = %s,
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *;
                """,
                (datos.estado, envio_id),
            )

            envio_actualizado = cursor.fetchone()

    return {
        "mensaje": "Estado actualizado correctamente",
        "envio": envio_actualizado,
    }