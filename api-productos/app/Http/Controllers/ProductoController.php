<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class ProductoController extends Controller
{
    private array $productos = [
        [
            'id' => 1,
            'nombre' => 'Laptop',
            'precio' => 15000,
            'stock' => 10,
            'categoria' => 'Tecnología'
        ],
        [
            'id' => 2,
            'nombre' => 'Mouse',
            'precio' => 350,
            'stock' => 25,
            'categoria' => 'Accesorios'
        ],
        [
            'id' => 3,
            'nombre' => 'Teclado',
            'precio' => 800,
            'stock' => 15,
            'categoria' => 'Accesorios'
        ]
    ];

    public function index(): JsonResponse
    {
        return response()->json([
            'productos' => $this->productos
        ]);
    }

    public function mostrar(int $id): JsonResponse
    {
        foreach ($this->productos as $producto) {
            if ($producto['id'] === $id) {
                return response()->json($producto);
            }
        }

        return response()->json([
            'error' => 'Producto no encontrado'
        ], 404);
    }

    public function salud(): JsonResponse
    {
        return response()->json([
            'servicio' => 'api-productos',
            'estado' => 'activo'
        ]);
    }
}
