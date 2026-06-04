<?php

namespace App\Services;

use App\Models\Booking;
use Illuminate\Support\Facades\Http;

class PaymentGatewayService
{
    public function createTransaction(Booking $booking): string
    {
        $response = Http::withBasicAuth(config('services.midtrans.server_key'), '')
            ->timeout(15)
            ->post(config('services.midtrans.snap_url'), [
                'transaction_details' => [
                    'order_id'     => $booking->order_id,
                    'gross_amount' => $booking->studio->price,
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
}
