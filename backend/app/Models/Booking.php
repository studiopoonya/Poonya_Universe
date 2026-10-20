<?php

namespace App\Models;

use App\Notifications\BookingConfirmed;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\{DB, Notification};

class Booking extends Model
{
    protected $fillable = [
        'user_id', 'studio_id', 'slot_id', 'promo_code_id', 'discount_amount', 'order_id', 'status',
        'customer_name', 'customer_email', 'customer_phone',
        'notes', 'expires_at', 'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
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

    public function slot()
    {
        return $this->belongsTo(Slot::class);
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
            $this->slot()->update(['status' => 'booked', 'locked_until' => null]);
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
            $this->releaseSlot();
        });
    }

    /**
     * Expire pending bookings past their payment window. The ExpireBooking job does
     * this too, but only when a queue worker runs — this is the safety net, called
     * whenever slots or booking status are read (and every minute by the scheduler).
     */
    public static function expireStale(): void
    {
        static::where('status', 'pending')->where('expires_at', '<', now())->pluck('id')
            ->each(fn ($id) => DB::transaction(function () use ($id) {
                $booking = static::whereKey($id)->where('status', 'pending')->lockForUpdate()->first();
                if (! $booking) return;

                $booking->update(['status' => 'expired']);
                $booking->releaseSlot();
            }));
    }

    /** Email the confirmation to the address entered at checkout (most customers are guests). */
    public function sendConfirmation(): void
    {
        Notification::route('mail', $this->customer_email)->notify(new BookingConfirmed($this));
    }

    /**
     * Free this booking's slot — unless another active booking has taken it since
     * (e.g. the lock lapsed and someone else booked before this one was expired).
     */
    public function releaseSlot(): void
    {
        $takenByOther = static::where('slot_id', $this->slot_id)
            ->where('id', '!=', $this->id)
            ->whereIn('status', ['pending', 'confirmed'])
            ->exists();

        if ($takenByOther) return;

        $this->slot()->update(['status' => 'available', 'locked_until' => null]);
    }
}
