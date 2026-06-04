<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\{AuthController, BookingController, PackageController, SlotController, StudioController};
use App\Http\Controllers\Admin;
use App\Http\Controllers\Webhook\PaymentWebhookController;
use App\Models\Setting;

// ── Public ──────────────────────────────────────────────────────────
Route::get('settings', fn () => response()->json(
    Setting::whereIn('key', ['midtrans_snap_url', 'midtrans_client_key', 'midtrans_is_production'])
           ->pluck('value', 'key')
));

Route::get('studios',          [StudioController::class, 'index']);
Route::get('studios/{studio}', [StudioController::class, 'show']);
Route::get('slots/available',  [SlotController::class, 'available']);
Route::get('packages',         [PackageController::class, 'index']);
Route::get('bookings/{booking}/status', [BookingController::class, 'status']);

// Auth
Route::post('auth/register', [AuthController::class, 'register']);
Route::post('auth/login',    [AuthController::class, 'login']);

// Guest booking
Route::post('bookings', [BookingController::class, 'store']);

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

        Route::get('bookings',                    [Admin\BookingController::class, 'index']);
        Route::post('bookings',                   [Admin\BookingController::class, 'store']);
        Route::get('bookings/{booking}',          [Admin\BookingController::class, 'show']);
        Route::patch('bookings/{booking}/cancel', [Admin\BookingController::class, 'cancel']);
        Route::patch('bookings/{booking}/confirm',[Admin\BookingController::class, 'confirm']);
    });

// ── Admin only ───────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'admin.only'])
    ->prefix('admin')
    ->group(function () {
        Route::apiResource('packages', Admin\PackageController::class);
        Route::apiResource('studios',  Admin\StudioController::class)->except(['show']);

        Route::get('slots',                  [Admin\SlotController::class, 'index']);
        Route::post('slots/generate',        [Admin\SlotController::class, 'generate']);
        Route::patch('slots/{slot}/block',   [Admin\SlotController::class, 'block']);
        Route::patch('slots/{slot}/unblock', [Admin\SlotController::class, 'unblock']);

        Route::get('settings',  [Admin\SettingController::class, 'index']);
        Route::put('settings',  [Admin\SettingController::class, 'update']);

        Route::apiResource('accounts', Admin\AccountController::class)->except(['show']);
    });

// ── Webhooks ──────────────────────────────────────────────────────────
Route::post('webhooks/payment/midtrans', [PaymentWebhookController::class, 'midtrans']);
