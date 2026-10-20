<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Staff may only reach the admin pages ticked on their account (Accounts page).
 * Admins pass everything. Usage: ->middleware('permission:bookings')
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        $allowed = $user?->role === 'admin'
            || ($user?->role === 'staff' && in_array($permission, $user->permissions ?? [], true));

        abort_unless($allowed, 403, 'Kamu tidak punya akses ke halaman ini.');

        return $next($request);
    }
}
