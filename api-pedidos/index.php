<?php
// ===== Cabeceras (JSON + CORS para que Angular pueda consumirla) =====
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ===== Configuración =====
const ESTADOS_VALIDOS = ['pendiente', 'pagado', 'enviado', 'cancelado'];

// ===== Utilidades =====
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

// ===== Conexión a PostgreSQL =====
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
        $pdo = new PDO($dsn, getenv('DB_USER'), getenv('DB_PASSWORD'), [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        error_log('Error de conexión: ' . $e->getMessage());
        responder(500, ['error' => 'No se pudo conectar a la base de datos']);
    }

    // Columnas que el esquema original no tiene (idempotente)
    $pdo->exec("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion TEXT");
    $pdo->exec("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(10,2) NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS guia VARCHAR(50)");

    return $pdo;
}

// ===== Armado de la respuesta (mismo formato que antes) =====
function formatearPedido(array $fila, array $detalles): array {
    return [
        'id'          => (int) $fila['id'],
        'usuario_id'  => (int) $fila['usuario_id'],
        'productos'   => array_map(fn($d) => [
            'producto_id' => (int) $d['producto_id'],
            'nombre'      => $d['nombre_producto'],
            'cantidad'    => (int) $d['cantidad'],
            'precio'      => (float) $d['precio_unitario'],
        ], $detalles),
        'direccion'   => $fila['direccion'],
        'subtotal'    => (float) $fila['subtotal'],
        'costo_envio' => (float) $fila['costo_envio'],
        'total'       => (float) $fila['total'],
        'estado'      => $fila['estado'],
        'guia'        => $fila['guia'],
        'fecha'       => $fila['fecha'],
    ];
}

function detallesDe(array $idsPedido): array {
    if (!$idsPedido) {
        return [];
    }
    $marcadores = implode(',', array_fill(0, count($idsPedido), '?'));
    $st = db()->prepare("SELECT * FROM pedido_detalles WHERE pedido_id IN ($marcadores) ORDER BY id");
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

// ===== Handlers =====
function crearPedido(): void {
    $d = cuerpoJson();

    // Validaciones
    if (empty($d['usuario_id']) || !ctype_digit((string) $d['usuario_id'])) {
        responder(400, ['error' => 'usuario_id es obligatorio y debe ser numérico']);
    }
    if (empty($d['productos']) || !is_array($d['productos'])) {
        responder(400, ['error' => 'productos debe ser un arreglo con al menos un elemento']);
    }
    if (empty($d['direccion'])) {
        responder(400, ['error' => 'direccion es obligatoria']);
    }
    if (!isset($d['costo_envio']) || !is_numeric($d['costo_envio']) || $d['costo_envio'] < 0) {
        responder(400, ['error' => 'costo_envio es obligatorio y debe ser un número >= 0']);
    }

    $subtotal = 0;
    $items = [];
    foreach ($d['productos'] as $i => $p) {
        if (empty($p['producto_id']) || !ctype_digit((string) $p['producto_id'])
            || empty($p['cantidad']) || !is_numeric($p['cantidad']) || $p['cantidad'] < 1
            || !isset($p['precio']) || !is_numeric($p['precio']) || $p['precio'] < 0) {
            responder(400, ['error' => "Producto en posición $i inválido (producto_id, cantidad, precio)"]);
        }
        $items[] = [
            'producto_id' => (int) $p['producto_id'],
            // El esquema exige nombre; si no lo mandan se usa uno genérico
            'nombre'      => !empty($p['nombre']) ? (string) $p['nombre'] : 'Producto ' . $p['producto_id'],
            'cantidad'    => (int) $p['cantidad'],
            'precio'      => (float) $p['precio'],
        ];
        $subtotal += $p['cantidad'] * $p['precio'];
    }

    $subtotal = round($subtotal, 2);
    $envio    = round((float) $d['costo_envio'], 2);
    $total    = round($subtotal + $envio, 2);

    $pdo = db();
    try {
        $pdo->beginTransaction();

        $st = $pdo->prepare(
            "INSERT INTO pedidos (usuario_id, estado, total, direccion, subtotal, costo_envio)
             VALUES (?, 'pendiente', ?, ?, ?, ?) RETURNING id"
        );
        $st->execute([(int) $d['usuario_id'], $total, $d['direccion'], $subtotal, $envio]);
        $pedidoId = (int) $st->fetchColumn();

        $stDetalle = $pdo->prepare(
            'INSERT INTO pedido_detalles (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario)
             VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($items as $it) {
            $stDetalle->execute([$pedidoId, $it['producto_id'], $it['nombre'], $it['cantidad'], $it['precio']]);
        }

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Error al crear pedido: ' . $e->getMessage());
        responder(500, ['error' => 'No se pudo crear el pedido']);
    }

    responder(201, pedidoCompleto($pedidoId));
}

function pedidosPorUsuario(string $usuarioId): void {
    if (!ctype_digit($usuarioId)) {
        responder(400, ['error' => 'usuario_id debe ser numérico']);
    }

    $st = db()->prepare('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC');
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

function actualizarEstado(int $id): void {
    $d = cuerpoJson();

    if (empty($d['estado']) || !in_array($d['estado'], ESTADOS_VALIDOS, true)) {
        responder(400, ['error' => 'estado inválido. Valores: ' . implode(', ', ESTADOS_VALIDOS)]);
    }

    $guia = !empty($d['guia']) ? (string) $d['guia'] : null;

    // COALESCE: si no mandan guía, conserva la que ya tenía
    $st = db()->prepare('UPDATE pedidos SET estado = ?, guia = COALESCE(?, guia) WHERE id = ?');
    $st->execute([$d['estado'], $guia, $id]);

    if ($st->rowCount() === 0) {
        responder(404, ['error' => 'Pedido no encontrado']);
    }
    responder(200, pedidoCompleto($id));
}

// ===== Router =====
$metodo = $_SERVER['REQUEST_METHOD'];
$ruta = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

try {
    if ($ruta === '/health' && $metodo === 'GET') {
        responder(200, ['servicio' => 'api-pedidos', 'status' => 'ok']);
    }

    if ($ruta === '/api/pedidos' && $metodo === 'POST') {
        crearPedido();
    }

    if (preg_match('#^/api/pedidos/usuario/([^/]+)$#', $ruta, $m) && $metodo === 'GET') {
        pedidosPorUsuario($m[1]);
    }

    if (preg_match('#^/api/pedidos/(\d+)/estado$#', $ruta, $m) && $metodo === 'PATCH') {
        actualizarEstado((int) $m[1]);
    }

    // Extra útil para que otras APIs consulten un pedido
    if (preg_match('#^/api/pedidos/(\d+)$#', $ruta, $m) && $metodo === 'GET') {
        obtenerPedido((int) $m[1]);
    }

    responder(404, ['error' => 'Ruta no encontrada']);
} catch (PDOException $e) {
    error_log('Error de base de datos: ' . $e->getMessage());
    responder(500, ['error' => 'Error interno de base de datos']);
}