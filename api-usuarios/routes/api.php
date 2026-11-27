<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

Route::prefix('usuarios')->group(function () {
    Route::post('/registro', [AuthController::class, 'registro']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/perfil', [AuthController::class, 'perfil'])
        ->middleware('jwt');

    Route::get('/{id}/existencia', [AuthController::class, 'existencia'])
        ->whereNumber('id');
});
