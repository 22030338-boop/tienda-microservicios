package com.tienda.pagos;

public class ServicioPedidosException extends RuntimeException {

    public ServicioPedidosException() {
        super("No fue posible consultar el servicio de pedidos");
    }
}
