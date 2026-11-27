package com.tienda.pagos;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record SolicitudPago(
        @NotNull(message = "pedido_id es obligatorio")
        @JsonProperty("pedido_id") Long pedidoId,

        @NotNull(message = "monto es obligatorio")
        @Positive(message = "monto debe ser mayor a 0")
        @JsonProperty("monto") BigDecimal monto,

        @NotBlank(message = "metodo_pago es obligatorio")
        @JsonProperty("metodo_pago") String metodoPago
) {}