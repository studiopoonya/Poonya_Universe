<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Sender email set by the admin overrides .env — per request, and per queued job
        // so a running queue worker sees changes immediately
        \App\Services\MailSettings::apply();
        \Illuminate\Support\Facades\Queue::before(fn () => \App\Services\MailSettings::apply());

        // Behind Nginx/Cloudflare every request comes from the proxy's IP; trusting it makes
        // $request->ip() the real visitor, so the per-IP limits below stay per visitor
        if ($proxies = config('app.trusted_proxies')) {
            TrustProxies::at($proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));
        }

        // Each booking locks a slot for 15 minutes, so cap how many one visitor can start
        RateLimiter::for('bookings', fn (Request $request) => [
            Limit::perMinute(5)->by($request->ip()),
            Limit::perHour(20)->by($request->ip()),
        ]);

        // Slow down password guessing: per account+IP, and per IP across accounts
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')) . '|' . $request->ip()),
            Limit::perMinute(20)->by($request->ip()),
        ]);
    }
}
