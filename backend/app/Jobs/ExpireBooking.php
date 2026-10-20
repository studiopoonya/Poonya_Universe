<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ExpireBooking implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(private \App\Models\Booking $booking) {}

    public function handle(): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () {
            $booking = \App\Models\Booking::where('id', $this->booking->id)
                          ->where('status', 'pending')
                          ->lockForUpdate()
                          ->first();

            if (! $booking) return;

            $booking->update(['status' => 'expired']);
            $booking->releaseSlot();
        });
    }
}
