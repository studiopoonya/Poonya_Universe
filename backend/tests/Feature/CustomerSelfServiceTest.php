<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Notifications\BookingConfirmed;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CustomerSelfServiceTest extends TestCase
{
    private function confirmed(\App\Models\Slot $slot): Booking
    {
        $b = $this->book($slot, ['customer_email' => 'Rina@Example.com']);
        $this->notifyMidtrans($b->order_id, 'settlement');

        return $b->fresh();
    }

    public function test_lookup_needs_order_id_and_matching_email(): void
    {
        $b = $this->confirmed($this->slot($this->studio()));

        $this->postJson('/api/bookings/lookup', ['order_id' => strtolower($b->order_id), 'email' => 'rina@example.COM'])
            ->assertOk()->assertJson(['status' => 'confirmed', 'reschedule_error' => null]);
        $this->postJson('/api/bookings/lookup', ['order_id' => $b->order_id, 'email' => 'other@example.com'])->assertNotFound();
    }

    public function test_reschedule_once_to_a_free_slot_with_the_same_price(): void
    {
        Notification::fake();
        $studio = $this->studio(['weekend_price' => 90000]);
        $old = $this->slot($studio);
        $new = $this->slot($studio, $this->weekday(11)->addDay(), '15:00');
        $b = $this->confirmed($old);
        $creds = ['order_id' => $b->order_id, 'email' => 'rina@example.com'];

        $this->postJson('/api/bookings/reschedule', $creds + ['slot_id' => $new->id])->assertOk()->assertJson(['rescheduled' => true]);

        $this->assertSame($new->id, $b->fresh()->slot_id);
        $this->assertSame('booked', $new->fresh()->status);
        $this->assertSame('available', $old->fresh()->status);
        Notification::assertSentOnDemand(BookingConfirmed::class);

        $this->postJson('/api/bookings/reschedule', $creds + ['slot_id' => $old->id])
            ->assertStatus(422)->assertJsonPath('message', 'Jadwal booking ini sudah pernah diubah.');
    }

    public function test_reschedule_rules(): void
    {
        $studio = $this->studio(['weekend_price' => 90000]);
        $b = $this->confirmed($this->slot($studio));
        $creds = ['order_id' => $b->order_id, 'email' => 'rina@example.com'];
        $sat = today()->addDays(5);
        while (! $sat->isSaturday()) $sat->addDay();

        $this->postJson('/api/bookings/reschedule', $creds + ['slot_id' => $this->slot($studio, $sat)->id])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Harga'));
        $this->postJson('/api/bookings/reschedule', $creds + ['slot_id' => $this->slot($this->studio())->id])
            ->assertStatus(422)->assertJsonPath('message', 'Ubah jadwal hanya bisa di studio yang sama.');
        $this->postJson('/api/bookings/reschedule', $creds + ['slot_id' => $this->slot($studio, null, '16:00', 'blocked')->id])
            ->assertStatus(409);
    }

    public function test_no_reschedule_within_24_hours(): void
    {
        $soon = now()->addHours(3);
        $b = $this->confirmed($this->slot($this->studio(), $soon->copy()->startOfDay(), $soon->format('H:00')));

        $this->postJson('/api/bookings/lookup', ['order_id' => $b->order_id, 'email' => 'rina@example.com'])
            ->assertJsonPath('reschedule_error', 'Ubah jadwal hanya bisa paling lambat 24 jam sebelum sesi.');
    }
}
