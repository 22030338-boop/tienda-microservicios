import os
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI(title="api-resenas")

# CORS para que Angular pueda consumir la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Conexión a MongoDB =====
# El usuario se creó dentro de resenas_db, por eso authSource apunta ahí.
# Se pasan usuario y contraseña por separado (no en la URI) para que
# caracteres especiales en la contraseña no rompan la conexión.
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
    producto_id: int = Field(gt=0)
    usuario_id: int = Field(gt=0)
    calificacion: int = Field(ge=1, le=5)
    comentario: str

    @field_validator("comentario")
    @classmethod
    def comentario_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("el comentario no puede estar vacío")
        return v


def formatear(doc: dict) -> dict:
    """Convierte un documento de Mongo al JSON que devuelve la API."""
    return {
        "id": str(doc["_id"]),
        "producto_id": doc["producto_id"],
        "usuario_id": doc["usuario_id"],
        "calificacion": doc["calificacion"],
        "comentario": doc["comentario"],
        "fecha": doc["fecha"].isoformat(),
    }


# ===== Manejo de errores: siempre JSON con la llave "error" =====
@app.exception_handler(RequestValidationError)
async def error_validacion(request: Request, exc: RequestValidationError):
    err = exc.errors()[0]
    campo = str(err["loc"][-1]) if err["loc"] else "cuerpo"
    mensaje = err["msg"].removeprefix("Value error, ")
    return JSONResponse(status_code=400, content={"error": f"{campo}: {mensaje}"})


@app.exception_handler(StarletteHTTPException)
async def error_http(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return JSONResponse(status_code=404, content={"error": "Ruta no encontrada"})
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(PyMongoError)
async def error_mongo(request: Request, exc: PyMongoError):
    print(f"Error de MongoDB: {exc}", flush=True)
    return JSONResponse(
        status_code=500, content={"error": "Error interno de base de datos"}
    )


# ===== Endpoints =====
@app.get("/health")
def health():
    return {"servicio": "api-resenas", "status": "ok"}


@app.get("/api/resenas/producto/{producto_id}")
def resenas_por_producto(producto_id: int):
    docs = list(coleccion.find({"producto_id": producto_id}).sort("_id", -1))
    promedio = (
        round(sum(d["calificacion"] for d in docs) / len(docs), 2) if docs else 0
    )
    return {
        "producto_id": producto_id,
        "promedio": promedio,
        "total": len(docs),
        "resenas": [formatear(d) for d in docs],  # las más recientes primero
    }


@app.post("/api/resenas", status_code=201)
def crear_resena(datos: NuevaResena):
    doc = {
        "producto_id": datos.producto_id,
        "usuario_id": datos.usuario_id,
        "calificacion": datos.calificacion,
        "comentario": datos.comentario,
        "fecha": datetime.now(timezone.utc),
    }
    try:
        resultado = coleccion.insert_one(doc)
    except DuplicateKeyError:
        # Lo lanza el índice único (usuario_id, producto_id) de 01-resenas.js
        return JSONResponse(
            status_code=400,
            content={"error": "El usuario ya dejó una reseña para este producto"},
        )
    doc["_id"] = resultado.inserted_id
    return formatear(doc)