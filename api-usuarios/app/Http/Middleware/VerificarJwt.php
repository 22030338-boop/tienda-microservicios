<?php

namespace App\Http\Middleware;

use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Throwable;

class VerificarJwt
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'error' => 'Token no proporcionado'
            ], 401);
        }

        try {
            $usuario = app(JwtService::class)->validar($token);
            $request->attributes->set('usuario_jwt', $usuario);

            return $next($request);
        } catch (Throwable $e) {
            return response()->json([
                'error' => 'Token inválido o expirado'
            ], 401);
        }
    }
}
