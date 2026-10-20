<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Payment};
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\{DB, Log};

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

            $outcome = $this->resolveOutcome($gatewayStatus, $fraudStatus);

            // Idempotency guard: booking already settled one way or the other
            if ($booking->status !== 'pending') {
                if ($outcome === 'paid') {
                    // A repeat notification for an already-confirmed booking needs nothing
                    if ($booking->status === 'confirmed') return;

                    // Money arrived after the booking expired/was cancelled — flag it for a refund
                    $booking->payment()->update([
                        'gateway_ref'     => $gatewayRef,
                        'method'          => $method,
                        'status'          => 'refund_pending',
                        'paid_at'         => now(),
                        'gateway_payload' => $rawPayload,
                    ]);
                    Log::warning('Midtrans payment received for non-pending booking', [
                        'order_id' => $orderId,
                        'status'   => $booking->status,
                    ]);
                }
                return;
            }

            // Still waiting on the customer (e.g. QRIS/VA just issued) — record details, keep the slot locked
            if ($outcome === 'pending') {
                $booking->payment()->update([
                    'gateway_ref'     => $gatewayRef,
                    'method'          => $method,
                    'gateway_payload' => $rawPayload,
                ]);
                return;
            }

            $isPaid = $outcome === 'paid';

            $booking->payment()->update([
                'gateway_ref'     => $gatewayRef,
                'method'          => $method,
                'status'          => $isPaid ? 'paid' : 'failed',
                'gateway_payload' => $rawPayload,
                'paid_at'         => $isPaid ? now() : null,
            ]);

            if ($isPaid) {
                $booking->update(['status' => 'confirmed', 'confirmed_at' => now()]);
                $booking->bookSlots();
                $booking->sendConfirmation();
            } else {
                $booking->update(['status' => strtolower($gatewayStatus) === 'expire' ? 'expired' : 'cancelled']);
                $booking->releaseSlots();
            }
        });
    }

    /**
     * Map a Midtrans transaction_status to 'paid', 'failed' or 'pending'.
     * https://docs.midtrans.com/docs/https-notification-webhooks#status-definition
     */
    private function resolveOutcome(string $status, ?string $fraud): string
    {
        return match (strtolower($status)) {
            'settlement'                        => 'paid',
            'capture'                           => match ($fraud) {
                'deny'      => 'failed',
                'challenge' => 'pending', // needs manual review in the Midtrans dashboard
                default     => 'paid',
            },
            'deny', 'cancel', 'expire', 'failure' => 'failed',
            default                             => 'pending', // pending, authorize, refunds, unknown
        };
    }
}
