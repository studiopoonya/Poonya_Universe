<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Jobs\ExpireBooking;
use App\Models\{Booking, Payment, Slot, Studio};
use App\Services\{PaymentGatewayService, Pricing, SlotBooker};
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

                $sessions = (int) ($data['sessions'] ?? 1);
                $slots    = SlotBooker::take((int) $data['studio_id'], (int) $data['slot_id'], $sessions, 'locked', 15);
                $slot     = $slots->first();

                $studio  = Studio::findOrFail($data['studio_id']);
                $quote   = Pricing::quote($studio, $slot, $data['promo_code'] ?? null, $sessions);
                abort_if($quote['promo_error'], 422, (string) $quote['promo_error']);

                $orderId = 'ORD-' . strtoupper(Str::random(8)) . '-' . time();

                $booking = Booking::create([
                    'user_id'         => $request->user()?->id,
                    'studio_id'       => $studio->id,
                    'slot_id'         => $slot->id,
                    'sessions'        => $sessions,
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
                SlotBooker::attach($booking, $slots);

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
            'sessions'   => ['nullable', 'integer', 'between:1,' . Booking::MAX_SESSIONS],
        ]);

        $q = Pricing::quote(Studio::findOrFail($data['studio_id']), Slot::findOrFail($data['slot_id']), $data['promo_code'] ?? null, (int) ($data['sessions'] ?? 1));

        return response()->json([
            'per_session' => $q['per_session'],
            'sessions'    => $q['sessions'],
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
            'end_time'   => $booking->end_time,
            'sessions'   => $booking->sessions,
        ]);
    }
}
