package com.tienda.pagos;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

@RestControllerAdvice
public class ManejadorErrores {

    private static final Logger log =
            LoggerFactory.getLogger(ManejadorErrores.class);

    @ExceptionHandler(PedidoNoEncontradoException.class)
    public ResponseEntity<Map<String, String>> pedidoNoEncontrado(
            PedidoNoEncontradoException ex) {

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(ServicioPedidosException.class)
    public ResponseEntity<Map<String, String>> servicioPedidos(
            ServicioPedidosException ex) {

        log.error("No fue posible comunicarse con api-pedidos", ex);

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> validacion(
            MethodArgumentNotValidException ex) {

        String mensaje = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(e -> e.getDefaultMessage())
                .orElse("Solicitud inválida");

        return ResponseEntity.badRequest()
                .body(Map.of("error", mensaje));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> jsonInvalido(
            HttpMessageNotReadableException ex) {

        return ResponseEntity.badRequest()
                .body(Map.of("error", "El cuerpo debe ser un JSON válido"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> tipoInvalido(
            MethodArgumentTypeMismatchException ex) {

        return ResponseEntity.badRequest()
                .body(Map.of("error", "Parámetro inválido: " + ex.getName()));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> noEncontrada(
            NoResourceFoundException ex) {

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Ruta no encontrada"));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, String>> baseDeDatos(
            DataAccessException ex) {

        log.error("Error de base de datos", ex);

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Error interno de base de datos"));
    }
}
