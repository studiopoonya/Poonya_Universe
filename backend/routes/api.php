<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\{AuthController, BookingController, ManageBookingController, SlotController, StudioController};
use App\Http\Controllers\Admin;
use App\Http\Controllers\Webhook\PaymentWebhookController;
use App\Models\Setting;

// ── Public ──────────────────────────────────────────────────────────
// What the checkout needs to know (only public values: never a secret key)
Route::get('settings', fn () => response()->json([
    'payment_gateway'     => \App\Services\PaymentGatewayService::provider(),
    'midtrans_client_key' => (string) Setting::get('midtrans_client_key'),
    'midtrans_snap_url'   => \App\Services\PaymentGatewayService::midtransSnapJs(),
]));

// Real social proof for the homepage (replaces a hardcoded "200+" claim)
Route::get('stats', fn () => response()->json([
    'sessions_this_week' => (int) \App\Models\Booking::where('status', 'confirmed')
        ->whereHas('slot', fn ($q) => $q->whereBetween('date', [now()->startOfWeek()->toDateString(), now()->endOfWeek()->toDateString()]))
        ->sum('sessions'),
]));

Route::get('studios',          [StudioController::class, 'index']);
Route::get('studios/{studio}', [StudioController::class, 'show']);
Route::get('slots/available',  [SlotController::class, 'available']);
Route::get('bookings/{booking}/status', [BookingController::class, 'status']);
Route::get('bookings/order/{orderId}',  [BookingController::class, 'showByOrder']);
Route::get('quote', [BookingController::class, 'quote'])->middleware('throttle:30,1');

// Customer self-service: Order ID + email (throttled against guessing)
Route::post('bookings/lookup',     [ManageBookingController::class, 'lookup'])->middleware('throttle:10,1');
Route::post('bookings/reschedule', [ManageBookingController::class, 'reschedule'])->middleware('throttle:10,1');
Route::post('bookings/pay-online', [BookingController::class, 'payOnline'])->middleware('throttle:bookings');

// Auth (admin/staff only — accounts are created from the Accounts page, no public sign-up)
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('auth/two-factor', [AuthController::class, 'twoFactorLogin'])->middleware('throttle:login');

// Guest booking — throttled so nobody can script-lock every slot
Route::post('bookings', [BookingController::class, 'store'])->middleware('throttle:bookings');

// ── Authenticated ────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me',      [AuthController::class, 'me']);

    Route::post('auth/two-factor/setup',   [AuthController::class, 'twoFactorSetup']);
    Route::post('auth/two-factor/confirm', [AuthController::class, 'twoFactorConfirm'])->middleware('throttle:10,1');
    Route::delete('auth/two-factor',       [AuthController::class, 'twoFactorDisable'])->middleware('throttle:10,1');
});

// ── Admin (staff + admin) ────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'admin'])
    ->prefix('admin')
    ->group(function () {
        Route::get('dashboard', [Admin\DashboardController::class, 'stats']);

        // Each group matches a page that can be ticked per staff account
        Route::middleware('permission:bookings')->group(function () {
            Route::get('bookings',                    [Admin\BookingController::class, 'index']);
            Route::get('bookings/export',             [Admin\BookingController::class, 'export']);
            Route::get('bookings/{booking}',          [Admin\BookingController::class, 'show']);
            Route::patch('bookings/{booking}/cancel', [Admin\BookingController::class, 'cancel']);
            Route::patch('bookings/{booking}/confirm',[Admin\BookingController::class, 'confirm']);
            Route::patch('bookings/{booking}/refunded', [Admin\BookingController::class, 'markRefunded']);
        });

        Route::middleware('permission:studios')->group(function () {
            Route::apiResource('studios', Admin\StudioController::class)->except(['show']);

            Route::get('slots',                  [Admin\SlotController::class, 'index']);
            Route::post('slots/generate',        [Admin\SlotController::class, 'generate']);
            Route::patch('slots/{slot}/block',   [Admin\SlotController::class, 'block']);
            Route::patch('slots/{slot}/unblock', [Admin\SlotController::class, 'unblock']);

            Route::get('schedule',                              [Admin\ScheduleController::class, 'index']);
            Route::put('schedule/hours',                        [Admin\ScheduleController::class, 'updateHours']);
            Route::get('schedule/slots',                        [Admin\ScheduleController::class, 'slots']);
            Route::post('schedule/closed-dates',                [Admin\ScheduleController::class, 'addClosedDate']);
            Route::delete('schedule/closed-dates/{closedDate}', [Admin\ScheduleController::class, 'removeClosedDate']);
        });

        Route::apiResource('promo-codes', Admin\PromoCodeController::class)->except(['show'])->middleware('permission:promos');

        Route::middleware('permission:settings')->group(function () {
            Route::get('settings', [Admin\SettingController::class, 'index']);
            Route::put('settings', [Admin\SettingController::class, 'update']);
        });
    });

// ── Admin only ───────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'admin.only'])
    ->prefix('admin')
    ->group(function () {
        // "Tes Pembayaran" in Settings: a tiny real charge through the active gateway
        Route::post('payment-test',          [Admin\PaymentTestController::class, 'store'])->middleware('throttle:10,1');
        Route::get('payment-test/{orderId}', [Admin\PaymentTestController::class, 'show']);

        Route::get('mail-settings',       [Admin\MailSettingController::class, 'index']);
        Route::put('mail-settings',       [Admin\MailSettingController::class, 'update']);
        Route::post('mail-settings/test', [Admin\MailSettingController::class, 'test'])->middleware('throttle:6,1');

        // Controller type-hints `User $user`, so bind {user} — with the default {account} it got an empty model
        Route::patch('accounts/{user}/reset-two-factor', [Admin\AccountController::class, 'resetTwoFactor']);
        Route::apiResource('accounts', Admin\AccountController::class)->except(['show'])->parameters(['accounts' => 'user']);
    });

// ── Webhooks ──────────────────────────────────────────────────────────
Route::post('webhooks/payment/midtrans', [PaymentWebhookController::class, 'midtrans']);
Route::post('webhooks/payment/xendit',   [PaymentWebhookController::class, 'xendit']);
