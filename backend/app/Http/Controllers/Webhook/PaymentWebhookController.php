<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Payment, PaymentTest};
use App\Services\PaymentGatewayService;
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

        $status = strtolower((string) $payload['transaction_status']);

        $this->handleTransaction(
            orderId:    $payload['order_id'],
            gatewayRef: $payload['transaction_id'],
            method:     $payload['payment_type'],
            outcome:    PaymentGatewayService::midtransOutcome($status, $payload['fraud_status'] ?? null),
            failStatus: $status === 'expire' ? 'expired' : 'cancelled',
            rawPayload: $payload,
        );

        return response()->json(['message' => 'OK']);
    }

    /**
     * Xendit Invoice callback. Authenticated by the x-callback-token header, which must
     * equal the verification token from Xendit Dashboard → Settings → Webhooks.
     * https://docs.xendit.co/apidocs/invoice-callback
     */
    public function xendit(Request $request): JsonResponse
    {
        $expected = (string) config('services.xendit.callback_token');
        if ($expected === '' || ! hash_equals($expected, (string) $request->header('x-callback-token'))) {
            return response()->json(['message' => 'Invalid callback token'], 403);
        }

        $payload = $request->all();
        $status  = strtoupper((string) ($payload['status'] ?? ''));

        $this->handleTransaction(
            orderId:    (string) ($payload['external_id'] ?? ''),
            gatewayRef: (string) ($payload['id'] ?? ''),
            method:     strtolower((string) ($payload['payment_method'] ?? $payload['payment_channel'] ?? 'xendit')),
            outcome:    PaymentGatewayService::xenditOutcome($status),
            failStatus: 'expired',
            rawPayload: $payload,
        );

        return response()->json(['message' => 'OK']);
    }

    /**
     * @param  string  $outcome     paid | failed | pending
     * @param  string  $failStatus  booking status when the payment failed: expired | cancelled
     */
    private function handleTransaction(
        string $orderId,
        string $gatewayRef,
        string $method,
        string $outcome,
        string $failStatus,
        array  $rawPayload,
    ): void {
        // Admin "Tes Pembayaran" charges aren't bookings
        if (str_starts_with($orderId, PaymentTest::PREFIX)) {
            PaymentTest::where('order_id', $orderId)->first()?->record($outcome, $method, $rawPayload);
            return;
        }

        DB::transaction(function () use ($orderId, $gatewayRef, $method, $outcome, $failStatus, $rawPayload) {

            $booking = Booking::where('order_id', $orderId)
                              ->lockForUpdate()
                              ->firstOrFail();

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
                    Log::warning('Payment received for non-pending booking', [
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
                $booking->update(['status' => $failStatus]);
                $booking->releaseSlots();
            }
        });
    }

}
