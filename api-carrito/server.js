const express = require('express');

const app = express();
app.use(express.json());

const carritos = {};

app.get('/api/salud', (req, res) => {
    res.json({
        servicio: 'api-carrito',
        estado: 'activo'
    });
});

app.get('/api/carrito/:usuarioId', (req, res) => {
    const usuarioId = req.params.usuarioId;

    res.json({
        usuario_id: usuarioId,
        productos: carritos[usuarioId] || []
    });
});

app.post('/api/carrito/:usuarioId/agregar', (req, res) => {
    const usuarioId = req.params.usuarioId;
    const { producto_id, nombre, precio, cantidad } = req.body;

    if (!producto_id || !nombre || precio <= 0 || cantidad <= 0) {
        return res.status(400).json({
            error: 'Datos del producto inválidos'
        });
    }

    if (!carritos[usuarioId]) {
        carritos[usuarioId] = [];
    }

    const existente = carritos[usuarioId].find(
        p => p.producto_id === producto_id
    );

    if (existente) {
        existente.cantidad += cantidad;
    } else {
        carritos[usuarioId].push({
            producto_id,
            nombre,
            precio,
            cantidad
        });
    }

    res.status(201).json({
        mensaje: 'Producto agregado',
        carrito: carritos[usuarioId]
    });
});

app.delete('/api/carrito/:usuarioId', (req, res) => {
    delete carritos[req.params.usuarioId];

    res.json({
        mensaje: 'Carrito vaciado'
    });
});

app.listen(8005, '0.0.0.0', () => {
    console.log('API Carrito funcionando en puerto 8005');
});
