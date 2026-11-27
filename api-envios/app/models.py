TARIFAS = {
    "local": {
        "base": 50.00,
        "dias": 1,
    },
    "regional": {
        "base": 90.00,
        "dias": 2,
    },
    "nacional": {
        "base": 150.00,
        "dias": 5,
    },
}

COSTO_KILOGRAMO_ADICIONAL = 15.00

ESTADOS_ENVIO = [
    "pendiente",
    "preparando",
    "en_transito",
    "entregado",
    "cancelado",
]


def calcular_tarifa(zona: str, peso_kg: float):
    tarifa = TARIFAS[zona]

    kilogramos_adicionales = max(0, peso_kg - 1)
    costo_adicional = kilogramos_adicionales * (
        COSTO_KILOGRAMO_ADICIONAL
    )

    costo = round(tarifa["base"] + costo_adicional, 2)

    return {
        "zona": zona,
        "peso_kg": peso_kg,
        "costo": costo,
        "dias_estimados": tarifa["dias"],
    }
