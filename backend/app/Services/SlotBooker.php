<?php

namespace App\Services;

use App\Models\{Booking, Slot};
use App\Notifications\OnsiteReservationCancelled;
use Illuminate\Database\Eloquent\{Collection, ModelNotFoundException};
use Illuminate\Support\Facades\{DB, Notification};

/**
 * Takes a run of consecutive slots for one booking (1 session = 1 slot of 30 min).
 * Call inside a DB transaction: rows are locked FOR UPDATE.
 */
class SlotBooker
{
    /**
     * The run of `$sessions` slots starting at `$startSlotId`, checked to be free,
     * back to back and inside opening hours. Locks the rows but changes nothing.
     *
     * @return Collection<int, Slot>  the slots, in time order
     *
     * @throws ModelNotFoundException  a slot in the range is taken (→ 409)
     */
    public static function run(int $studioId, int $startSlotId, int $sessions, bool $allowStarted = false): Collection
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

        return $slots;
    }

    /**
     * Take the run: mark it 'locked' (awaiting payment) or 'booked' (paid).
     * Pending bookings whose lock lapsed and pay-at-studio reservations on these
     * slots lose them — the reservation holders are emailed.
     *
     * @param  int|null  $exceptBookingId  a booking taking its own reserved slots (onsite → paid)
     */
    public static function take(int $studioId, int $startSlotId, int $sessions, string $status, ?int $lockMinutes = null, bool $allowStarted = false, ?int $exceptBookingId = null): Collection
    {
        $slots = self::run($studioId, $startSlotId, $sessions, $allowStarted);
        $ids   = $slots->pluck('id')->all();

        Slot::whereIn('id', $ids)->update([
            'status'       => $status,
            'locked_until' => $lockMinutes ? now()->addMinutes($lockMinutes) : null,
        ]);

        $holding = fn () => Booking::where(fn ($q) => $q->whereIn('slot_id', $ids)
                ->orWhereIn('id', DB::table('booking_slot')->whereIn('slot_id', $ids)->select('booking_id')))
            ->when($exceptBookingId, fn ($q) => $q->whereKeyNot($exceptBookingId));

        // A pending booking still holding one of these slots let its lock lapse — retire it
        $holding()->where('status', 'pending')->update(['status' => 'expired']);

        // Pay-at-studio reservations never held the slot: whoever pays first gets it
        $holding()->where('status', 'onsite')->get()->each(function (Booking $b) {
            $b->update(['status' => 'cancelled']);
            Notification::route('mail', $b->customer_email)->notify(new OnsiteReservationCancelled($b));
        });

        return $slots;
    }

    /** Active pay-at-studio reservation on any of these slots (only one is allowed per slot). */
    public static function hasOnsiteReservation(Collection $slots, ?int $exceptBookingId = null): bool
    {
        return Booking::where('status', 'onsite')
            ->whereIn('id', DB::table('booking_slot')->whereIn('slot_id', $slots->pluck('id'))->select('booking_id'))
            ->when($exceptBookingId, fn ($q) => $q->whereKeyNot($exceptBookingId))
            ->exists();
    }

    /** Record which slots a booking holds (first one also goes in bookings.slot_id). */
    public static function attach(Booking $booking, Collection $slots): void
    {
        DB::table('booking_slot')->where('booking_id', $booking->id)->delete();
        DB::table('booking_slot')->insert($slots->map(fn (Slot $s) => ['booking_id' => $booking->id, 'slot_id' => $s->id])->all());
    }
}
