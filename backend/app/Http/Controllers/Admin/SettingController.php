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
