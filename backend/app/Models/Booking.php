<?php

namespace App\Models;

use App\Notifications\BookingConfirmed;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\{DB, Notification};

class Booking extends Model
{
    protected $fillable = [
        'user_id', 'studio_id', 'slot_id', 'sessions', 'promo_code_id', 'discount_amount', 'reschedule_count', 'order_id', 'status',
        'customer_name', 'customer_email', 'customer_phone',
        'notes', 'expires_at', 'confirmed_at',
    ];

    /** Max consecutive 30-minute sessions in one booking (4 = 2 hours). */
    public const MAX_SESSIONS = 4;

    protected $appends = ['end_time'];

    protected function casts(): array
    {
        return [
            'sessions'     => 'integer',
            'expires_at'   => 'datetime',
            'confirmed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function studio()
    {
        return $this->belongsTo(Studio::class);
    }

    /** First slot of the booking (date + start time). */
    public function slot()
    {
        return $this->belongsTo(Slot::class);
    }

    /** Every slot this booking holds — consecutive, same studio and day. */
    public function slots()
    {
        return $this->belongsToMany(Slot::class, 'booking_slot')->orderBy('start_time');
    }

    /** End of the last session, "HH:MM" — slots are consecutive, so first start + n × 30 min. */
    public function getEndTimeAttribute(): ?string
    {
        if (! $this->slot) return null;

        return \Carbon\Carbon::parse($this->slot->start_time)
            ->addMinutes(\App\Services\SlotGenerator::SLOT_MINUTES * max(1, (int) $this->sessions))
            ->format('H:i');
    }

    public function timeRange(): string
    {
        return substr($this->slot->start_time, 0, 5) . ' – ' . $this->end_time;
    }

    private function slotIds(): array
    {
        $ids = DB::table('booking_slot')->where('booking_id', $this->id)->pluck('slot_id')->all();

        return $ids ?: array_filter([$this->slot_id]);
    }

    /** Mark every held slot as booked (payment done). */
    public function bookSlots(): void
    {
        Slot::whereIn('id', $this->slotIds())->update(['status' => 'booked', 'locked_until' => null]);
    }

    public function payment()
    {
        return $this->hasOne(Payment::class);
    }

    public function promoCode()
    {
        return $this->belongsTo(PromoCode::class);
    }

    /** Nothing left to pay (100% promo): confirm without a payment gateway. */
    public function confirmFree(): void
    {
        DB::transaction(function () {
            $this->update(['status' => 'confirmed', 'confirmed_at' => now()]);
            $this->bookSlots();
            $this->payment()->update(['gateway' => 'cash', 'method' => 'promo', 'status' => 'paid', 'paid_at' => now()]);
            $this->sendConfirmation();
        });
    }

    /** The payment gateway couldn't start a transaction — undo the booking so the slot frees up at once. */
    public function cancelUnpaid(): void
    {
        DB::transaction(function () {
            $this->update(['status' => 'cancelled']);
            $this->payment()->update(['status' => 'failed']);
            $this->releaseSlots();
        });
    }

    /**
     * Expire pending bookings past their payment window. The ExpireBooking job does
     * this too, but only when a queue worker runs — this is the safety net, called
     * whenever slots or booking status are read (and every minute by the scheduler).
     */
    public static function expireStale(): void
    {
        static::where('status', 'onsite')->where('expires_at', '<', now())->update(['status' => 'expired']);

        static::where('status', 'pending')->where('expires_at', '<', now())->pluck('id')
            ->each(fn ($id) => DB::transaction(function () use ($id) {
                $booking = static::whereKey($id)->where('status', 'pending')->lockForUpdate()->first();
                if (! $booking) return;

                $booking->update(['status' => 'expired']);
                $booking->releaseSlots();
            }));
    }

    /** Email the confirmation to the address entered at checkout (most customers are guests). */
    /** @param  string  $kind  confirmed | rescheduled | onsite */
    public function sendConfirmation(string $kind = 'confirmed'): void
    {
        Notification::route('mail', $this->customer_email)->notify(new BookingConfirmed($this, $kind));
    }

    public const RESCHEDULE_MIN_HOURS = 24;
    public const RESCHEDULE_MAX       = 1;

    /** Why this booking can't be moved right now, or null when it can. */
    public function rescheduleBlockedReason(): ?string
    {
        $start = \Carbon\Carbon::parse($this->slot->date . ' ' . $this->slot->start_time);

        return match (true) {
            $this->status !== 'confirmed'                  => 'Hanya booking yang sudah dikonfirmasi yang bisa diubah jadwalnya.',
            $this->reschedule_count >= self::RESCHEDULE_MAX => 'Jadwal booking ini sudah pernah diubah.',
            now()->addHours(self::RESCHEDULE_MIN_HOURS)->gte($start) => 'Ubah jadwal hanya bisa paling lambat 24 jam sebelum sesi.',
            default                                        => null,
        };
    }

    /**
     * Free this booking's slots — except any another active booking has taken since
     * (e.g. the lock lapsed and someone else booked before this one was expired).
     */
    public function releaseSlots(): void
    {
        $ids = $this->slotIds();

        $takenByOthers = DB::table('booking_slot')
            ->join('bookings', 'bookings.id', '=', 'booking_slot.booking_id')
            ->whereIn('booking_slot.slot_id', $ids)
            ->where('bookings.id', '!=', $this->id)
            ->whereIn('bookings.status', ['pending', 'confirmed'])
            ->pluck('booking_slot.slot_id')
            ->all();

        Slot::whereIn('id', array_diff($ids, $takenByOthers))->update(['status' => 'available', 'locked_until' => null]);
    }
}
