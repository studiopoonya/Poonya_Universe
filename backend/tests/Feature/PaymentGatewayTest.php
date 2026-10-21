<?php

namespace Tests\Feature;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentGatewayTest extends TestCase
{
    private function useXendit(): void
    {
        Setting::set('payment_gateway', 'xendit');
    }

    private function xenditCallback(string $orderId, string $status, string $token = 'test-callback-token')
    {
        return $this->withHeader('x-callback-token', $token)->postJson('/api/webhooks/payment/xendit', [
            'id' => 'inv-123', 'external_id' => $orderId, 'status' => $status, 'payment_method' => 'QR_CODE', 'paid_amount' => 50000,
        ]);
    }

    public function test_xendit_booking_returns_a_checkout_url(): void
    {
        $this->useXendit();
        $slot = $this->slot($this->studio());

        $res = $this->postJson('/api/bookings', $this->bookingPayload($slot))
            ->assertCreated()->assertJson(['provider' => 'xendit', 'payment_url' => 'https://checkout-staging.xendit.co/web/inv-123'])
            ->assertJsonMissingPath('payment_token');

        $this->assertSame('xendit', \App\Models\Booking::find($res->json('booking_id'))->payment->gateway);
        Http::assertSent(fn ($r) => $r->url() === 'https://api.xendit.co/v2/invoices'
            && $r['amount'] === 50000
            && $r['invoice_duration'] === 900
            && str_starts_with($r['success_redirect_url'], 'http://frontend.test/booking/success'));
    }

    public function test_xendit_callback_confirms_or_expires(): void
    {
        $this->useXendit();
        $studio = $this->studio();
        $paid = $this->book($s1 = $this->slot($studio));
        $late = $this->book($s2 = $this->slot($studio, null, '11:00'));

        $this->xenditCallback($paid->order_id, 'PAID')->assertOk();
        $this->xenditCallback($late->order_id, 'EXPIRED')->assertOk();

        $this->assertSame('confirmed', $paid->fresh()->status);
        $this->assertSame('booked', $s1->fresh()->status);
        $this->assertSame('qr_code', $paid->payment->fresh()->method);
        $this->assertSame('expired', $late->fresh()->status);
        $this->assertSame('available', $s2->fresh()->status);
    }

    public function test_xendit_callback_needs_the_verification_token(): void
    {
        $b = $this->book($this->slot($this->studio()));

        $this->xenditCallback($b->order_id, 'PAID', 'wrong')->assertForbidden();
        $this->assertSame('pending', $b->fresh()->status);
    }

    public function test_midtrans_remains_the_default(): void
    {
        $this->postJson('/api/bookings', $this->bookingPayload($this->slot($this->studio())))
            ->assertCreated()->assertJson(['provider' => 'midtrans', 'qr_string' => '00020101021226QRISTEST']);
    }

    public function test_server_key_is_refused_in_the_public_client_key_field(): void
    {
        $admin = $this->admin();

        $this->asUser($admin)->putJson('/api/admin/settings', ['midtrans_client_key' => 'Mid-server-abc123'])
            ->assertStatus(422)->assertJsonValidationErrors('midtrans_client_key');
        $this->asUser($admin)->putJson('/api/admin/settings', ['midtrans_client_key' => 'SB-Mid-client-abc', 'payment_gateway' => 'xendit'])->assertOk();

        $this->getJson('/api/settings')->assertExactJson([
            'payment_gateway' => 'xendit', 'midtrans_client_key' => 'SB-Mid-client-abc',
            'midtrans_snap_url' => 'https://app.sandbox.midtrans.com/snap/snap.js',
        ]);
    }

    public function test_snap_js_follows_the_environment_toggle(): void
    {
        Setting::set('midtrans_is_production', true);

        $this->getJson('/api/settings')->assertJsonPath('midtrans_snap_url', 'https://app.midtrans.com/snap/snap.js');
    }

    public function test_admin_sees_xendit_key_status_without_the_key(): void
    {
        $this->asUser($this->admin())->getJson('/api/admin/settings')
            ->assertJson(['xendit_key_status' => 'test', 'xendit_callback_token' => true])
            ->assertJsonPath('xendit_webhook_url', fn ($u) => str_ends_with($u, '/api/webhooks/payment/xendit'));
    }

    public function test_midtrans_is_asked_to_also_notify_this_app_when_public(): void
    {
        config(['app.url' => 'https://selfstudio.example.com']);
        $this->book($this->slot($this->studio()));

        \Illuminate\Support\Facades\Http::assertSent(fn ($r) => str_ends_with($r->url(), '/v2/charge')
            && $r->header('X-Append-Notification') === ['https://selfstudio.example.com/api/webhooks/payment/midtrans']);
    }

    public function test_no_notification_header_from_localhost(): void
    {
        config(['app.url' => 'http://localhost:8000']);
        $this->book($this->slot($this->studio()));

        \Illuminate\Support\Facades\Http::assertSent(fn ($r) => str_ends_with($r->url(), '/v2/charge') && ! $r->hasHeader('X-Append-Notification'));
    }
}
