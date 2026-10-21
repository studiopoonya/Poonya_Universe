<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\MailSettings;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\{Crypt, Mail};

class MailSettingController extends Controller
{
    public function index(): JsonResponse
    {
        $s = MailSettings::all();

        // Never send the password back — only whether one is saved
        $s['has_password'] = (bool) MailSettings::password($s['mail_password']);
        unset($s['mail_password']);

        // SMTP set up in the server's .env (used whenever the form above is left empty)
        $s['env_smtp'] = config('mail.default') === 'smtp' && filled(config('mail.mailers.smtp.host'))
            && filled(config('mail.mailers.smtp.username')) && filled(config('mail.mailers.smtp.password'))
            ? ['host' => config('mail.mailers.smtp.host'), 'from' => config('mail.from.address')]
            : null;

        return response()->json($s);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            // All empty = use the SMTP from the server's .env
            'mail_host'         => ['nullable', 'string', 'max:255'],
            'mail_port'         => ['required_with:mail_host', 'nullable', 'integer', 'between:1,65535'],
            'mail_encryption'   => ['required_with:mail_host', 'nullable', 'in:tls,ssl'],
            'mail_username'     => ['nullable', 'string', 'max:255'],
            'mail_password'     => ['nullable', 'string', 'max:255'], // empty = keep current
            'mail_from_address' => ['required_with:mail_host', 'nullable', 'email', 'max:255'],
            'mail_from_name'    => ['nullable', 'string', 'max:255'],
            'admin_notify_email' => ['nullable', 'string', 'max:500', function ($attr, $value, $fail) {
                foreach (array_filter(array_map('trim', explode(',', (string) $value))) as $e) {
                    if (! filter_var($e, FILTER_VALIDATE_EMAIL)) $fail("\"{$e}\" bukan alamat email yang valid.");
                }
            }],
        ]);
        $data['admin_notify_email'] = implode(', ', array_filter(array_map('trim', explode(',', (string) ($data['admin_notify_email'] ?? '')))));

        if (filled($data['mail_password'] ?? null)) {
            $data['mail_password'] = Crypt::encryptString($data['mail_password']);
        } else {
            unset($data['mail_password']);
        }

        foreach ($data as $key => $value) {
            Setting::set($key, $value);
        }

        return response()->json(['message' => 'Email pengirim disimpan.']);
    }

    /** Send a test email with the saved settings so the admin knows they work. */
    public function test(Request $request): JsonResponse
    {
        $data = $request->validate(['to' => ['required', 'email']]);

        MailSettings::apply();

        try {
            Mail::raw(
                'Email pengirim ' . config('app.name') . ' sudah tersambung. Konfirmasi booking akan dikirim dari alamat ini.',
                fn ($m) => $m->to($data['to'])->subject('Tes Email — ' . config('app.name'))
            );
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal mengirim: ' . $e->getMessage(),
            ], 422);
        }

        return response()->json(['message' => "Email tes terkirim ke {$data['to']}."]);
    }
}
