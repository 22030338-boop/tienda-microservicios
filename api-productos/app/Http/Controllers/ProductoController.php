<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProductoController extends Controller
{
    /**
     * Obtener todos los productos activos.
     */
    public function index(): JsonResponse
    {
        $productos = DB::table('productos as p')
            ->leftJoin('categorias as c', 'p.categoria_id', '=', 'c.id')
            ->where('p.activo', true)
            ->select(
                'p.id',
                'p.nombre',
                'p.descripcion',
                'p.precio',
                'c.nombre as categoria'
            )
            ->orderBy('p.id')
            ->get()
            ->map(function ($producto) {
                return [
                    'id' => $producto->id,
                    'nombre' => $producto->nombre,
                    'descripcion' => $producto->descripcion,
                    'precio' => (float) $producto->precio,
                    'categoria' => $producto->categoria,
                ];
            });

        return response()->json([
            'productos' => $productos,
        ]);
    }

    /**
     * Obtener un producto por su ID.
     */
    public function mostrar(int $id): JsonResponse
    {
        $producto = DB::table('productos as p')
            ->leftJoin('categorias as c', 'p.categoria_id', '=', 'c.id')
            ->where('p.id', $id)
            ->where('p.activo', true)
            ->select(
                'p.id',
                'p.nombre',
                'p.descripcion',
                'p.precio',
                'c.nombre as categoria'
            )
            ->first();

        if (!$producto) {
            return response()->json([
                'error' => 'Producto no encontrado.',
            ], 404);
        }

        return response()->json([
            'producto' => [
                'id' => $producto->id,
                'nombre' => $producto->nombre,
                'descripcion' => $producto->descripcion,
                'precio' => (float) $producto->precio,
                'categoria' => $producto->categoria,
            ],
        ]);
    }

    /**
     * Comprobar el estado del microservicio.
     */
    public function salud(): JsonResponse
    {
        return response()->json([
            'servicio' => 'api-productos',
            'estado' => 'activo',
        ]);
    }
}
