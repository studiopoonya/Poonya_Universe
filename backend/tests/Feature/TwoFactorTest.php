<?php

namespace Tests\Feature;

use App\Services\Totp;
use Illuminate\Support\Facades\{Cache, DB};
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    private function code(string $secret, int $offset = 0): string
    {
        return Totp::code($secret, intdiv(time(), 30) + $offset);
    }

    /** @return array{0: \App\Models\User, 1: string, 2: array} user, secret, recovery codes */
    private function enabled(): array
    {
        $user = $this->admin(['email' => 'two@admin.test']);
        $secret = $this->asUser($user)->postJson('/api/auth/two-factor/setup')->assertOk()->json('secret');
        $codes = $this->asUser($user)->postJson('/api/auth/two-factor/confirm', ['code' => $this->code($secret)])
            ->assertOk()->json('recovery_codes');
        Cache::flush(); // let codes from the setup step be usable again in this test

        return [$user->fresh(), $secret, $codes];
    }

    public function test_setup_stores_secret_encrypted_and_codes_hashed(): void
    {
        [$user, $secret, $codes] = $this->enabled();

        $this->assertCount(8, $codes);
        $raw = DB::table('users')->find($user->id);
        $this->assertNotSame($secret, $raw->two_factor_secret);
        $this->assertStringNotContainsString($codes[0], $raw->two_factor_recovery_codes);
    }

    public function test_login_requires_a_code_when_enabled(): void
    {
        [, $secret] = $this->enabled();

        $challenge = $this->postJson('/api/auth/login', ['email' => 'two@admin.test', 'password' => 'password123'])
            ->assertOk()->assertJson(['two_factor' => true])->assertJsonMissingPath('token')->json('challenge');

        $this->postJson('/api/auth/two-factor', ['challenge' => $challenge, 'code' => '000000'])->assertStatus(422);
        $code = $this->code($secret, 1); // clock drift tolerated
        $this->postJson('/api/auth/two-factor', ['challenge' => $challenge, 'code' => $code])->assertOk()->assertJsonStructure(['token']);
        $this->postJson('/api/auth/two-factor', ['challenge' => $challenge, 'code' => $code])->assertStatus(422); // no replay
    }

    public function test_recovery_codes_work_once(): void
    {
        [, , $codes] = $this->enabled();
        $challenge = $this->postJson('/api/auth/login', ['email' => 'two@admin.test', 'password' => 'password123'])->json('challenge');

        $this->postJson('/api/auth/two-factor', ['challenge' => $challenge, 'code' => strtolower($codes[0])])->assertOk();
        $this->postJson('/api/auth/two-factor', ['challenge' => $challenge, 'code' => $codes[0]])->assertStatus(422);
    }

    public function test_expired_or_forged_challenge_is_rejected(): void
    {
        [$user, $secret] = $this->enabled();
        $expired = \Illuminate\Support\Facades\Crypt::encryptString(json_encode(['uid' => $user->id, 'exp' => now()->subMinute()->timestamp]));

        $this->postJson('/api/auth/two-factor', ['challenge' => $expired, 'code' => $this->code($secret)])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'kedaluwarsa'));
        $this->postJson('/api/auth/two-factor', ['challenge' => 'forged', 'code' => '123456'])->assertStatus(422);
    }

    public function test_disable_needs_password_and_admin_can_reset(): void
    {
        [$user] = $this->enabled();

        $this->asUser($user)->deleteJson('/api/auth/two-factor', ['password' => 'wrong'])->assertStatus(422);
        $this->assertTrue($user->fresh()->two_factor_enabled);

        $this->asUser($this->admin())->patchJson("/api/admin/accounts/{$user->id}/reset-two-factor")->assertOk();
        $this->assertFalse($user->fresh()->two_factor_enabled);
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_secrets_never_leave_the_api(): void
    {
        [$user] = $this->enabled();

        $this->asUser($user)->getJson('/api/auth/me')
            ->assertJson(['two_factor_enabled' => true])
            ->assertJsonMissingPath('two_factor_secret')
            ->assertJsonMissingPath('two_factor_recovery_codes');
    }
}
