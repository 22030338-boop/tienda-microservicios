package com.tienda.pagos;

public class PedidoNoEncontradoException extends RuntimeException {

    public PedidoNoEncontradoException() {
        super("Pedido no encontrado");
    }
}
