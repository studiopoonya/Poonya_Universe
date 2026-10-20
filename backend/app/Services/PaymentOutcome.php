<?php

namespace App\Services;

use App\Models\{Booking, PaymentTest};
use Illuminate\Support\Facades\{DB, Log};

/**
 * Applies a gateway payment outcome to a booking (or an admin test charge).
 * Used by the webhooks and by direct status checks against the gateway, so the
 * result is the same whichever arrives first.
 */
class PaymentOutcome
{
    /**
     * @param  string  $outcome     paid | failed | pending
     * @param  string  $failStatus  booking status when the payment failed: expired | cancelled
     */
    public static function apply(
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
