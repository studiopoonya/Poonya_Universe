<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\{AuthController, BookingController, SlotController, StudioController};
use App\Http\Controllers\Admin;
use App\Http\Controllers\Webhook\PaymentWebhookController;
use App\Models\Setting;

// ── Public ──────────────────────────────────────────────────────────
Route::get('settings', fn () => response()->json(
    Setting::whereIn('key', ['midtrans_snap_url', 'midtrans_client_key', 'midtrans_is_production'])
           ->pluck('value', 'key')
));

// Real social proof for the homepage (replaces a hardcoded "200+" claim)
Route::get('stats', fn () => response()->json([
    'sessions_this_week' => \App\Models\Booking::where('status', 'confirmed')
        ->whereHas('slot', fn ($q) => $q->whereBetween('date', [now()->startOfWeek()->toDateString(), now()->endOfWeek()->toDateString()]))
        ->count(),
]));

Route::get('studios',          [StudioController::class, 'index']);
Route::get('studios/{studio}', [StudioController::class, 'show']);
Route::get('slots/available',  [SlotController::class, 'available']);
Route::get('bookings/{booking}/status', [BookingController::class, 'status']);
Route::get('bookings/order/{orderId}',  [BookingController::class, 'showByOrder']);

// Auth (admin/staff only — accounts are created from the Accounts page, no public sign-up)
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Guest booking — throttled so nobody can script-lock every slot
Route::post('bookings', [BookingController::class, 'store'])->middleware('throttle:bookings');

// ── Authenticated ────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me',      [AuthController::class, 'me']);
});

// ── Admin (staff + admin) ────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'admin'])
    ->prefix('admin')
    ->group(function () {
        Route::get('dashboard', [Admin\DashboardController::class, 'stats']);

        // Each group matches a page that can be ticked per staff account
        Route::middleware('permission:bookings')->group(function () {
            Route::get('bookings',                    [Admin\BookingController::class, 'index']);
            Route::get('bookings/{booking}',          [Admin\BookingController::class, 'show']);
            Route::patch('bookings/{booking}/cancel', [Admin\BookingController::class, 'cancel']);
            Route::patch('bookings/{booking}/confirm',[Admin\BookingController::class, 'confirm']);
        });

        // Walk-in booking is made from the Payment page
        Route::post('bookings', [Admin\BookingController::class, 'store'])->middleware('permission:payment');

        Route::middleware('permission:studios')->group(function () {
            Route::apiResource('studios', Admin\StudioController::class)->except(['show']);

            Route::get('slots',                  [Admin\SlotController::class, 'index']);
            Route::post('slots/generate',        [Admin\SlotController::class, 'generate']);
            Route::patch('slots/{slot}/block',   [Admin\SlotController::class, 'block']);
            Route::patch('slots/{slot}/unblock', [Admin\SlotController::class, 'unblock']);
        });

        Route::middleware('permission:settings')->group(function () {
            Route::get('settings', [Admin\SettingController::class, 'index']);
            Route::put('settings', [Admin\SettingController::class, 'update']);
        });
    });

// ── Admin only ───────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'admin.only'])
    ->prefix('admin')
    ->group(function () {
        Route::get('mail-settings',       [Admin\MailSettingController::class, 'index']);
        Route::put('mail-settings',       [Admin\MailSettingController::class, 'update']);
        Route::post('mail-settings/test', [Admin\MailSettingController::class, 'test'])->middleware('throttle:6,1');

        // Controller type-hints `User $user`, so bind {user} — with the default {account} it got an empty model
        Route::apiResource('accounts', Admin\AccountController::class)->except(['show'])->parameters(['accounts' => 'user']);
    });

// ── Webhooks ──────────────────────────────────────────────────────────
Route::post('webhooks/payment/midtrans', [PaymentWebhookController::class, 'midtrans']);
