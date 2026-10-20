<?php

namespace App\Services;

use App\Models\{Booking, Slot};
use Illuminate\Database\Eloquent\{Collection, ModelNotFoundException};
use Illuminate\Support\Facades\DB;

/**
 * Takes a run of consecutive slots for one booking (1 session = 1 slot of 30 min).
 * Call inside a DB transaction: rows are locked FOR UPDATE.
 */
class SlotBooker
{
    /**
     * @param  string  $status  'locked' while waiting for payment, 'booked' when already paid
     * @return Collection<int, Slot>  the slots, in time order
     *
     * @throws ModelNotFoundException  a slot in the range was just taken (→ 409)
     */
    public static function take(int $studioId, int $startSlotId, int $sessions, string $status, ?int $lockMinutes = null, bool $allowStarted = false): Collection
    {
        $start = Slot::whereKey($startSlotId)->lockForUpdate()->firstOrFail();

        abort_if($start->studio_id !== $studioId, 422, 'Slot bukan milik studio ini.');
        abort_if(! $allowStarted && $start->hasStarted(), 422, 'Jam slot ini sudah lewat. Silakan pilih waktu lain.');

        $slots = Slot::where('studio_id', $studioId)
            ->where('date', $start->date)
            ->where('start_time', '>=', $start->start_time)
            ->orderBy('start_time')
            ->limit($sessions)
            ->lockForUpdate()
            ->get();

        // Must be back-to-back: each slot starts when the previous one ends
        $consecutive = $slots->count() === $sessions
            && $slots->every(fn (Slot $s, int $i) => $i === 0 || $s->start_time === $slots[$i - 1]->end_time);
        abort_unless($consecutive, 422, 'Durasi ini melewati jam tutup studio. Pilih jam mulai yang lebih awal atau durasi lebih pendek.');

        if ($slots->contains(fn (Slot $s) => $s->status !== 'available')) {
            throw (new ModelNotFoundException)->setModel(Slot::class);
        }

        $ids = $slots->pluck('id')->all();
        Slot::whereIn('id', $ids)->update([
            'status'       => $status,
            'locked_until' => $lockMinutes ? now()->addMinutes($lockMinutes) : null,
        ]);

        // Any pending booking still holding one of these slots let its lock lapse — retire it
        Booking::where('status', 'pending')
            ->where(fn ($q) => $q->whereIn('slot_id', $ids)
                ->orWhereIn('id', DB::table('booking_slot')->whereIn('slot_id', $ids)->select('booking_id')))
            ->update(['status' => 'expired']);

        return $slots;
    }

    /** Record which slots a booking holds (first one also goes in bookings.slot_id). */
    public static function attach(Booking $booking, Collection $slots): void
    {
        DB::table('booking_slot')->where('booking_id', $booking->id)->delete();
        DB::table('booking_slot')->insert($slots->map(fn (Slot $s) => ['booking_id' => $booking->id, 'slot_id' => $s->id])->all());
    }
}
