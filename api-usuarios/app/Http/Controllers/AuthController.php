<?php

namespace App\Http\Controllers;

use App\Services\JwtService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function registro(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'email' => [
                'required',
                'email',
                'max:150',
                Rule::unique('usuarios', 'correo'),
            ],
            'password' => 'required|string|min:8',
        ], [
            'email.unique' => 'El correo electrónico ya está registrado.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errores' => $validator->errors(),
            ], 422);
        }

        $datos = $validator->validated();

        $id = DB::table('usuarios')->insertGetId([
            'nombre' => $datos['nombre'],
            'correo' => $datos['email'],
            'password_hash' => Hash::make($datos['password']),
            'rol' => 'cliente',
        ]);

        return response()->json([
            'mensaje' => 'Usuario registrado correctamente.',
            'usuario' => [
                'id' => $id,
                'nombre' => $datos['nombre'],
                'correo' => $datos['email'],
                'rol' => 'cliente',
            ],
        ], 201);
    }

    public function login(Request $request, JwtService $jwtService)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errores' => $validator->errors(),
            ], 422);
        }

        $datos = $validator->validated();

        $usuario = DB::table('usuarios')
            ->where('correo', $datos['email'])
            ->first();

        if (!$usuario || !Hash::check(
            $datos['password'],
            $usuario->password_hash
        )) {
            return response()->json([
                'error' => 'Credenciales incorrectas.',
            ], 401);
        }

        $token = $jwtService->generar([
            'id' => $usuario->id,
            'email' => $usuario->correo,
        ]);

        return response()->json([
            'mensaje' => 'Inicio de sesión exitoso.',
            'token' => $token,
            'tipo' => 'Bearer',
            'expires_in' => config('jwt.ttl') * 60,
            'usuario' => [
                'id' => $usuario->id,
                'nombre' => $usuario->nombre,
                'correo' => $usuario->correo,
                'rol' => $usuario->rol,
            ],
        ]);
    }

    public function perfil(Request $request)
    {
        $payload = $request->attributes->get('usuario_jwt');

        $usuario = DB::table('usuarios')
            ->select('id', 'nombre', 'correo', 'rol', 'creado_en')
            ->where('id', $payload->sub)
            ->first();

        if (!$usuario) {
            return response()->json([
                'error' => 'El usuario ya no existe.',
            ], 404);
        }

        return response()->json([
            'usuario' => $usuario,
        ]);
    }
}
