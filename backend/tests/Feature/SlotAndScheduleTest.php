<?php

namespace Tests\Feature;

use App\Models\{OperationalHour, Slot};
use App\Services\SlotGenerator;
use Tests\TestCase;

class SlotAndScheduleTest extends TestCase
{
    public function test_slots_are_created_on_demand_from_operational_hours(): void
    {
        $studio = $this->studio();
        $day = $this->weekday(20)->toDateString();

        $res = $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$day}")->assertOk();

        $this->assertCount(24, $res->json()); // 09:00–21:00 in 30 min
        $this->assertSame('09:00', $res->json('0.start_time'));
        $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$day}");
        $this->assertSame(24, Slot::where('date', $day)->count(), 'no duplicates on repeat');
    }

    public function test_closed_day_and_beyond_horizon_have_no_slots(): void
    {
        $studio = $this->studio();
        $sunday = today()->addDays(7);
        while (! $sunday->isSunday()) $sunday->addDay();

        $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$sunday->toDateString()}")->assertExactJson([]);
        $far = today()->addDays(SlotGenerator::HORIZON_DAYS + 5)->toDateString();
        $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$far}")->assertExactJson([]);
    }

    public function test_started_slots_today_are_unavailable(): void
    {
        if (now()->hour < 1) $this->markTestSkipped('Needs an hour that already passed today.');
        $studio = $this->studio();
        $past = $this->slot($studio, today(), now()->subHour()->format('H:00'));

        $row = collect($this->getJson("/api/slots/available?studio_id={$studio->id}&date=" . today()->toDateString())->json())
            ->firstWhere('id', $past->id);
        $this->assertFalse($row['is_available']);
    }

    public function test_generate_command_fills_ahead_idempotently(): void
    {
        $this->studio();
        $this->artisan('slots:generate', ['days' => 7])->assertSuccessful();
        $count = Slot::count();

        $this->assertGreaterThan(0, $count);
        $this->artisan('slots:generate', ['days' => 7])->assertSuccessful();
        $this->assertSame($count, Slot::count());
    }

    public function test_changing_hours_rebuilds_future_days_and_keeps_booked_slots(): void
    {
        $studio = $this->studio();
        $day = $this->weekday(15);
        $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$day->toDateString()}");
        $held = Slot::where('date', $day->toDateString())->orderBy('start_time')->first();
        $this->book($held);

        $hours = OperationalHour::orderBy('weekday')->get()->map(fn ($h) => [
            'weekday' => $h->weekday, 'is_open' => (bool) $h->is_open,
            'open_time' => $h->weekday === $day->dayOfWeek ? '12:00' : substr($h->open_time, 0, 5),
            'close_time' => $h->weekday === $day->dayOfWeek ? '14:00' : substr($h->close_time, 0, 5),
        ])->all();

        $this->asUser($this->admin())->putJson('/api/admin/schedule/hours', ['hours' => $hours])->assertOk();

        $times = collect($this->getJson("/api/slots/available?studio_id={$studio->id}&date={$day->toDateString()}")->json())->pluck('start_time')->all();
        $this->assertSame(['09:00', '12:00', '12:30', '13:00', '13:30'], $times);
    }

    public function test_close_time_must_be_after_open_time(): void
    {
        $hours = collect(range(0, 6))->map(fn ($d) => ['weekday' => $d, 'is_open' => true, 'open_time' => '10:00', 'close_time' => '09:00'])->all();

        $this->asUser($this->admin())->putJson('/api/admin/schedule/hours', ['hours' => $hours])->assertStatus(422);
    }

    public function test_holiday_removes_free_slots_and_reopening_restores_them(): void
    {
        $studio = $this->studio();
        $day = $this->weekday(12)->toDateString();
        $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$day}");
        $admin = $this->admin();

        $id = $this->asUser($admin)->postJson('/api/admin/schedule/closed-dates', ['date' => $day, 'reason' => 'Libur'])
            ->assertCreated()->json('closed_date.id');
        $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$day}")->assertExactJson([]);

        $this->asUser($admin)->deleteJson("/api/admin/schedule/closed-dates/{$id}")->assertOk();
        $this->assertCount(24, $this->getJson("/api/slots/available?studio_id={$studio->id}&date={$day}")->json());
    }

    public function test_holiday_warns_about_active_bookings(): void
    {
        $slot = $this->slot($this->studio());
        $this->book($slot);

        $this->asUser($this->admin())->postJson('/api/admin/schedule/closed-dates', ['date' => $slot->date])
            ->assertCreated()->assertJsonPath('message', fn ($m) => str_contains($m, '1 booking aktif'));
    }

    public function test_slot_block_rules(): void
    {
        $studio = $this->studio();
        $admin = $this->admin();
        $free = $this->slot($studio);
        $paying = $this->slot($studio, null, '11:00', 'locked');

        $this->asUser($admin)->patchJson("/api/admin/slots/{$free->id}/block")->assertOk();
        $this->assertSame('blocked', $free->fresh()->status);
        $this->asUser($admin)->patchJson("/api/admin/slots/{$paying->id}/block")->assertStatus(422);
        $this->asUser($admin)->patchJson("/api/admin/slots/{$free->id}/unblock")->assertOk();
        $this->assertSame('available', $free->fresh()->status);
    }
}
