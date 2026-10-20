<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Time-based one-time passwords (RFC 6238, SHA1, 6 digits, 30s) — what Google
 * Authenticator, Authy, Microsoft Authenticator etc. generate.
 */
class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function newSecret(): string
    {
        $bytes = random_bytes(20);
        $bits  = '';
        foreach (str_split($bytes) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);

        return implode('', array_map(fn ($chunk) => self::ALPHABET[bindec(str_pad($chunk, 5, '0'))], str_split($bits, 5)));
    }

    public static function uri(string $secret, string $account, string $issuer): string
    {
        return 'otpauth://totp/' . rawurlencode("$issuer:$account")
            . '?' . http_build_query(['secret' => $secret, 'issuer' => $issuer, 'digits' => 6, 'period' => 30]);
    }

    public static function code(string $secret, int $step): string
    {
        $key  = self::base32Decode($secret);
        $hash = hash_hmac('sha1', pack('N2', 0, $step), $key, true);
        $off  = ord($hash[19]) & 0x0F;
        $num  = ((ord($hash[$off]) & 0x7F) << 24) | (ord($hash[$off + 1]) << 16) | (ord($hash[$off + 2]) << 8) | ord($hash[$off + 3]);

        return str_pad((string) ($num % 1_000_000), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Accepts the current code or one step either side (phone clock drift). Each code
     * works once per user — a replayed code is rejected.
     */
    public static function verify(string $secret, string $code, string $replayKey): bool
    {
        $code = preg_replace('/\s+/', '', $code);
        if (! preg_match('/^\d{6}$/', $code)) return false;

        $now = intdiv(time(), 30);
        foreach ([$now - 1, $now, $now + 1] as $step) {
            if (hash_equals(self::code($secret, $step), $code)) {
                return Cache::add("totp:$replayKey:$step", true, 120);
            }
        }

        return false;
    }

    private static function base32Decode(string $s): string
    {
        $bits = '';
        foreach (str_split(strtoupper(rtrim($s, '='))) as $c) {
            $i = strpos(self::ALPHABET, $c);
            if ($i === false) continue;
            $bits .= str_pad(decbin($i), 5, '0', STR_PAD_LEFT);
        }

        return implode('', array_map(fn ($b) => chr(bindec($b)), array_filter(str_split($bits, 8), fn ($b) => strlen($b) === 8)));
    }
}
