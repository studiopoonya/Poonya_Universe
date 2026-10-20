<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        // Auth is Bearer-token only (no cookie sessions), so Sanctum's stateful/CSRF
        // mode is deliberately off — it rejected same-domain POSTs with 419.

        $middleware->alias([
            'admin'      => \App\Http\Middleware\EnsureIsAdmin::class,
            'admin.only' => \App\Http\Middleware\EnsureIsAdminOnly::class,
            'permission' => \App\Http\Middleware\EnsurePermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
