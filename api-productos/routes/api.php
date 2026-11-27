<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProductoController;

Route::get('/salud', [ProductoController::class, 'salud']);

Route::get('/productos', [ProductoController::class, 'index']);
Route::get('/productos/{id}', [ProductoController::class, 'mostrar']);
Route::post('/productos', [ProductoController::class, 'guardar']);
Route::put('/productos/{id}', [ProductoController::class, 'actualizar']);
Route::delete('/productos/{id}', [ProductoController::class, 'eliminar']);

Route::get('/categorias', [ProductoController::class, 'categorias']);
