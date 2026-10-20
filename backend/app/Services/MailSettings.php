<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;

/**
 * Sender email (SMTP) configured by the admin in the panel. Stored in the
 * settings table — the password encrypted — and applied on top of .env.
 */
class MailSettings
{
    public const KEYS = [
        'mail_host', 'mail_port', 'mail_username', 'mail_password',
        'mail_encryption', 'mail_from_address', 'mail_from_name',
    ];

    /** @return array<string, ?string> raw values, password still encrypted */
    public static function all(): array
    {
        $saved = Setting::whereIn('key', self::KEYS)->pluck('value', 'key');

        return collect(self::KEYS)->mapWithKeys(fn ($k) => [$k => $saved[$k] ?? null])->all();
    }

    public static function password(?string $encrypted): ?string
    {
        if (! $encrypted) return null;

        try {
            return Crypt::decryptString($encrypted);
        } catch (\Throwable) {
            return null; // APP_KEY changed — admin has to re-enter it
        }
    }

    /**
     * Point Laravel's mailer at the saved SMTP account. Called before every queued
     * job, so a long-running queue worker picks up changes without a restart.
     */
    public static function apply(): void
    {
        try {
            $s = self::all();
        } catch (\Throwable) {
            return; // settings table not migrated yet
        }

        if (! $s['mail_host'] || ! $s['mail_from_address']) return; // not configured — keep .env

        config([
            'mail.default'                => 'smtp',
            'mail.mailers.smtp.host'      => $s['mail_host'],
            'mail.mailers.smtp.port'      => (int) ($s['mail_port'] ?: 587),
            'mail.mailers.smtp.scheme'    => $s['mail_encryption'] === 'ssl' ? 'smtps' : 'smtp',
            'mail.mailers.smtp.username'  => $s['mail_username'],
            'mail.mailers.smtp.password'  => self::password($s['mail_password']),
            'mail.mailers.smtp.timeout'   => 15,
            'mail.from.address'           => $s['mail_from_address'],
            'mail.from.name'              => $s['mail_from_name'] ?: config('app.name'),
        ]);

        // Drop the cached mailer so the new config is used on the next send
        Mail::purge('smtp');
    }
}
