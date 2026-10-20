<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Services\{PaymentGatewayService, PaymentOutcome};
use Illuminate\Http\{JsonResponse, Request};

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

        PaymentOutcome::apply(
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

        PaymentOutcome::apply(
            orderId:    (string) ($payload['external_id'] ?? ''),
            gatewayRef: (string) ($payload['id'] ?? ''),
            method:     strtolower((string) ($payload['payment_method'] ?? $payload['payment_channel'] ?? 'xendit')),
            outcome:    PaymentGatewayService::xenditOutcome($status),
            failStatus: 'expired',
            rawPayload: $payload,
        );

        return response()->json(['message' => 'OK']);
    }
}
