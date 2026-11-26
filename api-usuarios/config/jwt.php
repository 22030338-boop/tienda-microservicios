<?php

return [
    'secret' => env('JWT_SECRET'),
    'issuer' => env('JWT_ISSUER', 'api-usuarios'),
    'ttl' => 60,
];