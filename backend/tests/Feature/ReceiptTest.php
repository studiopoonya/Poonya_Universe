<?php

namespace Tests\Feature;

use App\Notifications\BookingConfirmed;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ReceiptTest extends TestCase
{
    public function test_customer_gets_a_pdf_only_once_paid(): void
    {
        $b = $this->book($this->slot($this->studio()));
        $creds = ['order_id' => $b->order_id, 'email' => 'BUDI@example.com'];

        $this->postJson('/api/bookings/receipt', $creds)->assertStatus(422);

        $this->notifyMidtrans($b->order_id, 'settlement');
        $res = $this->postJson('/api/bookings/receipt', $creds)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $res->getContent());
        $this->assertStringContainsString("Struk-{$b->order_id}.pdf", $res->headers->get('Content-Disposition'));
    }

    public function test_wrong_email_gets_nothing(): void
    {
        $b = $this->book($this->slot($this->studio()));
        $this->notifyMidtrans($b->order_id, 'settlement');

        $this->postJson('/api/bookings/receipt', ['order_id' => $b->order_id, 'email' => 'other@example.com'])->assertNotFound();
    }

    public function test_admin_downloads_a_cash_receipt(): void
    {
        $admin = $this->admin();
        $id = $this->postJson('/api/bookings', $this->bookingPayload($this->slot($this->studio()), ['payment_method' => 'onsite']))->json('booking_id');

        $this->asUser($admin)->get("/api/admin/bookings/{$id}/receipt")->assertStatus(422);

        $this->asUser($admin)->patchJson("/api/admin/bookings/{$id}/confirm", ['cash_received' => 100000])->assertOk();
        $this->assertStringStartsWith('%PDF', $this->asUser($admin)->get("/api/admin/bookings/{$id}/receipt")->assertOk()->getContent());
    }

    public function test_paid_confirmation_email_carries_the_receipt(): void
    {
        Notification::fake();
        $b = $this->book($this->slot($this->studio()));
        $this->notifyMidtrans($b->order_id, 'settlement');

        Notification::assertSentOnDemand(BookingConfirmed::class, function (BookingConfirmed $n, $c, $who) {
            $mail = $n->toMail($who);

            return count($mail->rawAttachments) === 1 && str_ends_with($mail->rawAttachments[0]['name'], '.pdf');
        });
    }
}
