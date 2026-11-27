package com.tienda.pagos;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record Pago(
        @JsonProperty("id_transaccion") String idTransaccion,
        @JsonProperty("pedido_id") Long pedidoId,
        @JsonProperty("monto") BigDecimal monto,
        @JsonProperty("metodo_pago") String metodoPago,
        @JsonProperty("estado") String estado,      // "aprobado" | "rechazado"
        @JsonProperty("motivo") String motivo,      // solo si fue rechazado
        @JsonProperty("recibo") String recibo,      // solo si fue aprobado
        @JsonProperty("fecha") String fecha
) {}