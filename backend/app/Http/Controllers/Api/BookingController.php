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

                abort_if($slot->date < now()->toDateString(), 422, 'Slot date has passed.');

                abort_if($slot->studio_id != $data['studio_id'], 422, 'Slot bukan milik studio ini.');

                $slot->update(['status' => 'locked', 'locked_until' => now()->addMinutes(15)]);

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

            $paymentToken = $this->gateway->createTransaction($booking->load('studio'));

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
        return response()->json([
            'status'       => $booking->status,
            'confirmed_at' => $booking->confirmed_at?->toIso8601String(),
        ]);
    }
}
