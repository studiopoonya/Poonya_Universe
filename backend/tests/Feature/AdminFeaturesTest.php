<?php

namespace Tests\Feature;

use App\Models\{Payment, PromoCode, Setting, Studio};
use App\Services\MailSettings;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminFeaturesTest extends TestCase
{
    public function test_cancelling_a_paid_booking_flags_a_refund_until_marked_done(): void
    {
        $admin = $this->admin();
        $b = $this->book($this->slot($this->studio()));
        $this->notifyMidtrans($b->order_id, 'settlement');

        $this->asUser($admin)->patchJson("/api/admin/bookings/{$b->id}/cancel")->assertOk();
        $this->assertSame('refund_pending', $b->payment->fresh()->status);
        $this->asUser($admin)->getJson('/api/admin/bookings?status=refund')->assertJsonPath('total', 1);
        $this->asUser($admin)->getJson('/api/admin/dashboard')->assertJsonPath('stats.pending_refunds', 1);

        $this->asUser($admin)->patchJson("/api/admin/bookings/{$b->id}/refunded")->assertOk();
        $this->assertSame('refunded', $b->payment->fresh()->status);
        $this->asUser($admin)->patchJson("/api/admin/bookings/{$b->id}/refunded")->assertStatus(422);
    }

    public function test_dashboard_reports_revenue_per_studio_and_month(): void
    {
        $admin = $this->admin();
        $b = $this->book($this->slot($this->studio(['name' => 'Studio X'])));
        $this->notifyMidtrans($b->order_id, 'settlement');

        $this->asUser($admin)->getJson('/api/admin/dashboard')
            ->assertJsonPath('stats.total_revenue', 50000)
            ->assertJsonPath('revenue_by_studio.0.name', 'Studio X')
            ->assertJsonPath('revenue_by_studio.0.sessions', 1);
        $this->asUser($admin)->getJson('/api/admin/dashboard?month=' . now()->subYear()->format('Y-m'))
            ->assertJsonPath('stats.total_revenue', 0);
    }

    public function test_export_is_an_excel_friendly_csv(): void
    {
        $slot = $this->slot($this->studio());
        $this->book($slot, ['customer_name' => 'Budi; "Jr"']);

        $res = $this->asUser($this->admin())->get('/api/admin/bookings/export?month=' . substr($slot->date, 0, 7))->assertOk();
        $csv = $res->streamedContent();

        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString('"Budi; ""Jr"""', $csv);
        $this->assertStringContainsString('"=""081234567890"""', $csv);
        $this->assertStringContainsString('attachment', $res->headers->get('content-disposition'));
    }

    public function test_promo_code_crud(): void
    {
        $admin = $this->admin();

        $id = $this->asUser($admin)->postJson('/api/admin/promo-codes', ['code' => 'baru 1', 'type' => 'percent', 'value' => 10, 'is_active' => true])
            ->assertStatus(422)->json('id'); // spaces not allowed
        $id = $this->asUser($admin)->postJson('/api/admin/promo-codes', ['code' => 'baru1', 'type' => 'percent', 'value' => 10, 'is_active' => true])
            ->assertCreated()->assertJson(['code' => 'BARU1'])->json('id');
        $this->asUser($admin)->postJson('/api/admin/promo-codes', ['code' => 'X', 'type' => 'percent', 'value' => 150])->assertStatus(422);
        $this->asUser($admin)->putJson("/api/admin/promo-codes/{$id}", ['code' => 'BARU1', 'type' => 'fixed', 'value' => 5000, 'is_active' => false])->assertOk();
        $this->assertFalse(PromoCode::find($id)->is_active);
        $this->asUser($admin)->deleteJson("/api/admin/promo-codes/{$id}")->assertOk();
    }

    public function test_studio_weekend_price_features_and_thumbnail_cleanup(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('studios/old.jpg', 'x');
        $studio = $this->studio(['features' => ['A'], 'thumbnail_url' => '/storage/studios/old.jpg']);
        $admin = $this->admin();

        $this->asUser($admin)->post("/api/admin/studios/{$studio->id}", ['_method' => 'PUT', 'features' => '', 'weekend_price' => '90000'], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame([], $studio->fresh()->features);
        $this->assertSame(90000, $studio->fresh()->weekend_price);

        $this->asUser($admin)->deleteJson("/api/admin/studios/{$studio->id}")->assertOk();
        Storage::disk('public')->assertMissing('studios/old.jpg');
    }

    public function test_sender_email_settings_hide_and_encrypt_the_password(): void
    {
        $admin = $this->admin();

        $this->asUser($admin)->putJson('/api/admin/mail-settings', [
            'mail_host' => 'smtp.gmail.com', 'mail_port' => 587, 'mail_encryption' => 'tls',
            'mail_username' => 'studio@gmail.com', 'mail_password' => 'app-pass', 'mail_from_address' => 'studio@gmail.com',
        ])->assertOk();

        $this->assertNotSame('app-pass', Setting::get('mail_password'));
        $this->asUser($admin)->getJson('/api/admin/mail-settings')
            ->assertJsonMissingPath('mail_password')->assertJson(['has_password' => true]);

        MailSettings::apply();
        $this->assertSame('smtp.gmail.com', config('mail.mailers.smtp.host'));
        $this->assertSame('app-pass', config('mail.mailers.smtp.password'));
        $this->assertSame('studio@gmail.com', config('mail.from.address'));
    }

    public function test_settings_report_server_key_kind(): void
    {
        $this->asUser($this->admin())->getJson('/api/admin/settings')->assertJson(['server_key_status' => 'sandbox']);
    }

    public function test_production_toggle_switches_midtrans_api(): void
    {
        Setting::set('midtrans_is_production', true);
        $this->book($this->slot($this->studio()));

        \Illuminate\Support\Facades\Http::assertSent(fn ($r) => $r->url() === 'https://api.midtrans.com/v2/charge');
    }

    public function test_bookings_list_paginates_with_a_chosen_page_size(): void
    {
        $studio = $this->studio();
        foreach (range(9, 20) as $h) {
            $this->book($this->slot($studio, $this->weekday(20 + $h % 3), sprintf('%02d:00', $h)));
            $this->app['cache']->store()->flush(); // stay under the per-IP booking limit
        }
        $admin = $this->admin();

        $this->asUser($admin)->getJson('/api/admin/bookings?per_page=10&page=2')
            ->assertJson(['per_page' => 10, 'current_page' => 2, 'total' => 12, 'from' => 11, 'to' => 12]);
        $this->asUser($admin)->getJson('/api/admin/bookings?per_page=999')->assertJsonPath('per_page', 20);
    }
}
