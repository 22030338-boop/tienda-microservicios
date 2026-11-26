const express = require('express');
const { Pool } = require('pg');

const app = express();
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
    const { producto_id, precio, cantidad } = req.body;

    if (!validarUsuarioId(usuarioId)) {
        return res.status(400).json({
            error: 'El ID del usuario debe ser un entero positivo'
        });
    }

    if (
        !esEnteroPositivo(producto_id) ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0 ||
        !esEnteroPositivo(cantidad)
    ) {
        return res.status(400).json({
            error: 'Datos del producto inválidos'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Crear el carrito si no existe.
        const carrito = await client.query(
            `INSERT INTO carritos (usuario_id)
             VALUES ($1)
             ON CONFLICT (usuario_id)
             DO UPDATE SET actualizado_en = CURRENT_TIMESTAMP
             RETURNING id`,
            [usuarioId]
        );

        const carritoId = carrito.rows[0].id;

        // Insertar el producto o incrementar su cantidad.
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

        const productos = await obtenerProductos(carritoId, client);

        await client.query('COMMIT');

        res.status(201).json({
            mensaje: 'Producto agregado correctamente',
            carrito: formatearCarrito(usuarioId, productos)
        });
    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Error al agregar producto:', error.message);

        res.status(500).json({
            error: 'No fue posible agregar el producto al carrito'
        });
    } finally {
        client.release();
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

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

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

        res.json({
            mensaje: 'Carrito vaciado correctamente',
            usuario_id: Number(usuarioId),
            productos: [],
            total: 0
        });
    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Error al vaciar carrito:', error.message);

        res.status(500).json({
            error: 'No fue posible vaciar el carrito'
        });
    } finally {
        client.release();
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
