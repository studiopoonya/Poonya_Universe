<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Jobs\ExpireBooking;
use App\Models\{Booking, Payment, Slot, Studio};
use App\Services\{PaymentGatewayService, Pricing};
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    public function __construct(private PaymentGatewayService $gateway) {}

    public function store(StoreBookingRequest $request): JsonResponse
    {
        try {
            $data    = $request->validated();
            $booking = DB::transaction(function () use ($data, $request) {

                $slot = Slot::where('id', $data['slot_id'])
                            ->where('status', 'available')
                            ->lockForUpdate()
                            ->firstOrFail();

                abort_if($slot->hasStarted(), 422, 'Jam slot ini sudah lewat. Silakan pilih waktu lain.');

                abort_if($slot->studio_id != $data['studio_id'], 422, 'Slot bukan milik studio ini.');

                $slot->update(['status' => 'locked', 'locked_until' => now()->addMinutes(15)]);

                // Any pending booking still on this slot let its lock lapse — retire it so it can't be confirmed later
                Booking::where('slot_id', $slot->id)->where('status', 'pending')->update(['status' => 'expired']);

                $studio  = Studio::findOrFail($data['studio_id']);
                $quote   = Pricing::quote($studio, $slot, $data['promo_code'] ?? null);
                abort_if($quote['promo_error'], 422, (string) $quote['promo_error']);

                $orderId = 'ORD-' . strtoupper(Str::random(8)) . '-' . time();

                $booking = Booking::create([
                    'user_id'         => $request->user()?->id,
                    'studio_id'       => $studio->id,
                    'slot_id'         => $slot->id,
                    'promo_code_id'   => $quote['promo']?->id,
                    'discount_amount' => $quote['discount'],
                    'order_id'        => $orderId,
                    'status'         => 'pending',
                    'customer_name'  => $data['customer_name'],
                    'customer_email' => $data['customer_email'],
                    'customer_phone' => $data['customer_phone'],
                    'notes'          => $data['notes'] ?? null,
                    'expires_at'     => now()->addMinutes(15),
                ]);

                Payment::create([
                    'booking_id' => $booking->id,
                    'gateway'    => 'midtrans',
                    'amount'     => $quote['total'],
                    'currency'   => 'IDR',
                    'status'     => 'pending',
                ]);

                return $booking;
            });

            // 100% promo: nothing to pay, so confirm right away without Midtrans
            if ($booking->payment->amount === 0) {
                $booking->confirmFree();

                return response()->json([
                    'booking_id' => $booking->id,
                    'order_id'   => $booking->order_id,
                    'status'     => 'confirmed',
                ], 201);
            }

            ExpireBooking::dispatch($booking)->delay(now()->addMinutes(15));

            try {
                $paymentToken = $this->gateway->createTransaction($booking->load('studio'));
            } catch (\Throwable $e) {
                report($e);
                $booking->cancelUnpaid();

                return response()->json([
                    'message' => 'Pembayaran sedang tidak bisa diproses. Silakan coba lagi sebentar lagi.',
                    'code'    => 'PAYMENT_GATEWAY_ERROR',
                ], 502);
            }

            return response()->json([
                'booking_id'    => $booking->id,
                'order_id'      => $booking->order_id,
                'expires_at'    => $booking->expires_at->toIso8601String(),
                'payment_token' => $paymentToken,
            ], 201);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return response()->json([
                'message' => 'Slot ini baru saja diambil. Silakan pilih waktu lain.',
                'code'    => 'SLOT_UNAVAILABLE',
            ], 409);
        }
    }

    /** Price for a slot (weekday/weekend) with an optional promo code, shown before paying. */
    public function quote(Request $request): JsonResponse
    {
        $data = $request->validate([
            'studio_id'  => ['required', 'integer', 'exists:studios,id'],
            'slot_id'    => ['required', 'integer', 'exists:slots,id'],
            'promo_code' => ['nullable', 'string', 'max:32'],
        ]);

        $q = Pricing::quote(Studio::findOrFail($data['studio_id']), Slot::findOrFail($data['slot_id']), $data['promo_code'] ?? null);

        return response()->json([
            'base_price'  => $q['base_price'],
            'is_weekend'  => $q['is_weekend'],
            'discount'    => $q['discount'],
            'total'       => $q['total'],
            'promo'       => $q['promo'] ? ['code' => $q['promo']->code, 'label' => $q['promo']->label()] : null,
            'promo_error' => $q['promo_error'],
        ]);
    }

    public function status(Booking $booking): JsonResponse
    {
        Booking::expireStale();
        $booking->refresh();

        return response()->json([
            'status'       => $booking->status,
            'confirmed_at' => $booking->confirmed_at?->toIso8601String(),
        ]);
    }

    /** Booking summary for the payment-finish page Midtrans redirects to. No customer PII. */
    public function showByOrder(string $orderId): JsonResponse
    {
        Booking::expireStale();
        $booking = Booking::with(['studio', 'slot'])->where('order_id', $orderId)->firstOrFail();

        return response()->json([
            'order_id'   => $booking->order_id,
            'status'     => $booking->status,
            'studio'     => $booking->studio?->name,
            'date'       => $booking->slot?->date,
            'start_time' => $booking->slot ? substr($booking->slot->start_time, 0, 5) : null,
            'end_time'   => $booking->slot ? substr($booking->slot->end_time, 0, 5) : null,
        ]);
    }
}
