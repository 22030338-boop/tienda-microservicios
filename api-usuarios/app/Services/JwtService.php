<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtService
{
    public function generar(array $usuario): string
    {
        $ahora = time();

        $payload = [
            'iss' => config('jwt.issuer'),
            'iat' => $ahora,
            'exp' => $ahora + (config('jwt.ttl') * 60),
            'sub' => $usuario['id'],
            'email' => $usuario['email'],
        ];

        return JWT::encode(
            $payload,
            config('jwt.secret'),
            'HS256'
        );
    }

    public function validar(string $token): object
    {
        return JWT::decode(
            $token,
            new Key(config('jwt.secret'), 'HS256')
        );
    }
}
