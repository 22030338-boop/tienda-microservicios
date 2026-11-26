<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class SaludController extends Controller
{
    public function verificar(): JsonResponse
    {
        return response()->json([
            'servicio' => 'api-usuarios',
            'estado' => 'activo',
            'mensaje' => 'Microservicio de usuarios funcionando correctamente',
            'version' => '1.0.0'
        ], 200);
    }
}
