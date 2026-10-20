<?php

namespace App\Services;

use App\Models\{Booking, Setting};
use Illuminate\Support\Facades\Http;

class PaymentGatewayService
{
    public function createTransaction(Booking $booking): string
    {
        $response = Http::withBasicAuth(config('services.midtrans.server_key'), '')
            ->timeout(15)
            ->post($this->snapApiUrl(), [
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
                'expiry' => [
                    'unit'     => 'minutes',
                    'duration' => 15,
                ],
                'callbacks' => [
                    'finish' => config('app.frontend_url') . '/booking/success?order_id=' . $booking->order_id,
                ],
            ]);

        throw_unless($response->successful(), new \RuntimeException(
            'Midtrans error: ' . $response->body()
        ));

        return $response->json('token');
    }

    /**
     * Follow the Sandbox/Production toggle in the admin Settings page, so the token
     * matches the snap.js the frontend loads. Falls back to .env when never saved.
     */
    private function snapApiUrl(): string
    {
        $saved  = Setting::get('midtrans_is_production');
        $isProd = filter_var($saved ?? config('services.midtrans.is_production'), FILTER_VALIDATE_BOOLEAN);

        return $isProd
            ? 'https://app.midtrans.com/snap/v1/transactions'
            : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
    }
}
