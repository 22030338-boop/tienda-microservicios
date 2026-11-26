<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function registro(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'email' => 'required|email|max:150',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errores' => $validator->errors()
            ], 422);
        }

        return response()->json([
            'mensaje' => 'Datos validados. Pendiente conectar PostgreSQL.',
            'datos' => $validator->validated()
        ], 501);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errores' => $validator->errors()
            ], 422);
        }

        return response()->json([
            'mensaje' => 'Datos validados. Pendiente conectar PostgreSQL.'
        ], 501);
    }

    public function perfil(Request $request)
    {
        return response()->json([
            'usuario' => $request->attributes->get('usuario_jwt')
        ]);
    }
}
