<?php

namespace App\Services;

use App\Models\{OperationalHour, Slot, Studio};
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Creates a studio's time slots for a day from the operational hours.
 * Idempotent: existing slots (and their status) are never touched.
 */
class SlotGenerator
{
    public const SLOT_MINUTES = 30;

    /** How far ahead customers can book; slots beyond this are not created on demand. */
    public const HORIZON_DAYS = 90;

    /** @return int number of slots created */
    public static function forDay(Studio $studio, Carbon $date, ?Collection $opHours = null): int
    {
        $opHours ??= OperationalHour::where('is_open', true)->get()->keyBy('weekday');
        $opHour    = $opHours->get($date->dayOfWeek);

        if (! $opHour || ! $studio->is_active) return 0;

        $day     = $date->toDateString();
        $current = Carbon::parse("$day {$opHour->open_time}");
        $closeAt = Carbon::parse("$day {$opHour->close_time}");
        $now     = now();
        $rows    = [];

        while ($current->copy()->addMinutes(self::SLOT_MINUTES)->lte($closeAt)) {
            $rows[] = [
                'studio_id'  => $studio->id,
                'date'       => $day,
                'start_time' => $current->toTimeString(),
                'end_time'   => $current->copy()->addMinutes(self::SLOT_MINUTES)->toTimeString(),
                'status'     => 'available',
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $current->addMinutes(self::SLOT_MINUTES);
        }

        // Unique (studio_id, date, start_time) makes this safe to run concurrently / repeatedly
        return Slot::insertOrIgnore($rows);
    }

    /** Make sure the next $days days have slots for every active studio. */
    public static function ahead(int $days): int
    {
        $opHours = OperationalHour::where('is_open', true)->get()->keyBy('weekday');
        $created = 0;

        foreach (Studio::where('is_active', true)->get() as $studio) {
            for ($i = 0; $i < $days; $i++) {
                $created += self::forDay($studio, Carbon::today()->addDays($i), $opHours);
            }
        }

        return $created;
    }
}
