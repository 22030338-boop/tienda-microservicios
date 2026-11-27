const express = require('express');
const { Pool } = require('pg');

const app = express();

app.use((req, res, next) => {
    res.header(
        'Access-Control-Allow-Origin',
        'http://localhost:4200'
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );

    res.header(
        'Access-Control-Allow-Headers',
        'Origin, Content-Type, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

const API_PRODUCTOS_URL =
    process.env.API_PRODUCTOS_URL || 'http://api-productos:8002';

function esEnteroPositivo(valor) {
    return Number.isSafeInteger(Number(valor)) && Number(valor) > 0;
}

function validarUsuarioId(usuarioId) {
    return esEnteroPositivo(usuarioId);
}

function formatearCarrito(usuarioId, productos) {
    const articulos = productos.map(producto => {
        const precio = Number(producto.precio_unitario);
        const cantidad = Number(producto.cantidad);

        return {
            producto_id: Number(producto.producto_id),
            cantidad,
            precio_unitario: precio,
            subtotal: Number((precio * cantidad).toFixed(2))
        };
    });

    const total = articulos.reduce(
        (suma, producto) => suma + producto.subtotal,
        0
    );

    return {
        usuario_id: Number(usuarioId),
        productos: articulos,
        total: Number(total.toFixed(2))
    };
}

async function obtenerProductos(carritoId, conexion = pool) {
    const resultado = await conexion.query(
        `SELECT producto_id, cantidad, precio_unitario
         FROM carrito_items
         WHERE carrito_id = $1
         ORDER BY id`,
        [carritoId]
    );

    return resultado.rows;
}

// Consultar el producto y su precio en API Productos.
async function consultarProducto(productoId) {
    try {
        const respuesta = await fetch(
            `${API_PRODUCTOS_URL}/api/productos/${productoId}`
        );

        if (respuesta.status === 404) {
            const error = new Error('Producto no encontrado o inactivo');
            error.statusCode = 404;
            throw error;
        }

        if (!respuesta.ok) {
            const error = new Error('API Productos no está disponible');
            error.statusCode = 503;
            throw error;
        }

        const datos = await respuesta.json();
        const producto = datos.producto;

        if (
            !producto ||
            !Number.isFinite(Number(producto.precio)) ||
            Number(producto.precio) < 0
        ) {
            const error = new Error('Respuesta inválida de API Productos');
            error.statusCode = 503;
            throw error;
        }

        return producto;
    } catch (error) {
        if (error.statusCode) throw error;

        const servicioError = new Error(
            'No fue posible comunicarse con API Productos'
        );
        servicioError.statusCode = 503;
        throw servicioError;
    }
}

// Verificar el estado del servicio y PostgreSQL.
app.get('/api/salud', async (req, res) => {
    try {
        await pool.query('SELECT 1');

        res.json({
            servicio: 'api-carrito',
            estado: 'activo',
            baseDatos: 'conectada'
        });
    } catch (error) {
        console.error('Error de conexión con PostgreSQL:', error.message);

        res.status(503).json({
            servicio: 'api-carrito',
            estado: 'degradado',
            baseDatos: 'desconectada'
        });
    }
});

// Consultar el carrito de un usuario.
app.get('/api/carrito/:usuarioId', async (req, res) => {
    const { usuarioId } = req.params;

    if (!validarUsuarioId(usuarioId)) {
        return res.status(400).json({
            error: 'El ID del usuario debe ser un entero positivo'
        });
    }

    try {
        const carrito = await pool.query(
            'SELECT id FROM carritos WHERE usuario_id = $1',
            [usuarioId]
        );

        if (carrito.rows.length === 0) {
            return res.json(formatearCarrito(usuarioId, []));
        }

        const productos = await obtenerProductos(carrito.rows[0].id);

        res.json(formatearCarrito(usuarioId, productos));
    } catch (error) {
        console.error('Error al consultar carrito:', error.message);

        res.status(500).json({
            error: 'No fue posible consultar el carrito'
        });
    }
});

// Agregar un producto o incrementar su cantidad.
app.post('/api/carrito/:usuarioId/agregar', async (req, res) => {
    const { usuarioId } = req.params;
    const { producto_id, cantidad } = req.body;

    if (!validarUsuarioId(usuarioId)) {
        return res.status(400).json({
            error: 'El ID del usuario debe ser un entero positivo'
        });
    }

    if (!esEnteroPositivo(producto_id) || !esEnteroPositivo(cantidad)) {
        return res.status(400).json({
            error: 'producto_id y cantidad deben ser enteros positivos'
        });
    }

    let client;
    let transaccionIniciada = false;

    try {
        // El precio se obtiene directamente del servicio de productos.
        const producto = await consultarProducto(producto_id);
        const precio = Number(producto.precio);

        client = await pool.connect();
        await client.query('BEGIN');
        transaccionIniciada = true;

        const carrito = await client.query(
            `INSERT INTO carritos (usuario_id)
             VALUES ($1)
             ON CONFLICT (usuario_id)
             DO UPDATE SET actualizado_en = CURRENT_TIMESTAMP
             RETURNING id`,
            [usuarioId]
        );

        const carritoId = carrito.rows[0].id;

        await client.query(
            `INSERT INTO carrito_items
                (carrito_id, producto_id, cantidad, precio_unitario)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (carrito_id, producto_id)
             DO UPDATE SET
                cantidad = carrito_items.cantidad + EXCLUDED.cantidad,
                precio_unitario = EXCLUDED.precio_unitario`,
            [carritoId, producto_id, cantidad, precio]
        );

        await client.query(
            `UPDATE carritos
             SET actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [carritoId]
        );

        const productos = await obtenerProductos(carritoId, client);

        await client.query('COMMIT');
        transaccionIniciada = false;

        res.status(201).json({
            mensaje: 'Producto agregado correctamente',
            carrito: formatearCarrito(usuarioId, productos)
        });
    } catch (error) {
        if (client && transaccionIniciada) {
            await client.query('ROLLBACK');
        }

        console.error('Error al agregar producto:', error.message);

        res.status(error.statusCode || 500).json({
            error: error.statusCode
                ? error.message
                : 'No fue posible agregar el producto al carrito'
        });
    } finally {
        if (client) client.release();
    }
});

// Actualizar la cantidad de un producto.
app.put('/api/carrito/:usuarioId/items/:productoId', async (req, res) => {
    const { usuarioId, productoId } = req.params;
    const { cantidad } = req.body;

    if (!validarUsuarioId(usuarioId) || !esEnteroPositivo(productoId)) {
        return res.status(400).json({
            error: 'Los IDs deben ser enteros positivos'
        });
    }

    if (!esEnteroPositivo(cantidad)) {
        return res.status(400).json({
            error: 'La cantidad debe ser un entero positivo'
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE carrito_items
             SET cantidad = $1
             WHERE producto_id = $2
               AND carrito_id = (
                   SELECT id FROM carritos WHERE usuario_id = $3
               )
             RETURNING producto_id, cantidad, precio_unitario`,
            [cantidad, productoId, usuarioId]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'El producto no existe en el carrito'
            });
        }

        await pool.query(
            `UPDATE carritos
             SET actualizado_en = CURRENT_TIMESTAMP
             WHERE usuario_id = $1`,
            [usuarioId]
        );

        const carrito = await pool.query(
            'SELECT id FROM carritos WHERE usuario_id = $1',
            [usuarioId]
        );

        const productos = await obtenerProductos(carrito.rows[0].id);

        res.json({
            mensaje: 'Cantidad actualizada correctamente',
            carrito: formatearCarrito(usuarioId, productos)
        });
    } catch (error) {
        console.error('Error al actualizar cantidad:', error.message);

        res.status(500).json({
            error: 'No fue posible actualizar la cantidad'
        });
    }
});

// Eliminar un producto individual del carrito.
app.delete('/api/carrito/:usuarioId/items/:productoId', async (req, res) => {
    const { usuarioId, productoId } = req.params;

    if (!validarUsuarioId(usuarioId) || !esEnteroPositivo(productoId)) {
        return res.status(400).json({
            error: 'Los IDs deben ser enteros positivos'
        });
    }

    try {
        const resultado = await pool.query(
            `DELETE FROM carrito_items
             WHERE producto_id = $1
               AND carrito_id = (
                   SELECT id FROM carritos WHERE usuario_id = $2
               )
             RETURNING producto_id`,
            [productoId, usuarioId]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'El producto no existe en el carrito'
            });
        }

        await pool.query(
            `UPDATE carritos
             SET actualizado_en = CURRENT_TIMESTAMP
             WHERE usuario_id = $1`,
            [usuarioId]
        );

        const carrito = await pool.query(
            'SELECT id FROM carritos WHERE usuario_id = $1',
            [usuarioId]
        );

        const productos = await obtenerProductos(carrito.rows[0].id);

        res.json({
            mensaje: 'Producto eliminado correctamente',
            carrito: formatearCarrito(usuarioId, productos)
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error.message);

        res.status(500).json({
            error: 'No fue posible eliminar el producto'
        });
    }
});

// Vaciar el carrito sin eliminar su registro.
app.delete('/api/carrito/:usuarioId', async (req, res) => {
    const { usuarioId } = req.params;

    if (!validarUsuarioId(usuarioId)) {
        return res.status(400).json({
            error: 'El ID del usuario debe ser un entero positivo'
        });
    }

    let client;
    let transaccionIniciada = false;

    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transaccionIniciada = true;

        await client.query(
            `DELETE FROM carrito_items
             WHERE carrito_id IN (
                 SELECT id FROM carritos WHERE usuario_id = $1
             )`,
            [usuarioId]
        );

        await client.query(
            `UPDATE carritos
             SET actualizado_en = CURRENT_TIMESTAMP
             WHERE usuario_id = $1`,
            [usuarioId]
        );

        await client.query('COMMIT');
        transaccionIniciada = false;

        res.json({
            mensaje: 'Carrito vaciado correctamente',
            usuario_id: Number(usuarioId),
            productos: [],
            total: 0
        });
    } catch (error) {
        if (client && transaccionIniciada) {
            await client.query('ROLLBACK');
        }

        console.error('Error al vaciar carrito:', error.message);

        res.status(500).json({
            error: 'No fue posible vaciar el carrito'
        });
    } finally {
        if (client) client.release();
    }
});

// Manejo de JSON inválido.
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({
            error: 'El cuerpo de la solicitud contiene JSON inválido'
        });
    }

    next(error);
});

const PORT = 8005;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Carrito funcionando en puerto ${PORT}`);
});

async function cerrarServidor() {
    console.log('Cerrando API Carrito...');

    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.on('SIGTERM', cerrarServidor);
process.on('SIGINT', cerrarServidor);
