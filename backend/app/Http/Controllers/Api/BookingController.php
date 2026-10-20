<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Jobs\ExpireBooking;
use App\Models\{Booking, Payment, Slot, Studio};
use App\Services\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
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
                $orderId = 'ORD-' . strtoupper(Str::random(8)) . '-' . time();

                $booking = Booking::create([
                    'user_id'        => $request->user()?->id,
                    'studio_id'      => $studio->id,
                    'slot_id'        => $slot->id,
                    'order_id'       => $orderId,
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
                    'amount'     => $studio->price,
                    'currency'   => 'IDR',
                    'status'     => 'pending',
                ]);

                return $booking;
            });

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
