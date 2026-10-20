<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Totp;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\{Crypt, Hash};
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Checked directly (no session/guard): a token is only issued after any 2FA step
        $user = User::where('email', $request->email)->first();
        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages(['email' => 'Kredensial tidak cocok.']);
        }

        // Password was right, but the account also needs an authenticator code.
        // Hand back a short-lived encrypted challenge instead of a token.
        if ($user->two_factor_enabled) {
            return response()->json([
                'two_factor' => true,
                'challenge'  => Crypt::encryptString(json_encode(['uid' => $user->id, 'exp' => now()->addMinutes(5)->timestamp])),
            ]);
        }

        return $this->issueToken($user);
    }

    /** Second login step: authenticator code (or a one-time recovery code). */
    public function twoFactorLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge' => ['required', 'string'],
            'code'      => ['required', 'string', 'max:32'],
        ]);

        try {
            $payload = json_decode(Crypt::decryptString($data['challenge']), true);
        } catch (\Throwable) {
            $payload = null;
        }
        if (! $payload || $payload['exp'] < now()->timestamp) {
            throw ValidationException::withMessages(['code' => 'Sesi login kedaluwarsa. Silakan login ulang.']);
        }

        $user = User::findOrFail($payload['uid']);
        abort_unless($user->two_factor_enabled, 422, 'Verifikasi 2 langkah tidak aktif.');

        if (! Totp::verify($user->two_factor_secret, $data['code'], "user:{$user->id}") && ! $this->useRecoveryCode($user, $data['code'])) {
            throw ValidationException::withMessages(['code' => 'Kode salah atau sudah dipakai.']);
        }

        return $this->issueToken($user);
    }

    /** Start enabling 2FA: new secret, shown as a QR code. Not active until confirmed. */
    public function twoFactorSetup(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_if($user->two_factor_enabled, 422, 'Verifikasi 2 langkah sudah aktif.');

        $secret = Totp::newSecret();
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null])->save();

        return response()->json([
            'secret' => $secret,
            'uri'    => Totp::uri($secret, $user->email, config('app.name')),
        ]);
    }

    public function twoFactorConfirm(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        abort_if($user->two_factor_enabled || ! $user->two_factor_secret, 422, 'Mulai pengaturan 2FA terlebih dahulu.');
        if (! Totp::verify($user->two_factor_secret, $data['code'], "user:{$user->id}")) {
            throw ValidationException::withMessages(['code' => 'Kode salah. Pastikan jam di HP sudah benar.']);
        }

        $codes = collect(range(1, 8))->map(fn () => Str::upper(Str::random(5) . '-' . Str::random(5)))->all();
        $user->forceFill([
            'two_factor_confirmed_at'   => now(),
            'two_factor_recovery_codes' => array_map(fn ($c) => Hash::make($c), $codes),
        ])->save();

        // Plain recovery codes are shown exactly once
        return response()->json(['message' => 'Verifikasi 2 langkah aktif.', 'recovery_codes' => $codes]);
    }

    public function twoFactorDisable(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string']]);
        $user = $request->user();

        if (! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages(['password' => 'Password salah.']);
        }

        $user->forceFill(['two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null])->save();

        return response()->json(['message' => 'Verifikasi 2 langkah dimatikan.']);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    private function issueToken(User $user): JsonResponse
    {
        return response()->json(['user' => $user, 'token' => $user->createToken('api')->plainTextToken]);
    }

    /** Recovery codes are stored hashed and each works once. */
    private function useRecoveryCode(User $user, string $code): bool
    {
        $code   = strtoupper(trim($code));
        $hashes = $user->two_factor_recovery_codes ?? [];

        foreach ($hashes as $i => $hash) {
            if (Hash::check($code, $hash)) {
                unset($hashes[$i]);
                $user->forceFill(['two_factor_recovery_codes' => array_values($hashes)])->save();

                return true;
            }
        }

        return false;
    }
}
