<?php

namespace Tests\Feature;

use App\Notifications\BookingConfirmed;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PaymentWebhookTest extends TestCase
{
    public function test_pending_notification_keeps_the_booking_waiting(): void
    {
        $slot = $this->slot($this->studio());
        $b = $this->book($slot);

        $this->notifyMidtrans($b->order_id, 'pending')->assertOk();

        $this->assertSame('pending', $b->fresh()->status);
        $this->assertSame('locked', $slot->fresh()->status);
    }

    public function test_settlement_confirms_and_emails_the_guest(): void
    {
        Notification::fake();
        $slot = $this->slot($this->studio());
        $b = $this->book($slot);

        $this->notifyMidtrans($b->order_id, 'settlement')->assertOk();

        $this->assertSame('confirmed', $b->fresh()->status);
        $this->assertSame('booked', $slot->fresh()->status);
        $this->assertSame('paid', $b->payment->fresh()->status);
        Notification::assertSentOnDemand(BookingConfirmed::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'budi@example.com');
    }

    public function test_expire_and_fraud_deny_release_the_slot(): void
    {
        $studio = $this->studio();
        $a = $this->book($s1 = $this->slot($studio));
        $b = $this->book($s2 = $this->slot($studio, null, '11:00'));

        $this->notifyMidtrans($a->order_id, 'expire');
        $this->notifyMidtrans($b->order_id, 'capture', 'deny');

        $this->assertSame('expired', $a->fresh()->status);
        $this->assertSame('cancelled', $b->fresh()->status);
        $this->assertSame('available', $s1->fresh()->status);
        $this->assertSame('available', $s2->fresh()->status);
    }

    public function test_late_payment_is_flagged_for_refund_not_revived(): void
    {
        $b = $this->book($this->slot($this->studio()));
        $b->update(['status' => 'expired']);

        $this->notifyMidtrans($b->order_id, 'settlement')->assertOk();

        $this->assertSame('expired', $b->fresh()->status);
        $this->assertSame('refund_pending', $b->payment->fresh()->status);
    }

    public function test_repeated_settlement_for_a_confirmed_booking_changes_nothing(): void
    {
        $b = $this->book($this->slot($this->studio()));
        $this->notifyMidtrans($b->order_id, 'settlement');
        $this->notifyMidtrans($b->order_id, 'settlement');

        $this->assertSame('paid', $b->payment->fresh()->status);
    }

    public function test_bad_signature_is_rejected(): void
    {
        $this->postJson('/api/webhooks/payment/midtrans', ['order_id' => 'x', 'signature_key' => 'nope'])->assertForbidden();
    }

    public function test_confirmation_email_content(): void
    {
        $b = $this->book($this->slot($this->studio(['name' => 'Studio A'])));
        $mail = (new BookingConfirmed($b))->toMail(new \Illuminate\Notifications\AnonymousNotifiable);

        $this->assertStringStartsWith('Booking Dikonfirmasi', $mail->subject);
        $this->assertContains('**Studio:** Studio A', $mail->introLines);
        $this->assertStringStartsWith('http://frontend.test/cek-booking?order_id=', $mail->actionUrl);
    }
}
