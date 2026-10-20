<?php

namespace Tests;

use App\Models\{Booking, Slot, Studio, User};
use Carbon\Carbon;
use Database\Seeders\OperationalHourSeeder;
use Illuminate\Foundation\Testing\{RefreshDatabase, TestCase as BaseTestCase};
use Illuminate\Support\Facades\{Http, Queue};
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(OperationalHourSeeder::class); // Mon–Sat open, Sunday closed
        Queue::fake();
        $this->midtransUp();
    }

    // ── Payment gateway ────────────────────────────────────────────────────

    protected bool $gatewayUp = true;

    /** What a gateway status lookup (GET) returns; null = transaction not started yet (404). */
    protected ?array $gatewayStatus = null;

    /** One fake for the whole test; flip $gatewayUp / $gatewayStatus to change it (later fakes don't override). */
    protected function midtransUp(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $r) {
            if (! $this->gatewayUp) return Http::response(['error_messages' => ['Unauthorized']], 401);
            if ($r->method() === 'GET') {
                return $this->gatewayStatus === null
                    ? Http::response(['status_code' => '404', 'status_message' => "Transaction doesn't exist."], 404)
                    : Http::response($this->gatewayStatus, 200);
            }

            return Http::response(['token' => 'snap-token', 'invoice_url' => 'https://checkout-staging.xendit.co/web/inv-123'], 201);
        });
    }

    protected function midtransDown(): void
    {
        $this->gatewayUp = false;
    }

    /** POST a correctly signed Midtrans notification. */
    protected function notifyMidtrans(string $orderId, string $status, ?string $fraud = null): TestResponse
    {
        $payload = [
            'order_id'           => $orderId,
            'status_code'        => '200',
            'gross_amount'       => '50000.00',
            'transaction_id'     => 'trx-' . $orderId,
            'payment_type'       => 'qris',
            'transaction_status' => $status,
        ];
        if ($fraud) $payload['fraud_status'] = $fraud;
        $payload['signature_key'] = hash('sha512', $orderId . '200' . '50000.00' . config('services.midtrans.server_key'));

        return $this->postJson('/api/webhooks/payment/midtrans', $payload);
    }

    // ── Data ───────────────────────────────────────────────────────────────

    protected function studio(array $attrs = []): Studio
    {
        return Studio::create($attrs + [
            'name' => 'Studio Tes', 'slug' => 'studio-' . uniqid(), 'price' => 50000,
            'capacity' => 4, 'color' => '#7C3AED', 'is_active' => true,
        ]);
    }

    /** An open weekday $daysAhead days from now (Mon–Fri). */
    protected function weekday(int $daysAhead = 10): Carbon
    {
        $d = today()->addDays($daysAhead);
        while ($d->isWeekend()) $d->addDay();

        return $d;
    }

    protected function slot(Studio $studio, ?Carbon $date = null, string $start = '10:00', string $status = 'available'): Slot
    {
        $start = Carbon::parse($start);

        return Slot::create([
            'studio_id'  => $studio->id,
            'date'       => ($date ?? $this->weekday())->toDateString(),
            'start_time' => $start->format('H:i:s'),
            'end_time'   => $start->copy()->addMinutes(30)->format('H:i:s'),
            'status'     => $status,
        ]);
    }

    protected function bookingPayload(Slot $slot, array $extra = []): array
    {
        return $extra + [
            'studio_id'      => $slot->studio_id,
            'slot_id'        => $slot->id,
            'customer_name'  => 'Budi',
            'customer_email' => 'budi@example.com',
            'customer_phone' => '081234567890',
        ];
    }

    /** Book a slot through the public API and return the booking. */
    protected function book(Slot $slot, array $extra = []): Booking
    {
        $res = $this->postJson('/api/bookings', $this->bookingPayload($slot, $extra))->assertCreated();

        return Booking::findOrFail($res->json('booking_id'));
    }

    protected function admin(array $attrs = []): User
    {
        return User::create($attrs + ['name' => 'Admin', 'email' => uniqid() . '@admin.test', 'password' => 'password123', 'role' => 'admin']);
    }

    protected function staff(array $permissions = []): User
    {
        return User::create(['name' => 'Staff', 'email' => uniqid() . '@staff.test', 'password' => 'password123', 'role' => 'staff', 'permissions' => $permissions]);
    }

    /** Act with a real Sanctum bearer token (goes through every middleware). */
    protected function asUser(User $user): static
    {
        // The guard caches the first authenticated user for the whole test; real requests don't share it
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }
}
