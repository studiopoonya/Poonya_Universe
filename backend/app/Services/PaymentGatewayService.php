<?php

namespace App\Services;

use App\Models\{Booking, Setting};
use Illuminate\Support\Facades\Http;

/**
 * Online payments through the gateway chosen in admin Settings:
 *  - midtrans: Snap token, opened as a popup on the page
 *  - xendit:   Invoice, the customer is redirected to Xendit's hosted checkout
 * Secret keys live in .env only (services.midtrans / services.xendit).
 */
class PaymentGatewayService
{
    public const PROVIDERS = ['midtrans', 'xendit'];

    /** Minutes a customer has to pay; matches the booking's slot lock. */
    public const PAY_WITHIN_MINUTES = 15;

    public static function provider(): string
    {
        $p = Setting::get('payment_gateway');

        return in_array($p, self::PROVIDERS, true) ? $p : 'midtrans';
    }

    /**
     * @return array{provider: string, payment_token?: string, payment_url?: string}
     *
     * @throws \RuntimeException when the gateway rejects the request
     */
    public function createTransaction(Booking $booking): array
    {
        return self::provider() === 'xendit'
            ? ['provider' => 'xendit', 'payment_url' => $this->xenditInvoice($booking)]
            : ['provider' => 'midtrans', 'payment_token' => $this->midtransSnap($booking)];
    }

    private function finishUrl(Booking $booking): string
    {
        return config('app.frontend_url') . '/booking/success?order_id=' . $booking->order_id;
    }

    // ── Midtrans ───────────────────────────────────────────────────────────

    private function midtransSnap(Booking $booking): string
    {
        $response = Http::withBasicAuth(config('services.midtrans.server_key'), '')
            ->timeout(15)
            ->post(self::midtransIsProduction()
                ? 'https://app.midtrans.com/snap/v1/transactions'
                : 'https://app.sandbox.midtrans.com/snap/v1/transactions', [
                'transaction_details' => [
                    'order_id'     => $booking->order_id,
                    // What was quoted and stored for this booking (weekend price / promo applied)
                    'gross_amount' => $booking->payment->amount,
                ],
                'customer_details' => [
                    'first_name' => $booking->customer_name,
                    'email'      => $booking->customer_email,
                    'phone'      => $booking->customer_phone,
                ],
                'expiry'    => ['unit' => 'minutes', 'duration' => self::PAY_WITHIN_MINUTES],
                'callbacks' => ['finish' => $this->finishUrl($booking)],
            ]);

        throw_unless($response->successful(), new \RuntimeException('Midtrans error: ' . $response->body()));

        return $response->json('token');
    }

    /** Sandbox/Production toggle from admin Settings, falling back to .env. */
    public static function midtransIsProduction(): bool
    {
        return filter_var(Setting::get('midtrans_is_production') ?? config('services.midtrans.is_production'), FILTER_VALIDATE_BOOLEAN);
    }

    /** snap.js for the chosen environment — derived, so it can't disagree with the API URL. */
    public static function midtransSnapJs(): string
    {
        return self::midtransIsProduction()
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js';
    }

    // ── Xendit ─────────────────────────────────────────────────────────────

    /** Creates a Xendit Invoice and returns its hosted checkout URL. */
    private function xenditInvoice(Booking $booking): string
    {
        $booking->loadMissing(['studio', 'slot']);

        $response = Http::withBasicAuth((string) config('services.xendit.secret_key'), '')
            ->timeout(15)
            ->post('https://api.xendit.co/v2/invoices', [
                'external_id'          => $booking->order_id,
                'amount'               => $booking->payment->amount,
                'currency'             => 'IDR',
                'description'          => "Booking {$booking->studio?->name} — {$booking->slot?->date} {$booking->timeRange()} WIB",
                'invoice_duration'     => self::PAY_WITHIN_MINUTES * 60,
                'payer_email'          => $booking->customer_email,
                'customer'             => [
                    'given_names'   => $booking->customer_name,
                    'email'         => $booking->customer_email,
                    'mobile_number' => $booking->customer_phone,
                ],
                'success_redirect_url' => $this->finishUrl($booking),
                'failure_redirect_url' => $this->finishUrl($booking),
            ]);

        throw_unless($response->successful(), new \RuntimeException('Xendit error: ' . $response->body()));

        return $response->json('invoice_url');
    }

    /** What kind of Xendit secret key is configured (test keys start with xnd_development_). */
    public static function xenditKeyStatus(): string
    {
        $key = (string) config('services.xendit.secret_key');

        return match (true) {
            $key === ''                           => 'missing',
            str_starts_with($key, 'xnd_development_') => 'test',
            str_starts_with($key, 'xnd_production_')  => 'live',
            default                               => 'invalid',
        };
    }
}
