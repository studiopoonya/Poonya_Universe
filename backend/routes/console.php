<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Safety net for unpaid bookings when no queue worker is running (needs `schedule:run` in cron)
Schedule::call(fn () => \App\Models\Booking::expireStale())->everyMinute()->name('expire-stale-bookings');

// Keep a month of slots ready ahead (slots are also created on demand when a day is opened)
Schedule::command('slots:generate 30')->dailyAt('00:10')->name('generate-slots');

// Clean out expired admin login tokens
Schedule::command('sanctum:prune-expired --hours=24')->daily()->name('prune-tokens');
