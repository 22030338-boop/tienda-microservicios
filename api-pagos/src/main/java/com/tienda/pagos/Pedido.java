package com.tienda.pagos;

import java.math.BigDecimal;

public record Pedido(
        Long id,
        Long usuario_id,
        BigDecimal total,
        String estado
) {}
