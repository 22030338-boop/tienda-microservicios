package com.tienda.pagos;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class PedidosClientConfig {

    @Bean
    public RestClient pedidosRestClient(
            @Value("${servicios.pedidos.url}") String pedidosUrl) {

        return RestClient.builder()
                .baseUrl(pedidosUrl)
                .build();
    }
}
