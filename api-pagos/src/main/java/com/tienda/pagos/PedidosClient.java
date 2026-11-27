package com.tienda.pagos;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Component
public class PedidosClient {

    private final RestClient restClient;
    private final String internalServiceKey;

    public PedidosClient(
            RestClient pedidosRestClient,
            @Value("${servicios.interna.clave}") String internalServiceKey) {

        this.restClient = pedidosRestClient;
        this.internalServiceKey = internalServiceKey;
    }

    public Pedido obtenerPedido(Long pedidoId) {
        try {
            return restClient.get()
                    .uri("/api/pedidos/{id}", pedidoId)
                    .retrieve()
                    .body(Pedido.class);

        } catch (HttpClientErrorException.NotFound ex) {
            throw new PedidoNoEncontradoException();

        } catch (RestClientException ex) {
            throw new ServicioPedidosException();
        }
    }

    public void actualizarEstado(Long pedidoId, String estado) {
        try {
            restClient.patch()
                    .uri("/api/pedidos/{id}/estado", pedidoId)
                    .header("X-Internal-Service-Key", internalServiceKey)
                    .body(Map.of("estado", estado))
                    .retrieve()
                    .toBodilessEntity();

        } catch (HttpClientErrorException.NotFound ex) {
            throw new PedidoNoEncontradoException();

        } catch (RestClientException ex) {
            throw new ServicioPedidosException();
        }
    }
}
