<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentTest;
use App\Services\PaymentGatewayService;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Str;

/**
 * "Tes Pembayaran" in admin Settings: a tiny real charge through the active gateway
 * to check the keys and payment flow end to end. Not tied to any booking.
 */
class PaymentTestController extends Controller
{
    public function __construct(private PaymentGatewayService $gateway) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['amount' => ['nullable', 'integer', 'min:1', 'max:100000']]);
        $amount = (int) ($data['amount'] ?? 100);
        $user   = $request->user();
        $test   = PaymentTest::create([
            'order_id'   => PaymentTest::PREFIX . strtoupper(Str::random(8)) . '-' . time(),
            'provider'   => PaymentGatewayService::provider(),
            'amount'     => $amount,
            'created_by' => $user->id,
        ]);

        try {
            $payment = $this->gateway->charge(
                orderId:     $test->order_id,
                amount:      $amount,
                name:        $user->name,
                email:       $user->email,
                phone:       null,
                description: 'Tes pembayaran ' . config('app.name'),
                finishUrl:   config('app.frontend_url') . '/admin/settings',
            );
        } catch (\Throwable $e) {
            $test->update(['status' => 'failed']);

            // Show the gateway's own reason — this page exists to debug the setup
            return response()->json([
                'message' => 'Gateway menolak: ' . Str::limit(preg_replace('/^\w+ error: /', '', $e->getMessage()), 300),
            ], 502);
        }

        return response()->json(['order_id' => $test->order_id, 'amount' => $amount, ...$payment], 201);
    }

    /** Status of a test charge; asks the gateway directly while still pending (no webhook needed). */
    public function show(string $orderId): JsonResponse
    {
        $test = PaymentTest::where('order_id', $orderId)->firstOrFail();

        if ($test->status === 'pending') {
            try {
                $s = $this->gateway->fetchStatus($test->provider, $test->order_id);
                $test->record($s['outcome'], $s['method'], $s['payload']);
            } catch (\Throwable $e) {
                report($e); // keep showing "pending"; the next poll retries
            }
        }

        return response()->json($test->only(['order_id', 'provider', 'amount', 'status', 'method', 'paid_at']));
    }
}
