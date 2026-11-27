<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const ESTADOS_VALIDOS = ['pendiente', 'pagado', 'enviado', 'cancelado'];

function responder(int $codigo, $datos): void {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cuerpoJson(): array {
    $json = json_decode(file_get_contents('php://input'), true);

    if (!is_array($json)) {
        responder(400, ['error' => 'El cuerpo debe ser un JSON válido']);
    }

    return $json;
}

function db(): PDO {
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        getenv('DB_HOST') ?: 'postgres',
        getenv('DB_PORT') ?: '5432',
        getenv('DB_NAME') ?: 'pedidos_db'
    );

    try {
        $pdo = new PDO(
            $dsn,
            getenv('DB_USER'),
            getenv('DB_PASSWORD'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    } catch (PDOException $e) {
        error_log('Error de conexión: ' . $e->getMessage());
        responder(500, ['error' => 'No se pudo conectar a la base de datos']);
    }

    return $pdo;
}

/*
|--------------------------------------------------------------------------
| Comunicación entre microservicios
|--------------------------------------------------------------------------
*/

function solicitarApi(string $url, string $metodo = 'GET', ?array $datos = null, array $headers = []): array {
    $ch = curl_init($url);

    $opciones = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $metodo,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
    ];

    if ($datos !== null) {
        $opciones[CURLOPT_POSTFIELDS] = json_encode($datos);
    }

    curl_setopt_array($ch, $opciones);

    $respuesta = curl_exec($ch);
    $codigo = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    curl_close($ch);

    if ($respuesta === false) {
        return [
            'codigo' => 0,
            'datos' => null,
            'error' => $error,
        ];
    }

    $json = json_decode($respuesta, true);

    return [
        'codigo' => $codigo,
        'datos' => is_array($json) ? $json : null,
        'error' => null,
    ];
}

function consultarUsuario(int $usuarioId): array {
    $url = rtrim(
        getenv('USUARIOS_API_URL') ?: 'http://api-usuarios:8001',
        '/'
    );

    $clave = getenv('INTERNAL_SERVICE_KEY') ?: '';

    if ($clave === '') {
        return [
            'codigo' => 0,
            'datos' => null,
            'error' => 'Clave interna no configurada',
        ];
    }

    return solicitarApi(
        "$url/api/usuarios/$usuarioId/existencia",
        'GET',
        null,
        ['X-Internal-Service-Key: ' . $clave]
    );
}

function consultarCarrito(int $usuarioId): array {
    $url = rtrim(
        getenv('CARRITO_API_URL') ?: 'http://api-carrito:8005',
        '/'
    );

    return solicitarApi("$url/api/carrito/$usuarioId");
}

function consultarProducto(int $productoId): array {
    $url = rtrim(
        getenv('PRODUCTOS_API_URL') ?: 'http://api-productos:8002',
        '/'
    );

    return solicitarApi("$url/api/productos/$productoId");
}

function reservarInventario(int $productoId, int $pedidoId, int $cantidad): array {
    $url = rtrim(
        getenv('INVENTARIO_API_URL') ?: 'http://api-inventario:8004',
        '/'
    );

    return solicitarApi(
        "$url/api/inventario/$productoId/reservar",
        'POST',
        [
            'pedido_id' => $pedidoId,
            'cantidad' => $cantidad,
        ]
    );
}

function liberarInventario(int $reservaId): array {
    $url = rtrim(
        getenv('INVENTARIO_API_URL') ?: 'http://api-inventario:8004',
        '/'
    );

    return solicitarApi(
        "$url/api/inventario/reservas/$reservaId/liberar",
        'POST'
    );
}

function confirmarInventario(int $reservaId): array {
    $url = rtrim(
        getenv('INVENTARIO_API_URL') ?: 'http://api-inventario:8004',
        '/'
    );

    return solicitarApi(
        "$url/api/inventario/reservas/$reservaId/confirmar",
        'POST'
    );
}

/*
|--------------------------------------------------------------------------
| Pedidos
|--------------------------------------------------------------------------
*/

function formatearPedido(array $fila, array $detalles): array {
    $subtotal = 0;

    $productos = array_map(function ($d) use (&$subtotal) {
        $cantidad = (int) $d['cantidad'];
        $precio = (float) $d['precio_unitario'];
        $subtotal += $cantidad * $precio;

        return [
            'producto_id' => (int) $d['producto_id'],
            'nombre' => $d['nombre_producto'],
            'cantidad' => $cantidad,
            'precio' => $precio,
        ];
    }, $detalles);

    $subtotal = round($subtotal, 2);
    $total = (float) $fila['total'];

    return [
        'id' => (int) $fila['id'],
        'usuario_id' => (int) $fila['usuario_id'],
        'productos' => $productos,
        'direccion' => null,
        'subtotal' => $subtotal,
        'costo_envio' => round(max(0, $total - $subtotal), 2),
        'total' => $total,
        'estado' => $fila['estado'],
        'guia' => null,
        'fecha' => $fila['fecha'],
    ];
}

function detallesDe(array $idsPedido): array {
    if (!$idsPedido) {
        return [];
    }

    $marcadores = implode(',', array_fill(0, count($idsPedido), '?'));

    $st = db()->prepare(
        "SELECT * FROM pedido_detalles
         WHERE pedido_id IN ($marcadores)
         ORDER BY id"
    );

    $st->execute($idsPedido);

    $porPedido = [];

    foreach ($st->fetchAll() as $d) {
        $porPedido[$d['pedido_id']][] = $d;
    }

    return $porPedido;
}

function pedidoCompleto(int $id): ?array {
    $st = db()->prepare('SELECT * FROM pedidos WHERE id = ?');
    $st->execute([$id]);

    $fila = $st->fetch();

    if (!$fila) {
        return null;
    }

    $detalles = detallesDe([$id]);

    return formatearPedido($fila, $detalles[$id] ?? []);
}

/*
|--------------------------------------------------------------------------
| Compensación de reservas
|--------------------------------------------------------------------------
*/

function consultarReservasPedido(int $pedidoId): array {
    $url = rtrim(
        getenv('INVENTARIO_API_URL') ?: 'http://api-inventario:8004',
        '/'
    );

    return solicitarApi(
        "$url/api/inventario/reservas/pedido/$pedidoId"
    );
}

function procesarReservas(int $pedidoId, string $accion): bool {
    if (!in_array($accion, ['confirmar', 'liberar'], true)) {
        return false;
    }

    $consulta = consultarReservasPedido($pedidoId);

    if (
        $consulta['codigo'] !== 200
        || !is_array($consulta['datos']['reservas'] ?? null)
    ) {
        error_log("No se pudieron consultar las reservas del pedido $pedidoId");
        return false;
    }

    foreach ($consulta['datos']['reservas'] as $reserva) {
        $reservaId = (int) ($reserva['id'] ?? 0);
        $estadoActual = $reserva['estado'] ?? null;

        if ($reservaId < 1) {
            return false;
        }

        $estadoFinal = $accion === 'confirmar' ? 'confirmada' : 'liberada';

        if ($estadoActual === $estadoFinal) {
            continue;
        }

        if ($estadoActual !== 'pendiente') {
            error_log("Estado inesperado en reserva $reservaId: " . (string) $estadoActual);
            return false;
        }

        $respuesta = $accion === 'confirmar'
            ? confirmarInventario($reservaId)
            : liberarInventario($reservaId);

        $correcto = $respuesta['codigo'] >= 200
            && $respuesta['codigo'] < 300;

        if (
            !$correcto
            && $respuesta['codigo'] === 409
            && ($respuesta['datos']['estado'] ?? null) === $estadoFinal
        ) {
            $correcto = true;
        }

        if (!$correcto) {
            error_log("No se pudo $accion la reserva $reservaId del pedido $pedidoId");
            return false;
        }
    }

    return true;
}

/*
|--------------------------------------------------------------------------
| Crear pedido desde carrito
|--------------------------------------------------------------------------
*/

function crearPedido(): void {
    $d = cuerpoJson();

    if (
        !isset($d['usuario_id'])
        || !ctype_digit((string) $d['usuario_id'])
        || (int) $d['usuario_id'] < 1
    ) {
        responder(400, ['error' => 'usuario_id inválido']);
    }

    if (empty($d['direccion'])) {
        responder(400, ['error' => 'direccion es obligatoria']);
    }

    if (
        !isset($d['costo_envio'])
        || !is_numeric($d['costo_envio'])
        || $d['costo_envio'] < 0
    ) {
        responder(400, ['error' => 'costo_envio inválido']);
    }

    $usuarioId = (int) $d['usuario_id'];

    // 1. Verificar que el usuario exista.
    $respuestaUsuario = consultarUsuario($usuarioId);

    if ($respuestaUsuario['codigo'] === 404) {
        responder(404, [
            'error' => 'El usuario no existe',
            'usuario_id' => $usuarioId,
        ]);
    }

    if ($respuestaUsuario['codigo'] !== 200) {
        responder(502, [
            'error' => 'No se pudo validar el usuario',
        ]);
    }

    // 2. Consultar carrito.
    $respuestaCarrito = consultarCarrito($usuarioId);

    if ($respuestaCarrito['codigo'] !== 200) {
        responder(502, [
            'error' => 'No se pudo consultar el carrito',
        ]);
    }

    $productosCarrito = $respuestaCarrito['datos']['productos'] ?? [];

    if (!is_array($productosCarrito) || count($productosCarrito) === 0) {
        responder(400, ['error' => 'El carrito está vacío']);
    }

    // 2. Consultar precios y nombres reales.
    $items = [];
    $subtotal = 0;

    foreach ($productosCarrito as $producto) {
        $productoId = (int) ($producto['producto_id'] ?? 0);
        $cantidad = (int) ($producto['cantidad'] ?? 0);

        if ($productoId < 1 || $cantidad < 1) {
            responder(400, ['error' => 'Producto inválido en el carrito']);
        }

        $respuestaProducto = consultarProducto($productoId);

        if ($respuestaProducto['codigo'] !== 200) {
            responder(409, [
                'error' => 'Uno de los productos no está disponible',
                'producto_id' => $productoId,
            ]);
        }

        $productoReal = $respuestaProducto['datos']['producto'] ?? null;

        if (
            !is_array($productoReal)
            || !isset($productoReal['precio'])
            || !is_numeric($productoReal['precio'])
        ) {
            responder(502, [
                'error' => 'Respuesta inválida del microservicio de productos',
                'producto_id' => $productoId,
            ]);
        }

        $precio = (float) $productoReal['precio'];
        $nombre = (string) ($productoReal['nombre'] ?? "Producto $productoId");

        if ($precio < 0) {
            responder(502, ['error' => 'Precio de producto inválido']);
        }

        $items[] = [
            'producto_id' => $productoId,
            'nombre' => $nombre,
            'cantidad' => $cantidad,
            'precio' => $precio,
        ];

        $subtotal += $cantidad * $precio;
    }

    $subtotal = round($subtotal, 2);
    $envio = round((float) $d['costo_envio'], 2);
    $total = round($subtotal + $envio, 2);

    $pdo = db();

    // 3. Crear pedido y detalles.
    try {
        $pdo->beginTransaction();

        $st = $pdo->prepare(
            "INSERT INTO pedidos (usuario_id, estado, total)
             VALUES (?, 'pendiente', ?)
             RETURNING id"
        );

        $st->execute([$usuarioId, $total]);

        $pedidoId = (int) $st->fetchColumn();

        $stDetalle = $pdo->prepare(
            'INSERT INTO pedido_detalles
                (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario)
             VALUES (?, ?, ?, ?, ?)'
        );

        foreach ($items as $item) {
            $stDetalle->execute([
                $pedidoId,
                $item['producto_id'],
                $item['nombre'],
                $item['cantidad'],
                $item['precio'],
            ]);
        }

        $pdo->commit();

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log('Error al crear pedido: ' . $e->getMessage());

        responder(500, ['error' => 'No se pudo crear el pedido']);
    }

    // 4. Reservar inventario.
    foreach ($items as $item) {
        $respuestaReserva = reservarInventario(
            $item['producto_id'],
            $pedidoId,
            $item['cantidad']
        );

        if (
            $respuestaReserva['codigo'] !== 201
            || empty($respuestaReserva['datos']['reserva_id'])
        ) {
            $liberacionCorrecta = procesarReservas($pedidoId, 'liberar');

            if ($liberacionCorrecta) {
                $cancelar = $pdo->prepare(
                    "UPDATE pedidos SET estado = 'cancelado' WHERE id = ?"
                );

                $cancelar->execute([$pedidoId]);

                responder(409, [
                    'error' => 'No se pudo reservar el inventario',
                    'producto_id' => $item['producto_id'],
                    'pedido_id' => $pedidoId,
                    'pedido_cancelado' => true,
                ]);
            }

            responder(502, [
                'error' => 'Falló la reserva y no se pudo completar la compensación',
                'pedido_id' => $pedidoId,
                'requiere_revision' => true,
            ]);
        }


    }

    responder(201, pedidoCompleto($pedidoId));
}

/*
|--------------------------------------------------------------------------
| Consultar pedidos
|--------------------------------------------------------------------------
*/

function pedidosPorUsuario(string $usuarioId): void {
    if (!ctype_digit($usuarioId) || (int) $usuarioId < 1) {
        responder(400, ['error' => 'usuario_id inválido']);
    }

    // Verificar que el usuario exista antes de consultar sus pedidos.
    $respuestaUsuario = consultarUsuario((int) $usuarioId);

    if ($respuestaUsuario['codigo'] === 404) {
        responder(404, [
            'error' => 'El usuario no existe',
            'usuario_id' => (int) $usuarioId,
        ]);
    }

    if ($respuestaUsuario['codigo'] !== 200) {
        responder(502, [
            'error' => 'No se pudo validar el usuario',
        ]);
    }

    $st = db()->prepare(
        'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC'
    );

    $st->execute([(int) $usuarioId]);

    $filas = $st->fetchAll();

    $detalles = detallesDe(array_column($filas, 'id'));

    $resultado = array_map(
        fn($f) => formatearPedido($f, $detalles[$f['id']] ?? []),
        $filas
    );

    responder(200, $resultado);
}

function obtenerPedido(int $id): void {
    $pedido = pedidoCompleto($id);

    if (!$pedido) {
        responder(404, ['error' => 'Pedido no encontrado']);
    }

    responder(200, $pedido);
}

/*
|--------------------------------------------------------------------------
| Actualizar estado y procesar reservas
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Autenticación y autorización para actualizar pedidos
|--------------------------------------------------------------------------
*/

function obtenerEncabezado(string $nombre): ?string {
    if (function_exists('getallheaders')) {
        foreach ((array) getallheaders() as $clave => $valor) {
            if (strcasecmp($clave, $nombre) === 0) {
                return trim((string) $valor);
            }
        }
    }

    $servidor = 'HTTP_' . strtoupper(str_replace('-', '_', $nombre));

    if (isset($_SERVER[$servidor])) {
        return trim((string) $_SERVER[$servidor]);
    }

    if (
        strcasecmp($nombre, 'Authorization') === 0
        && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])
    ) {
        return trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }

    return null;
}

function validarClaveInterna(): void {
    $esperada = getenv('INTERNAL_SERVICE_KEY') ?: '';

    if ($esperada === '') {
        responder(500, [
            'error' => 'La clave interna no está configurada en el servidor',
        ]);
    }

    $recibida = obtenerEncabezado('X-Internal-Service-Key');

    if ($recibida === null || $recibida === '') {
        responder(401, [
            'error' => 'Se requiere autenticación de servicio interno',
        ]);
    }

    if (!hash_equals($esperada, $recibida)) {
        responder(403, [
            'error' => 'Clave interna inválida',
        ]);
    }
}

function consultarPerfilAutenticado(): array {
    $authorization = obtenerEncabezado('Authorization');

    if (
        $authorization === null
        || !preg_match('/^Bearer\s+(\S+)$/i', $authorization, $coincidencias)
    ) {
        return ['codigo' => 401, 'usuario_id' => null];
    }

    $url = rtrim(
        getenv('USUARIOS_API_URL') ?: 'http://api-usuarios:8001',
        '/'
    );

    $respuesta = solicitarApi(
        "$url/api/usuarios/perfil",
        'GET',
        null,
        ['Authorization: Bearer ' . $coincidencias[1]]
    );

    if (in_array($respuesta['codigo'], [401, 403, 404], true)) {
        return ['codigo' => 401, 'usuario_id' => null];
    }

    if ($respuesta['codigo'] !== 200) {
        return ['codigo' => 502, 'usuario_id' => null];
    }

    $usuarioId = $respuesta['datos']['usuario']['id'] ?? null;

    if (!is_numeric($usuarioId) || (int) $usuarioId < 1) {
        return ['codigo' => 502, 'usuario_id' => null];
    }

    return [
        'codigo' => 200,
        'usuario_id' => (int) $usuarioId,
    ];
}


function actualizarEstado(int $id): void {
    $d = cuerpoJson();

    if (
        !isset($d['estado'])
        || !is_string($d['estado'])
        || !in_array($d['estado'], ESTADOS_VALIDOS, true)
    ) {
        responder(400, [
            'error' => 'estado inválido. Valores: ' . implode(', ', ESTADOS_VALIDOS),
        ]);
    }

    $nuevoEstado = $d['estado'];
    $usuarioAutenticado = null;

    // Autorización según el estado solicitado.
    if (in_array($nuevoEstado, ['pagado', 'enviado'], true)) {
        validarClaveInterna();
    }

    if ($nuevoEstado === 'cancelado') {
        $perfil = consultarPerfilAutenticado();

        if ($perfil['codigo'] === 401) {
            responder(401, ['error' => 'Se requiere un JWT válido']);
        }

        if ($perfil['codigo'] !== 200) {
            responder(502, [
                'error' => 'No se pudo verificar la identidad del usuario',
            ]);
        }

        $usuarioAutenticado = $perfil['usuario_id'];
    }

    // Bloquear el pedido para evitar actualizaciones concurrentes.
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $consulta = $pdo->prepare(
            'SELECT estado, usuario_id
             FROM pedidos
             WHERE id = ?
             FOR UPDATE'
        );

        $consulta->execute([$id]);
        $pedido = $consulta->fetch();

        if (!$pedido) {
            $pdo->rollBack();
            responder(404, ['error' => 'Pedido no encontrado']);
        }

        // Transiciones permitidas.
        $transiciones = [
            'pendiente' => ['pagado', 'cancelado'],
            'pagado' => ['enviado'],
        ];

        $permitidos = $transiciones[$pedido['estado']] ?? [];

        if (!in_array($nuevoEstado, $permitidos, true)) {
            $pdo->rollBack();

            responder(409, [
                'error' => 'Transición de estado no permitida',
                'estado_actual' => $pedido['estado'],
                'estado_solicitado' => $nuevoEstado,
            ]);
        }

        // Solo el propietario puede cancelar su pedido.
        if (
            $nuevoEstado === 'cancelado'
            && $usuarioAutenticado !== (int) $pedido['usuario_id']
        ) {
            $pdo->rollBack();

            responder(403, [
                'error' => 'No tienes permiso para cancelar este pedido',
            ]);
        }

        // Confirmar o liberar las reservas de inventario.
        if ($nuevoEstado === 'pagado') {
            if (!procesarReservas($id, 'confirmar')) {
                $pdo->rollBack();

                responder(502, [
                    'error' => 'No se pudieron confirmar todas las reservas',
                    'pedido_id' => $id,
                ]);
            }
        }

        if ($nuevoEstado === 'cancelado') {
            if (!procesarReservas($id, 'liberar')) {
                $pdo->rollBack();

                responder(502, [
                    'error' => 'No se pudieron liberar todas las reservas',
                    'pedido_id' => $id,
                ]);
            }
        }

        $actualizar = $pdo->prepare(
            'UPDATE pedidos SET estado = ? WHERE id = ?'
        );

        $actualizar->execute([$nuevoEstado, $id]);

        $pdo->commit();

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $e;
    }

    responder(200, pedidoCompleto($id));
}

/*
|--------------------------------------------------------------------------
| Router
|--------------------------------------------------------------------------
*/

$metodo = $_SERVER['REQUEST_METHOD'];
$ruta = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

try {
    if ($ruta === '/health' && $metodo === 'GET') {
        responder(200, [
            'servicio' => 'api-pedidos',
            'status' => 'ok',
        ]);
    }

    if ($ruta === '/api/pedidos' && $metodo === 'POST') {
        crearPedido();
    }

    if (
        preg_match('#^/api/pedidos/usuario/([^/]+)$#', $ruta, $m)
        && $metodo === 'GET'
    ) {
        pedidosPorUsuario($m[1]);
    }

    if (
        preg_match('#^/api/pedidos/(\d+)/estado$#', $ruta, $m)
        && $metodo === 'PATCH'
    ) {
        actualizarEstado((int) $m[1]);
    }

    if (
        preg_match('#^/api/pedidos/(\d+)$#', $ruta, $m)
        && $metodo === 'GET'
    ) {
        obtenerPedido((int) $m[1]);
    }

    responder(404, ['error' => 'Ruta no encontrada']);

} catch (PDOException $e) {
    error_log('Error de base de datos: ' . $e->getMessage());

    responder(500, ['error' => 'Error interno de base de datos']);
}