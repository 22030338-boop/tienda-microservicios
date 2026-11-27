<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ProductoController extends Controller
{
    public function salud(): JsonResponse
    {
        return response()->json([
            'servicio' => 'api-productos',
            'estado' => 'activo',
        ]);
    }

    // Listar productos activos
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
                'p.categoria_id',
                'c.nombre as categoria'
            )
            ->orderBy('p.id')
            ->get();

        return response()->json([
            'productos' => $productos,
        ]);
    }

    // Consultar producto
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
                'p.categoria_id',
                'c.nombre as categoria'
            )
            ->first();

        if (!$producto) {
            return response()->json([
                'error' => 'Producto no encontrado.',
            ], 404);
        }

        return response()->json([
            'producto' => $producto,
        ]);
    }

    // Registrar producto
    public function guardar(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'precio' => 'required|numeric|min:0',
            'categoria_id' => 'nullable|integer|exists:categorias,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos.',
                'detalles' => $validator->errors(),
            ], 422);
        }

        $id = DB::table('productos')->insertGetId([
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'precio' => $request->precio,
            'categoria_id' => $request->categoria_id,
            'activo' => true,
        ]);

        return response()->json([
            'mensaje' => 'Producto registrado correctamente.',
            'id' => $id,
        ], 201);
    }

    // Actualizar producto
    public function actualizar(Request $request, int $id): JsonResponse
    {
        $producto = DB::table('productos')
            ->where('id', $id)
            ->where('activo', true)
            ->first();

        if (!$producto) {
            return response()->json([
                'error' => 'Producto no encontrado.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|required|string|max:150',
            'descripcion' => 'sometimes|nullable|string',
            'precio' => 'sometimes|required|numeric|min:0',
            'categoria_id' => 'sometimes|nullable|integer|exists:categorias,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos.',
                'detalles' => $validator->errors(),
            ], 422);
        }

        $datos = $validator->validated();

        if (empty($datos)) {
            return response()->json([
                'error' => 'No se enviaron datos para actualizar.',
            ], 422);
        }

        DB::table('productos')
            ->where('id', $id)
            ->update($datos);

        return response()->json([
            'mensaje' => 'Producto actualizado correctamente.',
        ]);
    }

    // Eliminar producto (borrado lógico)
    public function eliminar(int $id): JsonResponse
    {
        $actualizado = DB::table('productos')
            ->where('id', $id)
            ->where('activo', true)
            ->update(['activo' => false]);

        if (!$actualizado) {
            return response()->json([
                'error' => 'Producto no encontrado.',
            ], 404);
        }

        return response()->json([
            'mensaje' => 'Producto eliminado correctamente.',
        ]);
    }

    // Listar categorías
    public function categorias(): JsonResponse
    {
        $categorias = DB::table('categorias')
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'categorias' => $categorias,
        ]);
    }
}
