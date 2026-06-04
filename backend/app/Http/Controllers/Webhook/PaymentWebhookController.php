<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Payment};
use App\Notifications\BookingConfirmed;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

class PaymentWebhookController extends Controller
{
    public function midtrans(Request $request): JsonResponse
    {
        $payload   = $request->all();
        $serverKey = config('services.midtrans.server_key');

        $expectedSig = hash('sha512',
            ($payload['order_id'] ?? '') .
            ($payload['status_code'] ?? '') .
            ($payload['gross_amount'] ?? '') .
            $serverKey
        );

        if (($payload['signature_key'] ?? '') !== $expectedSig) {
            return response()->json(['message' => 'Invalid signature'], 403);
        }

        $this->handleTransaction(
            orderId:       $payload['order_id'],
            gatewayRef:    $payload['transaction_id'],
            method:        $payload['payment_type'],
            gatewayStatus: $payload['transaction_status'],
            fraudStatus:   $payload['fraud_status'] ?? null,
            rawPayload:    $payload,
        );

        return response()->json(['message' => 'OK']);
    }

    private function handleTransaction(
        string  $orderId,
        string  $gatewayRef,
        string  $method,
        string  $gatewayStatus,
        ?string $fraudStatus,
        array   $rawPayload,
    ): void {
        DB::transaction(function () use ($orderId, $gatewayRef, $method, $gatewayStatus, $fraudStatus, $rawPayload) {

            $booking = Booking::where('order_id', $orderId)
                              ->lockForUpdate()
                              ->firstOrFail();

            // Idempotency guard
            if (in_array($booking->status, ['confirmed', 'cancelled'])) return;

            $isPaid = $this->resolvePaid($gatewayStatus, $fraudStatus);

            $booking->payment()->update([
                'gateway_ref'     => $gatewayRef,
                'method'          => $method,
                'status'          => $isPaid ? 'paid' : 'failed',
                'gateway_payload' => $rawPayload,
                'paid_at'         => $isPaid ? now() : null,
            ]);

            if ($isPaid) {
                $booking->update(['status' => 'confirmed', 'confirmed_at' => now()]);
                $booking->slot()->update(['status' => 'booked', 'locked_until' => null]);
                $booking->user?->notify(new BookingConfirmed($booking));
            } else {
                $booking->update(['status' => 'cancelled']);
                $booking->slot()->update(['status' => 'available', 'locked_until' => null]);
            }
        });
    }

    private function resolvePaid(string $status, ?string $fraud): bool
    {
        if (! in_array(strtolower($status), ['capture', 'settlement', 'paid'])) return false;
        if ($fraud === 'deny') return false;
        return true;
    }
}
