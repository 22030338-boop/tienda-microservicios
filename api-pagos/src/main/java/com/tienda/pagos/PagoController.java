package com.tienda.pagos;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class PagoController {

    private static final Set<String> METODOS_VALIDOS =
            Set.of("tarjeta", "paypal", "transferencia", "oxxo");

    // Regla de la simulación: montos mayores a este límite se rechazan
    private static final BigDecimal LIMITE_APROBACION = new BigDecimal("50000");
    private static final String MOTIVO_RECHAZO = "Monto excede el límite permitido por la pasarela";

    private static final String SELECT_PAGO =
            "SELECT id, pedido_id, metodo, monto, estado, referencia, fecha FROM pagos ";

    private final JdbcTemplate jdbc;

    public PagoController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // Convierte una fila de la tabla "pagos" en el comprobante que devuelve la API
    private Pago mapear(ResultSet rs, int fila) throws SQLException {
        long id = rs.getLong("id");
        String estado = rs.getString("estado");
        boolean aprobado = "aprobado".equals(estado);

        return new Pago(
                rs.getString("referencia"),
                rs.getLong("pedido_id"),
                rs.getBigDecimal("monto"),
                rs.getString("metodo"),
                estado,
                aprobado ? null : MOTIVO_RECHAZO,
                aprobado ? String.format("REC-%08d", id) : null,
                rs.getTimestamp("fecha").toLocalDateTime().toString()
        );
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("servicio", "api-pagos", "status", "ok");
    }

    @PostMapping("/api/pagos/procesar")
    public ResponseEntity<Object> procesar(@Valid @RequestBody SolicitudPago solicitud) {
        String metodo = solicitud.metodoPago().toLowerCase();

        if (!METODOS_VALIDOS.contains(metodo)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "metodo_pago inválido. Valores: tarjeta, paypal, transferencia, oxxo"));
        }

        Integer aprobados = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pagos WHERE pedido_id = ? AND estado = 'aprobado'",
                Integer.class, solicitud.pedidoId());
        if (aprobados != null && aprobados > 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "El pedido ya tiene un pago aprobado"));
        }

        // Simulación de la pasarela
        boolean aprobado = solicitud.monto().compareTo(LIMITE_APROBACION) <= 0;

        Long id = jdbc.queryForObject(
                "INSERT INTO pagos (pedido_id, metodo, monto, estado, referencia) "
                        + "VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                solicitud.pedidoId(),
                metodo,
                solicitud.monto(),
                aprobado ? "aprobado" : "rechazado",
                UUID.randomUUID().toString());

        Pago pago = jdbc.queryForObject(SELECT_PAGO + "WHERE id = ?", this::mapear, id);
        return ResponseEntity.status(HttpStatus.CREATED).body(pago);
    }

    @GetMapping("/api/pagos/pedido/{pedidoId}")
    public ResponseEntity<Object> porPedido(@PathVariable Long pedidoId) {
        // El comprobante más reciente del pedido
        List<Pago> pagos = jdbc.query(
                SELECT_PAGO + "WHERE pedido_id = ? ORDER BY id DESC LIMIT 1",
                this::mapear, pedidoId);

        if (pagos.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "No hay pagos registrados para ese pedido"));
        }
        return ResponseEntity.ok(pagos.get(0));
    }
}