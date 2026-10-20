<?php

namespace Tests\Feature;

use App\Models\{Booking, PromoCode, Slot};
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MultiSessionTest extends TestCase
{
    /** Four back-to-back slots 10:00–12:00 on one weekday. */
    private function run4(array $studioAttrs = []): array
    {
        $studio = $this->studio($studioAttrs);
        $day = $this->weekday(14);

        return [$studio, collect(['10:00', '10:30', '11:00', '11:30'])->map(fn ($t) => $this->slot($studio, $day, $t))];
    }

    public function test_two_sessions_hold_two_consecutive_slots_and_cost_double(): void
    {
        [, $slots] = $this->run4();

        $b = $this->book($slots[0], ['sessions' => 2]);

        $this->assertSame(2, $b->sessions);
        $this->assertSame(100000, $b->payment->amount);
        $this->assertSame('11:00', $b->end_time);
        $this->assertSame(['locked', 'locked', 'available'], $slots->take(3)->map(fn ($s) => $s->fresh()->status)->all());
        Http::assertSent(fn ($r) => $r['transaction_details']['gross_amount'] === 100000);
    }

    public function test_quote_multiplies_and_promo_applies_to_the_total(): void
    {
        [$studio, $slots] = $this->run4();
        PromoCode::create(['code' => 'HEMAT', 'type' => 'percent', 'value' => 10, 'is_active' => true]);

        $this->getJson("/api/quote?studio_id={$studio->id}&slot_id={$slots[0]->id}&sessions=3&promo_code=HEMAT")
            ->assertJson(['per_session' => 50000, 'sessions' => 3, 'base_price' => 150000, 'discount' => 15000, 'total' => 135000]);
    }

    public function test_range_must_be_free_and_inside_opening_hours(): void
    {
        [$studio, $slots] = $this->run4();
        $this->book($slots[1]); // 10:30 taken

        $this->postJson('/api/bookings', $this->bookingPayload($slots[0], ['sessions' => 2]))->assertStatus(409);
        $this->assertSame('available', $slots[0]->fresh()->status, 'nothing locked on failure');

        // 11:30 + 2 sessions would run past the last slot
        $this->postJson('/api/bookings', $this->bookingPayload($slots[3], ['sessions' => 2]))
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'jam tutup'));
        $this->postJson('/api/bookings', $this->bookingPayload($slots[0], ['sessions' => 5]))->assertStatus(422);
    }

    public function test_payment_books_and_expiry_releases_every_slot(): void
    {
        [, $slots] = $this->run4();
        $paid = $this->book($slots[0], ['sessions' => 2]);
        $this->notifyMidtrans($paid->order_id, 'settlement');
        $this->assertSame(['booked', 'booked'], $slots->take(2)->map(fn ($s) => $s->fresh()->status)->all());

        $unpaid = $this->book($slots[2], ['sessions' => 2]);
        $this->notifyMidtrans($unpaid->order_id, 'expire');
        $this->assertSame(['available', 'available'], $slots->slice(2)->map(fn ($s) => $s->fresh()->status)->values()->all());
    }

    public function test_reschedule_moves_the_whole_run_and_may_overlap_itself(): void
    {
        [, $slots] = $this->run4();
        $b = $this->book($slots[0], ['sessions' => 2, 'customer_email' => 'r@example.com']);
        $this->notifyMidtrans($b->order_id, 'settlement');

        // 10:00–11:00 → 10:30–11:30 (shares the 10:30 slot)
        $this->postJson('/api/bookings/reschedule', ['order_id' => $b->order_id, 'email' => 'r@example.com', 'slot_id' => $slots[1]->id])
            ->assertOk()->assertJson(['start_time' => '10:30', 'end_time' => '11:30', 'sessions' => 2]);

        $this->assertSame(['available', 'booked', 'booked', 'available'], $slots->map(fn ($s) => $s->fresh()->status)->all());
    }

    public function test_walk_in_supports_sessions(): void
    {
        [, $slots] = $this->run4(['price' => 40000]);

        $this->asUser($this->staff(['payment']))
            ->postJson('/api/admin/bookings', $this->bookingPayload($slots[0], ['payment_method' => 'cash', 'sessions' => 3]))
            ->assertCreated();

        $this->assertSame(120000, Booking::first()->payment->amount);
        $this->assertSame(['booked', 'booked', 'booked', 'available'], $slots->map(fn ($s) => $s->fresh()->status)->all());
    }

    public function test_admin_slot_grid_shows_the_customer_on_every_held_slot(): void
    {
        [$studio, $slots] = $this->run4();
        $this->book($slots[0], ['sessions' => 2, 'customer_name' => 'Dewi']);

        $grid = $this->asUser($this->admin())->getJson("/api/admin/schedule/slots?studio_id={$studio->id}&date={$slots[0]->date}")->json();
        $byTime = collect($grid)->keyBy('start_time');

        $this->assertSame('Dewi', $byTime['10:00']['customer']);
        $this->assertSame('Dewi', $byTime['10:30']['customer']);
        $this->assertNull($byTime['11:00']['customer']);
    }
}
