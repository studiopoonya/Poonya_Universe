<?php

namespace App\Services;

use App\Models\{Booking, Setting};
use Illuminate\Support\Facades\Http;

/**
 * Online payments through the gateway chosen in admin Settings:
 *  - midtrans: a QRIS charge (Core API) — we draw the QR on our own page; falls back
 *              to a Snap popup token if QRIS isn't available on the account
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
        $booking->loadMissing(['studio', 'slot', 'payment']);

        return $this->charge(
            orderId:     $booking->order_id,
            amount:      $booking->payment->amount, // quoted & stored (weekend price / promo applied)
            name:        $booking->customer_name,
            email:       $booking->customer_email,
            phone:       $booking->customer_phone,
            description: "Booking {$booking->studio?->name} — {$booking->slot?->date} {$booking->timeRange()} WIB",
            finishUrl:   config('app.frontend_url') . '/booking/success?order_id=' . $booking->order_id,
        );
    }

    /**
     * Start a payment with the active gateway (bookings and admin test charges).
     *
     * @return array{provider: string, qr_string?: string, expires_at?: string, payment_token?: string, payment_url?: string}
     */
    public function charge(string $orderId, int $amount, string $name, string $email, ?string $phone, string $description, string $finishUrl): array
    {
        if (self::provider() === 'xendit') {
            return ['provider' => 'xendit', 'payment_url' => $this->xenditInvoice($orderId, $amount, $name, $email, $phone, $description, $finishUrl)];
        }

        try {
            return ['provider' => 'midtrans', ...$this->midtransQris($orderId, $amount, $name, $email, $phone)];
        } catch (QrisUnavailable $e) {
            // e.g. QRIS not enabled for Core API on this merchant — the Snap popup still works
            report($e);

            return ['provider' => 'midtrans', 'payment_token' => $this->midtransSnap($orderId, $amount, $name, $email, $phone, $finishUrl)];
        }
    }

    /**
     * Ask the gateway directly how a payment stands — works without webhooks
     * (e.g. on a laptop the gateway can't reach).
     *
     * @return array{outcome: string, method: ?string, payload: array}  outcome: paid | failed | pending
     */
    public function fetchStatus(string $provider, string $orderId): array
    {
        if ($provider === 'xendit') {
            $res = Http::withBasicAuth((string) config('services.xendit.secret_key'), '')->timeout(10)
                ->get('https://api.xendit.co/v2/invoices', ['external_id' => $orderId]);
            $inv = $res->successful() ? ($res->json()[0] ?? null) : null;

            return [
                'outcome' => $inv ? self::xenditOutcome((string) $inv['status']) : 'pending',
                'method'  => isset($inv['payment_method']) ? strtolower($inv['payment_method']) : null,
                'payload' => $inv ?? [],
            ];
        }

        $res  = Http::withBasicAuth((string) config('services.midtrans.server_key'), '')->timeout(10)
            ->get(self::midtransApiBase() . "/v2/{$orderId}/status");
        $body = $res->json() ?? [];

        // 404 = the customer hasn't picked a payment method in Snap yet
        return [
            'outcome' => isset($body['transaction_status'])
                ? self::midtransOutcome((string) $body['transaction_status'], $body['fraud_status'] ?? null)
                : 'pending',
            'method'  => $body['payment_type'] ?? null,
            'payload' => $body,
        ];
    }

    // ── Midtrans ───────────────────────────────────────────────────────────

    private static function midtransApiBase(): string
    {
        return self::midtransIsProduction() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
    }

    /**
     * QRIS charge via Core API: returns the QR payload to draw ourselves, so the
     * customer sees the code straight away instead of Snap's method list.
     * https://docs.midtrans.com/reference/qris
     *
     * @return array{qr_string: string, expires_at: string}
     */
    private function midtransQris(string $orderId, int $amount, string $name, string $email, ?string $phone): array
    {
        $response = Http::withBasicAuth(config('services.midtrans.server_key'), '')
            ->timeout(15)
            ->withHeaders(self::midtransNotifyHeaders())
            ->post(self::midtransApiBase() . '/v2/charge', [
                'payment_type'        => 'qris',
                'transaction_details' => ['order_id' => $orderId, 'gross_amount' => $amount],
                'customer_details'    => array_filter(['first_name' => $name, 'email' => $email, 'phone' => $phone]),
                'qris'                => ['acquirer' => 'gopay'],
                'custom_expiry'       => ['expiry_duration' => self::PAY_WITHIN_MINUTES, 'unit' => 'minute'],
            ]);

        $body = $response->json() ?? [];

        // Bad keys are a real error; anything else (e.g. channel not active) can fall back to Snap
        if ($response->status() === 401 || ($body['status_code'] ?? null) === '401') {
            throw new \RuntimeException('Midtrans error: ' . $response->body());
        }
        // Core API answers HTTP 200 with its own status_code; 201 = QRIS created
        if (! $response->successful() || ($body['status_code'] ?? null) !== '201' || empty($body['qr_string'])) {
            throw new QrisUnavailable('Midtrans QRIS: ' . $response->body());
        }

        $expires = isset($body['expiry_time'])
            ? \Carbon\Carbon::parse($body['expiry_time'], 'Asia/Jakarta')
            : now()->addMinutes(self::PAY_WITHIN_MINUTES);

        return ['qr_string' => $body['qr_string'], 'expires_at' => $expires->toIso8601String()];
    }

    private function midtransSnap(string $orderId, int $amount, string $name, string $email, ?string $phone, string $finishUrl): string
    {
        $response = Http::withBasicAuth(config('services.midtrans.server_key'), '')
            ->timeout(15)
            ->withHeaders(self::midtransNotifyHeaders())
            ->post(self::midtransIsProduction()
                ? 'https://app.midtrans.com/snap/v1/transactions'
                : 'https://app.sandbox.midtrans.com/snap/v1/transactions', [
                'transaction_details' => ['order_id' => $orderId, 'gross_amount' => $amount],
                'customer_details'    => array_filter(['first_name' => $name, 'email' => $email, 'phone' => $phone]),
                'expiry'              => ['unit' => 'minutes', 'duration' => self::PAY_WITHIN_MINUTES],
                'callbacks'           => ['finish' => $finishUrl],
            ]);

        throw_unless($response->successful(), new \RuntimeException('Midtrans error: ' . $response->body()));

        return $response->json('token');
    }

    /**
     * Have Midtrans also notify this app, on top of the URL in the dashboard. The Midtrans
     * account is shared with other systems, so the dashboard setting is left alone.
     * Midtrans only accepts public https URLs, so nothing is sent from localhost.
     */
    private static function midtransNotifyHeaders(): array
    {
        $url = rtrim((string) config('app.url'), '/') . '/api/webhooks/payment/midtrans';

        return str_starts_with($url, 'https://') ? ['X-Append-Notification' => $url] : [];
    }

    /**
     * Map a Midtrans transaction_status to 'paid', 'failed' or 'pending'.
     * https://docs.midtrans.com/docs/https-notification-webhooks#status-definition
     */
    public static function midtransOutcome(string $status, ?string $fraud): string
    {
        return match (strtolower($status)) {
            'settlement'                          => 'paid',
            'capture'                             => match ($fraud) {
                'deny'      => 'failed',
                'challenge' => 'pending', // needs manual review in the Midtrans dashboard
                default     => 'paid',
            },
            'deny', 'cancel', 'expire', 'failure' => 'failed',
            default                               => 'pending', // pending, authorize, refunds, unknown
        };
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
    private function xenditInvoice(string $orderId, int $amount, string $name, string $email, ?string $phone, string $description, string $finishUrl): string
    {
        $response = Http::withBasicAuth((string) config('services.xendit.secret_key'), '')
            ->timeout(15)
            ->post('https://api.xendit.co/v2/invoices', [
                'external_id'          => $orderId,
                'amount'               => $amount,
                'currency'             => 'IDR',
                'description'          => $description,
                'invoice_duration'     => self::PAY_WITHIN_MINUTES * 60,
                'payer_email'          => $email,
                'customer'             => array_filter(['given_names' => $name, 'email' => $email, 'mobile_number' => $phone]),
                'success_redirect_url' => $finishUrl,
                'failure_redirect_url' => $finishUrl,
            ]);

        throw_unless($response->successful(), new \RuntimeException('Xendit error: ' . $response->body()));

        return $response->json('invoice_url');
    }

    public static function xenditOutcome(string $status): string
    {
        return match (strtoupper($status)) {
            'PAID', 'SETTLED' => 'paid',
            'EXPIRED'         => 'failed',
            default           => 'pending',
        };
    }

    /** What kind of Xendit secret key is configured (test keys start with xnd_development_). */
    public static function xenditKeyStatus(): string
    {
        $key = (string) config('services.xendit.secret_key');

        return match (true) {
            $key === ''                               => 'missing',
            str_starts_with($key, 'xnd_development_') => 'test',
            str_starts_with($key, 'xnd_production_')  => 'live',
            default                                   => 'invalid',
        };
    }
}
