from pydantic import BaseModel, Field


class CotizacionRequest(BaseModel):
    zona: str = Field(
        ...,
        pattern="^(local|regional|nacional)$"
    )
    peso_kg: float = Field(gt=0, le=100)


class CrearEnvioRequest(CotizacionRequest):
    pedido_id: int = Field(gt=0)
    destinatario: str = Field(min_length=2, max_length=150)
    direccion: str = Field(min_length=5)
    ciudad: str = Field(min_length=2, max_length=100)


class ActualizarEstadoRequest(BaseModel):
    estado: str = Field(
        ...,
        pattern="^(pendiente|preparando|en_transito|entregado|cancelado)$"
    )
