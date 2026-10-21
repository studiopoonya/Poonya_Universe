<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\PaymentGatewayService;
use Illuminate\Http\{JsonResponse, Request};

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        // Secret keys stay in .env; only report what kind is configured so the admin can
        // spot a missing/placeholder key (payments then fail with "Unauthorized")
        $key = (string) config('services.midtrans.server_key');

        return response()->json([
            'payment_gateway'        => PaymentGatewayService::provider(),
            'midtrans_client_key'    => \App\Services\PaymentGatewayService::midtransClientKey(),
            'midtrans_is_production' => PaymentGatewayService::midtransIsProduction() ? '1' : '0',
            'server_key_status'      => match (true) {
                $key === ''                             => 'missing',
                str_starts_with($key, 'SB-Mid-server-') => 'sandbox',
                str_starts_with($key, 'Mid-server-')    => 'production',
                default                                 => 'invalid',
            },
            'xendit_key_status'      => PaymentGatewayService::xenditKeyStatus(),
            'xendit_callback_token'  => (string) config('services.xendit.callback_token') !== '',
            'xendit_webhook_url'     => rtrim((string) config('app.url'), '/') . '/api/webhooks/payment/xendit',
            'midtrans_webhook_url'   => rtrim((string) config('app.url'), '/') . '/api/webhooks/payment/midtrans',
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'payment_gateway'        => ['nullable', 'in:' . implode(',', PaymentGatewayService::PROVIDERS)],
            // The client key is sent to every visitor's browser — refuse anything that looks like a server key
            'midtrans_client_key'    => ['nullable', 'string', 'max:100', 'not_regex:/server/i'],
            'midtrans_is_production' => ['nullable', 'boolean'],
        ], [
            'midtrans_client_key.not_regex' => 'Ini Server Key (rahasia), bukan Client Key. Server Key hanya boleh diisi di file .env backend. Client Key diawali "Mid-client-" / "SB-Mid-client-".',
        ]);

        foreach ($data as $key => $value) {
            Setting::set($key, $value);
        }

        return response()->json(['message' => 'Pengaturan disimpan.']);
    }
}
