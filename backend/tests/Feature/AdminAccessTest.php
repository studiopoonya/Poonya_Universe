<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/admin/bookings')->assertUnauthorized();
    }

    public function test_public_registration_is_gone(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'x'])->assertNotFound();
    }

    public function test_staff_only_reach_pages_ticked_on_their_account(): void
    {
        $staff = $this->staff(['bookings']);

        $this->asUser($staff)->getJson('/api/admin/dashboard')->assertOk();
        $this->asUser($staff)->getJson('/api/admin/bookings')->assertOk();
        $this->asUser($staff)->getJson('/api/admin/bookings/export')->assertOk();
        $this->asUser($staff)->getJson('/api/admin/studios')->assertForbidden();
        $this->asUser($staff)->getJson('/api/admin/schedule')->assertForbidden();
        $this->asUser($staff)->getJson('/api/admin/promo-codes')->assertForbidden();
        $this->asUser($staff)->postJson('/api/admin/bookings', [])->assertForbidden(); // walk-in = payment
        $this->asUser($staff)->getJson('/api/admin/settings')->assertForbidden();
        $this->asUser($staff)->getJson('/api/admin/mail-settings')->assertForbidden();
        $this->asUser($staff)->getJson('/api/admin/accounts')->assertForbidden();

        $this->asUser($this->staff(['studios', 'settings', 'promos']))->getJson('/api/admin/studios')->assertOk();
    }

    public function test_admin_can_edit_and_delete_accounts(): void
    {
        $admin = $this->admin();
        $staff = $this->staff();

        $this->asUser($admin)->putJson("/api/admin/accounts/{$staff->id}", ['name' => 'Nama Baru', 'permissions' => ['bookings']])->assertOk();
        $this->assertSame('Nama Baru', $staff->fresh()->name);
        $this->assertSame(['bookings'], $staff->fresh()->permissions);

        $this->asUser($admin)->deleteJson("/api/admin/accounts/{$staff->id}")->assertOk();
        $this->assertNull(User::find($staff->id));
    }

    public function test_last_admin_cannot_be_demoted_and_passwords_need_8_chars(): void
    {
        $admin = $this->admin();

        $this->asUser($admin)->putJson("/api/admin/accounts/{$admin->id}", ['role' => 'staff'])->assertStatus(422);
        $this->assertSame('admin', $admin->fresh()->role);
        $this->asUser($admin)->postJson('/api/admin/accounts', ['name' => 'N', 'email' => 'n@x.co', 'password' => '1234567', 'role' => 'staff'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_login_is_rate_limited(): void
    {
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/auth/login', ['email' => 'nobody@x.co', 'password' => 'wrong'])->assertStatus(422);
        }
        $this->postJson('/api/auth/login', ['email' => 'nobody@x.co', 'password' => 'wrong'])->assertStatus(429);
    }

    public function test_same_domain_requests_are_not_blocked_by_csrf(): void
    {
        $slot = $this->slot($this->studio());

        $this->withHeaders(['Origin' => config('app.url'), 'Referer' => config('app.url') . '/booking'])
            ->postJson('/api/bookings', $this->bookingPayload($slot))->assertCreated();
    }

    public function test_tokens_expire(): void
    {
        $this->assertSame(60 * 24 * 7, config('sanctum.expiration'));
    }
}
