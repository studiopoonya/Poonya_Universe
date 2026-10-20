<?php

namespace Tests\Feature;

use App\Models\{Booking, Slot};
use App\Notifications\{BookingConfirmed, OnsiteReservationCancelled};
use Illuminate\Support\Facades\{Http, Notification};
use Tests\TestCase;

class OnsitePaymentTest extends TestCase
{
    private function reserve(Slot $slot, array $extra = []): Booking
    {
        $res = $this->postJson('/api/bookings', $this->bookingPayload($slot, $extra + ['payment_method' => 'onsite']))
            ->assertCreated()->assertJson(['status' => 'onsite'])->assertJsonMissingPath('payment_token');

        return Booking::findOrFail($res->json('booking_id'));
    }

    public function test_onsite_reservation_does_not_lock_the_slot_or_call_midtrans(): void
    {
        Notification::fake();
        $slot = $this->slot($this->studio());

        $b = $this->reserve($slot);

        $this->assertSame('available', $slot->fresh()->status);
        $this->assertSame('cash', $b->payment->gateway);
        $this->assertSame('pending', $b->payment->status);
        Http::assertNothingSent();
        Notification::assertSentOnDemand(BookingConfirmed::class);
    }

    public function test_paying_online_takes_the_slot_and_cancels_the_onsite_reservation(): void
    {
        Notification::fake();
        $slot = $this->slot($this->studio());
        $onsite = $this->reserve($slot, ['customer_email' => 'onsite@example.com']);

        $online = $this->book($slot, ['customer_email' => 'online@example.com']);

        $this->assertSame('pending', $online->status);
        $this->assertSame('locked', $slot->fresh()->status);
        $this->assertSame('cancelled', $onsite->fresh()->status);
        Notification::assertSentOnDemand(OnsiteReservationCancelled::class, fn ($n, $c, $to) => $to->routes['mail'] === 'onsite@example.com');
    }

    public function test_only_one_onsite_reservation_per_slot(): void
    {
        $slot = $this->slot($this->studio());
        $this->reserve($slot);

        $this->postJson('/api/bookings', $this->bookingPayload($slot, ['payment_method' => 'onsite', 'customer_email' => 'b@example.com']))
            ->assertStatus(409)->assertJson(['code' => 'SLOT_RESERVED']);
    }

    public function test_admin_confirms_when_the_customer_pays_at_the_studio(): void
    {
        $studio = $this->studio();
        $day = $this->weekday(14);
        $slots = collect(['10:00', '10:30'])->map(fn ($t) => $this->slot($studio, $day, $t));
        $b = $this->reserve($slots[0], ['sessions' => 2]);

        $staff = $this->staff(['bookings']);
        $this->asUser($staff)->patchJson("/api/admin/bookings/{$b->id}/confirm")
            ->assertStatus(422)->assertJsonValidationErrors('cash_received');
        $this->asUser($staff)->patchJson("/api/admin/bookings/{$b->id}/confirm", ['cash_received' => 50000])
            ->assertStatus(422); // less than the Rp 100.000 bill
        $this->asUser($staff)->patchJson("/api/admin/bookings/{$b->id}/confirm", ['cash_received' => 150000])->assertOk();

        $this->assertSame(150000, $b->payment->fresh()->cash_received);
        $this->assertSame(50000, $b->payment->fresh()->cash_change);

        $this->assertSame('confirmed', $b->fresh()->status);
        $this->assertSame('paid', $b->payment->fresh()->status);
        $this->assertSame(['booked', 'booked'], $slots->map(fn ($s) => $s->fresh()->status)->all());
    }

    public function test_confirming_fails_if_someone_paid_online_first(): void
    {
        $slot = $this->slot($this->studio());
        $onsite = $this->reserve($slot);
        $onsite->update(['status' => 'onsite']); // pretend it survived (e.g. admin looks at a stale list)
        Slot::whereKey($slot->id)->update(['status' => 'booked']);

        $this->asUser($this->admin())->patchJson("/api/admin/bookings/{$onsite->id}/confirm", ['cash_received' => 50000])->assertStatus(409);
        $this->assertSame('onsite', $onsite->fresh()->status);
    }

    public function test_cancelling_an_onsite_reservation_leaves_the_slot_alone(): void
    {
        $slot = $this->slot($this->studio());
        $b = $this->reserve($slot);
        Slot::whereKey($slot->id)->update(['status' => 'blocked']); // admin blocked it meanwhile

        $this->asUser($this->admin())->patchJson("/api/admin/bookings/{$b->id}/cancel")->assertOk();

        $this->assertSame('cancelled', $b->fresh()->status);
        $this->assertSame('blocked', $slot->fresh()->status);
    }

    public function test_onsite_reservation_expires_after_its_session(): void
    {
        $b = $this->reserve($this->slot($this->studio()));
        $b->update(['expires_at' => now()->subMinute()]);

        $this->getJson("/api/bookings/{$b->id}/status")->assertJson(['status' => 'expired']);
    }

    public function test_reservation_can_be_upgraded_to_online_payment(): void
    {
        $slot = $this->slot($this->studio());
        $b = $this->reserve($slot, ['customer_email' => 'Up@Example.com']);

        $this->postJson('/api/bookings/pay-online', ['order_id' => $b->order_id, 'email' => 'up@example.com'])
            ->assertOk()->assertJsonStructure(['qr_string', 'expires_at']);

        $this->assertSame('pending', $b->fresh()->status);
        $this->assertSame('midtrans', $b->payment->fresh()->gateway);
        $this->assertSame('locked', $slot->fresh()->status);
        $this->postJson('/api/bookings/pay-online', ['order_id' => $b->order_id, 'email' => 'up@example.com'])->assertStatus(422);
    }

    public function test_failed_upgrade_keeps_the_reservation(): void
    {
        $slot = $this->slot($this->studio());
        $b = $this->reserve($slot);
        $this->midtransDown();

        $this->postJson('/api/bookings/pay-online', ['order_id' => $b->order_id, 'email' => 'budi@example.com'])->assertStatus(502);

        $this->assertSame('onsite', $b->fresh()->status);
        $this->assertSame('available', $slot->fresh()->status);
    }

    public function test_dashboard_lists_reservations_to_collect_soonest_first(): void
    {
        $studio = $this->studio();
        $later = $this->reserve($this->slot($studio, $this->weekday(20), '15:00'), ['customer_name' => 'Nanti']);
        $soon  = $this->reserve($this->slot($studio, $this->weekday(5), '10:00'), ['customer_name' => 'Duluan']);
        $this->book($this->slot($studio, $this->weekday(5), "12:00")); // online booking: not in the list

        $list = $this->asUser($this->admin())->getJson('/api/admin/dashboard')->assertOk()->json('onsite_bookings');

        $this->assertSame(['Duluan', 'Nanti'], array_column($list, 'customer_name'));
        $this->assertSame(50000, $list[0]['payment']['amount']);
    }
}
