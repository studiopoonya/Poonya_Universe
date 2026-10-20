<?php

namespace Tests\Feature;

use App\Models\{PaymentTest, Setting};
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentTestChargeTest extends TestCase
{
    public function test_admin_creates_a_rp_100_midtrans_test_charge(): void
    {
        $res = $this->asUser($this->admin())->postJson('/api/admin/payment-test')
            ->assertCreated()->assertJson(['amount' => 100, 'provider' => 'midtrans', 'qr_string' => '00020101021226QRISTEST'])
            ->assertJsonStructure(['expires_at']);

        $this->assertStringStartsWith('TEST-', $res->json('order_id'));
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/v2/charge') && $r['transaction_details']['gross_amount'] === 100);
    }

    public function test_status_is_read_from_the_gateway_without_a_webhook(): void
    {
        $admin = $this->admin();
        $orderId = $this->asUser($admin)->postJson('/api/admin/payment-test')->json('order_id');

        $this->asUser($admin)->getJson("/api/admin/payment-test/{$orderId}")->assertJson(['status' => 'pending']);

        $this->gatewayStatus = ['transaction_status' => 'settlement', 'payment_type' => 'qris'];
        $this->asUser($admin)->getJson("/api/admin/payment-test/{$orderId}")->assertJson(['status' => 'paid', 'method' => 'qris']);
    }

    public function test_webhook_for_a_test_charge_does_not_touch_bookings(): void
    {
        $orderId = $this->asUser($this->admin())->postJson('/api/admin/payment-test')->json('order_id');

        $this->notifyMidtrans($orderId, 'settlement')->assertOk();

        $this->assertSame('paid', PaymentTest::where('order_id', $orderId)->value('status'));
    }

    public function test_xendit_test_charge_and_status(): void
    {
        Setting::set('payment_gateway', 'xendit');
        $admin = $this->admin();

        $orderId = $this->asUser($admin)->postJson('/api/admin/payment-test', ['amount' => 1500])
            ->assertCreated()->assertJson(['provider' => 'xendit', 'payment_url' => 'https://checkout-staging.xendit.co/web/inv-123'])
            ->json('order_id');

        $this->gatewayStatus = [['status' => 'PAID', 'payment_method' => 'QR_CODE']];
        $this->asUser($admin)->getJson("/api/admin/payment-test/{$orderId}")->assertJson(['status' => 'paid', 'method' => 'qr_code', 'amount' => 1500]);
    }

    public function test_gateway_rejection_is_shown_to_the_admin(): void
    {
        $this->midtransDown();

        $this->asUser($this->admin())->postJson('/api/admin/payment-test')
            ->assertStatus(502)->assertJsonPath('message', fn ($m) => str_starts_with($m, 'Gateway menolak:'));
    }

    public function test_only_admins_can_run_test_charges(): void
    {
        $this->asUser($this->staff(['settings']))->postJson('/api/admin/payment-test')->assertForbidden();
    }
}
