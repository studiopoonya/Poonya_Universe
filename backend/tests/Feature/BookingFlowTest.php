<?php

namespace Tests\Feature;

use App\Models\{Booking, PromoCode, Slot};
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BookingFlowTest extends TestCase
{
    public function test_guest_can_book_and_gets_a_payment_token(): void
    {
        $slot = $this->slot($this->studio());

        $res = $this->postJson('/api/bookings', $this->bookingPayload($slot))
            ->assertCreated()
            ->assertJsonStructure(['booking_id', 'order_id', 'expires_at', 'payment_token']);

        $booking = Booking::find($res->json('booking_id'));
        $this->assertSame('pending', $booking->status);
        $this->assertSame(50000, $booking->payment->amount);
        $this->assertSame('locked', $slot->fresh()->status);
    }

    public function test_slot_can_be_booked_again_after_a_cancellation(): void
    {
        $slot = $this->slot($this->studio());
        $first = $this->book($slot);
        $first->update(['status' => 'cancelled']);
        $first->releaseSlot();

        $this->postJson('/api/bookings', $this->bookingPayload($slot))->assertCreated();
    }

    public function test_taken_slot_returns_409(): void
    {
        $slot = $this->slot($this->studio());
        $this->book($slot);

        $this->postJson('/api/bookings', $this->bookingPayload($slot))
            ->assertStatus(409)->assertJson(['code' => 'SLOT_UNAVAILABLE']);
    }

    public function test_slot_whose_time_has_passed_cannot_be_booked(): void
    {
        if (now()->hour < 1) $this->markTestSkipped('Needs an hour that already passed today.');
        $slot = $this->slot($this->studio(), today(), now()->subHour()->format('H:00'));

        $this->postJson('/api/bookings', $this->bookingPayload($slot))->assertStatus(422);
    }

    public function test_email_and_phone_are_validated_and_phone_is_normalised(): void
    {
        $studio = $this->studio();

        $this->postJson('/api/bookings', $this->bookingPayload($this->slot($studio), ['customer_email' => 'budi@gmail']))
            ->assertStatus(422)->assertJsonValidationErrors('customer_email');
        $this->postJson('/api/bookings', $this->bookingPayload($this->slot($studio, null, '11:00'), ['customer_phone' => 'abc']))
            ->assertStatus(422)->assertJsonValidationErrors('customer_phone');

        $b = $this->book($this->slot($studio, null, '12:00'), ['customer_phone' => '0812-3456 7890']);
        $this->assertSame('081234567890', $b->customer_phone);
    }

    public function test_validation_messages_are_in_indonesian(): void
    {
        $this->postJson('/api/bookings', [])->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'wajib diisi'));
    }

    public function test_gateway_failure_cancels_booking_and_frees_slot(): void
    {
        $this->midtransDown();
        $slot = $this->slot($this->studio());

        $this->postJson('/api/bookings', $this->bookingPayload($slot))
            ->assertStatus(502)->assertJson(['code' => 'PAYMENT_GATEWAY_ERROR']);

        $this->assertSame('cancelled', Booking::first()->status);
        $this->assertSame('available', $slot->fresh()->status);
    }

    public function test_midtrans_receives_the_stored_amount_and_an_absolute_finish_url(): void
    {
        PromoCode::create(['code' => 'HEMAT', 'type' => 'fixed', 'value' => 10000, 'is_active' => true]);
        $b = $this->book($this->slot($this->studio()), ['promo_code' => 'hemat']);

        Http::assertSent(fn ($req) => $req['transaction_details']['gross_amount'] === 40000
            && $req['transaction_details']['order_id'] === $b->order_id
            && str_starts_with($req['callbacks']['finish'], 'http://frontend.test/booking/success'));
    }

    public function test_weekend_price_and_promo_quote(): void
    {
        $studio = $this->studio(['price' => 100000, 'weekend_price' => 150000]);
        $sat = today()->addDays(7);
        while (! $sat->isSaturday()) $sat->addDay();
        $weekend = $this->slot($studio, $sat);
        PromoCode::create(['code' => 'DISKON20', 'type' => 'percent', 'value' => 20, 'is_active' => true]);

        $this->getJson("/api/quote?studio_id={$studio->id}&slot_id={$this->slot($studio)->id}")->assertJson(['total' => 100000, 'is_weekend' => false]);
        $this->getJson("/api/quote?studio_id={$studio->id}&slot_id={$weekend->id}&promo_code=diskon20")
            ->assertJson(['base_price' => 150000, 'discount' => 30000, 'total' => 120000, 'is_weekend' => true, 'promo' => ['code' => 'DISKON20']]);
    }

    public function test_invalid_promo_codes_are_explained_and_block_the_booking(): void
    {
        $studio = $this->studio();
        PromoCode::create(['code' => 'LAMA', 'type' => 'fixed', 'value' => 1000, 'is_active' => true, 'ends_at' => today()->subDay()]);
        PromoCode::create(['code' => 'SEKALI', 'type' => 'fixed', 'value' => 1000, 'is_active' => true, 'max_uses' => 1]);
        $slot = $this->slot($studio);

        $this->getJson("/api/quote?studio_id={$studio->id}&slot_id={$slot->id}&promo_code=NOPE")->assertJson(['promo_error' => 'Kode promo tidak ditemukan.']);
        $this->postJson('/api/bookings', $this->bookingPayload($slot, ['promo_code' => 'LAMA']))->assertStatus(422);
        $this->assertSame('available', $slot->fresh()->status);

        $this->book($slot, ['promo_code' => 'SEKALI']);
        $this->postJson('/api/bookings', $this->bookingPayload($this->slot($studio, null, '11:00'), ['promo_code' => 'SEKALI']))
            ->assertStatus(422)->assertJsonPath('message', 'Kuota kode promo sudah habis.');
    }

    public function test_fully_discounted_booking_is_confirmed_without_midtrans(): void
    {
        PromoCode::create(['code' => 'GRATIS', 'type' => 'percent', 'value' => 100, 'is_active' => true]);
        $slot = $this->slot($this->studio());

        $this->postJson('/api/bookings', $this->bookingPayload($slot, ['promo_code' => 'GRATIS']))
            ->assertCreated()->assertJson(['status' => 'confirmed'])->assertJsonMissing(['payment_token']);

        $this->assertSame('booked', $slot->fresh()->status);
        Http::assertNothingSent();
    }

    public function test_booking_endpoint_is_rate_limited_per_ip(): void
    {
        $studio = $this->studio();
        foreach (range(0, 4) as $i) {
            $this->postJson('/api/bookings', $this->bookingPayload($this->slot($studio, null, sprintf('%02d:00', 9 + $i))))->assertCreated();
        }

        $this->postJson('/api/bookings', $this->bookingPayload($this->slot($studio, null, '15:00')))->assertStatus(429);
    }

    public function test_stale_pending_booking_expires_without_a_queue_worker(): void
    {
        $slot = $this->slot($this->studio());
        $b = $this->book($slot);
        $b->update(['expires_at' => now()->subMinute()]);

        $this->getJson("/api/bookings/{$b->id}/status")->assertJson(['status' => 'expired']);
        $this->assertSame('available', $slot->fresh()->status);
    }

    public function test_relocking_a_lapsed_slot_retires_the_old_booking(): void
    {
        $slot = $this->slot($this->studio());
        $old = $this->book($slot);
        Slot::whereKey($slot->id)->update(['status' => 'available', 'locked_until' => null]); // lock lapsed, released

        $new = $this->book($slot);
        $this->assertSame('expired', $old->fresh()->status);

        // The old booking's expiry/late payment must not free or take the new holder's slot
        (new \App\Jobs\ExpireBooking($old))->handle();
        $this->notifyMidtrans($old->order_id, 'settlement');
        $this->assertSame('locked', $slot->fresh()->status);
        $this->assertSame('pending', $new->fresh()->status);
    }

    public function test_order_summary_has_no_personal_data(): void
    {
        $b = $this->book($this->slot($this->studio()));

        $this->getJson("/api/bookings/order/{$b->order_id}")
            ->assertOk()->assertJson(['status' => 'pending', 'start_time' => '10:00'])
            ->assertJsonMissing(['customer_email' => 'budi@example.com']);
        $this->getJson('/api/bookings/order/NOPE')->assertNotFound();
    }
}
