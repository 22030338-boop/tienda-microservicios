import json
import os
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, Request as FastAPIRequest
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from starlette.exceptions import HTTPException as StarletteHTTPException


app = FastAPI(title="api-resenas")

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Configuración de microservicios =====
USUARIOS_API_URL = os.getenv(
    "USUARIOS_API_URL",
    "http://api-usuarios:8001"
).rstrip("/")

PRODUCTOS_API_URL = os.getenv(
    "PRODUCTOS_API_URL",
    "http://api-productos:8002"
).rstrip("/")


# ===== Conexión a MongoDB =====
cliente = MongoClient(
    host=os.getenv("MONGO_HOST", "mongodb"),
    port=int(os.getenv("MONGO_PORT", "27017")),
    username=os.getenv("MONGO_USER"),
    password=os.getenv("MONGO_PASSWORD"),
    authSource=os.getenv("MONGO_DB", "resenas_db"),
    serverSelectionTimeoutMS=5000,
    tz_aware=True,
)

coleccion = cliente[os.getenv("MONGO_DB", "resenas_db")]["resenas"]


# ===== Modelo de entrada =====
class NuevaResena(BaseModel):
    model_config = ConfigDict(extra="forbid")

    producto_id: int = Field(gt=0)
    calificacion: int = Field(ge=1, le=5)
    comentario: str

    @field_validator("comentario")
    @classmethod
    def comentario_no_vacio(cls, v: str) -> str:
        v = v.strip()

        if not v:
            raise ValueError("el comentario no puede estar vacío")

        return v


# ===== Comunicación entre microservicios =====
def solicitar_servicio(url: str, headers: dict | None = None):
    try:
        solicitud = Request(
            url,
            headers=headers or {},
            method="GET"
        )

        with urlopen(solicitud, timeout=5) as respuesta:
            contenido = respuesta.read().decode("utf-8")

            return respuesta.status, json.loads(contenido)

    except HTTPError as error:
        try:
            contenido = error.read().decode("utf-8")
            datos = json.loads(contenido)
        except (ValueError, UnicodeDecodeError):
            datos = None

        return error.code, datos

    except (URLError, TimeoutError, OSError, ValueError):
        return 0, None


# ===== Validar usuario mediante JWT =====
def validar_usuario_autenticado(authorization: str | None):
    if not authorization:
        return False, 401, None, "Se requiere autenticación."

    esquema, separador, token = authorization.partition(" ")

    if (
        not separador
        or esquema.lower() != "bearer"
        or not token.strip()
    ):
        return False, 401, None, "Token Bearer inválido."

    codigo, datos = solicitar_servicio(
        f"{USUARIOS_API_URL}/api/usuarios/perfil",
        headers={
            "Authorization": authorization
        }
    )

    if codigo == 200 and datos and datos.get("usuario"):
        usuario = datos["usuario"]
        usuario_id = usuario.get("id")

        if usuario_id is not None:
            return True, 200, usuario_id, None

        return False, 502, None, "Respuesta de usuario inválida."

    if codigo in (401, 404):
        return False, 401, None, "Token inválido o usuario no disponible."

    return False, 502, None, "No se pudo validar la autenticación."


# ===== Validar producto =====
def validar_producto(producto_id: int):
    codigo, datos = solicitar_servicio(
        f"{PRODUCTOS_API_URL}/api/productos/{producto_id}"
    )

    if codigo == 200 and datos and datos.get("producto"):
        return True, 200, None

    if codigo == 404:
        return False, 404, "El producto no existe o no está disponible."

    return False, 502, "No se pudo validar el producto."


# ===== Formato de respuesta =====
def formatear(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "producto_id": doc["producto_id"],
        "usuario_id": doc["usuario_id"],
        "calificacion": doc["calificacion"],
        "comentario": doc["comentario"],
        "fecha": doc["fecha"].isoformat(),
    }


# ===== Manejo de errores =====
@app.exception_handler(RequestValidationError)
async def error_validacion(
    request: FastAPIRequest,
    exc: RequestValidationError
):
    err = exc.errors()[0]
    campo = str(err["loc"][-1]) if err["loc"] else "cuerpo"
    mensaje = err["msg"].removeprefix("Value error, ")

    return JSONResponse(
        status_code=400,
        content={"error": f"{campo}: {mensaje}"}
    )


@app.exception_handler(StarletteHTTPException)
async def error_http(
    request: FastAPIRequest,
    exc: StarletteHTTPException
):
    if exc.status_code == 404:
        return JSONResponse(
            status_code=404,
            content={"error": "Ruta no encontrada"}
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc.detail)}
    )


@app.exception_handler(PyMongoError)
async def error_mongo(
    request: FastAPIRequest,
    exc: PyMongoError
):
    print(f"Error de MongoDB: {exc}", flush=True)

    return JSONResponse(
        status_code=500,
        content={"error": "Error interno de base de datos"}
    )


# ===== Endpoints =====
@app.get("/health")
def health():
    return {
        "servicio": "api-resenas",
        "status": "ok"
    }


@app.get("/api/resenas/producto/{producto_id}")
def resenas_por_producto(producto_id: int):
    if producto_id <= 0:
        return JSONResponse(
            status_code=400,
            content={"error": "producto_id inválido"}
        )

    docs = list(
        coleccion.find(
            {"producto_id": producto_id}
        ).sort("_id", -1)
    )

    promedio = (
        round(
            sum(d["calificacion"] for d in docs) / len(docs),
            2
        )
        if docs
        else 0
    )

    return {
        "producto_id": producto_id,
        "promedio": promedio,
        "total": len(docs),
        "resenas": [formatear(d) for d in docs]
    }


@app.post("/api/resenas", status_code=201)
def crear_resena(
    datos: NuevaResena,
    request: FastAPIRequest
):
    # 1. Obtener el usuario autenticado mediante JWT.
    usuario_valido, codigo, usuario_id, mensaje = (
        validar_usuario_autenticado(
            request.headers.get("Authorization")
        )
    )

    if not usuario_valido:
        return JSONResponse(
            status_code=codigo,
            content={"error": mensaje}
        )

    # 2. Verificar que el producto exista y esté activo.
    producto_valido, codigo, mensaje = validar_producto(
        datos.producto_id
    )

    if not producto_valido:
        return JSONResponse(
            status_code=codigo,
            content={"error": mensaje}
        )

    # 3. Construir documento con el ID obtenido del JWT.
    doc = {
        "producto_id": datos.producto_id,
        "usuario_id": usuario_id,
        "calificacion": datos.calificacion,
        "comentario": datos.comentario,
        "fecha": datetime.now(timezone.utc),
    }

    # 4. Guardar en MongoDB.
    try:
        resultado = coleccion.insert_one(doc)

    except DuplicateKeyError:
        return JSONResponse(
            status_code=400,
            content={
                "error": "El usuario ya dejó una reseña para este producto"
            }
        )

    doc["_id"] = resultado.inserted_id

    return formatear(doc)