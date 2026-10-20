<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Notifications\BookingReminder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class SendBookingReminders extends Command
{
    protected $signature = 'bookings:remind';

    protected $description = "Email customers whose session is tomorrow (once per booking)";

    public function handle(): int
    {
        $sent = 0;

        Booking::whereIn('status', ['confirmed', 'onsite'])
            ->whereNull('reminded_at')
            ->whereHas('slot', fn ($q) => $q->whereDate('date', today()->addDay()))
            ->each(function (Booking $b) use (&$sent) {
                Notification::route('mail', $b->customer_email)->notify(new BookingReminder($b));
                $b->update(['reminded_at' => now()]);
                $sent++;
            });

        $this->info("Pengingat terkirim: {$sent}");

        return self::SUCCESS;
    }
}
