<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\{JsonResponse, Request};

class SettingController extends Controller
{
    private array $publicKeys = [
        'midtrans_snap_url',
        'midtrans_client_key',
        'midtrans_is_production',
    ];

    public function index(): JsonResponse
    {
        $settings = Setting::whereIn('key', $this->publicKeys)->pluck('value', 'key');

        // The server key stays in .env; only report what kind it is so the admin can spot
        // a missing/placeholder key (payments then fail with "Unauthorized")
        $key = (string) config('services.midtrans.server_key');
        $settings['server_key_status'] = match (true) {
            $key === ''                             => 'missing',
            str_starts_with($key, 'SB-Mid-server-') => 'sandbox',
            str_starts_with($key, 'Mid-server-')    => 'production',
            default                                 => 'invalid',
        };

        return response()->json($settings);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'midtrans_snap_url'       => ['nullable', 'url'],
            'midtrans_client_key'     => ['nullable', 'string'],
            'midtrans_is_production'  => ['nullable', 'boolean'],
        ]);

        foreach ($data as $key => $value) {
            Setting::set($key, $value);
        }

        return response()->json(['message' => 'Pengaturan disimpan.']);
    }
}
