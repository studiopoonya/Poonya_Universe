<?php

namespace App\Http\Controllers\Admin;

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

    public function index(Request $request): JsonResponse
    {
        Booking::expireStale();

        $bookings = Booking::with(['studio', 'slot', 'payment', 'user'])
            ->when($request->search, fn ($q) => $q->where(function ($q) use ($request) {
                $q->where('customer_name',  'like', "%{$request->search}%")
                  ->orWhere('customer_phone', 'like', "%{$request->search}%")
                  ->orWhere('order_id',      'like', "%{$request->search}%");
            }))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->date,   fn ($q) => $q->whereHas('slot', fn ($s) => $s->where('date', $request->date)))
            ->latest()
            ->paginate(20);

        return response()->json($bookings);
    }

    public function show(Booking $booking): JsonResponse
    {
        return response()->json($booking->load(['studio', 'slot', 'payment', 'user']));
    }

    /** Walk-in: admin creates booking on behalf of a customer. */
    public function store(Request $request): JsonResponse
    {
        $request->merge(['customer_phone' => StoreBookingRequest::normalizePhone($request->input('customer_phone'))]);

        $data = $request->validate([
            'studio_id'      => ['required', 'integer', 'exists:studios,id'],
            'slot_id'        => ['required', 'integer', 'exists:slots,id'],
            'customer_name'  => ['required', 'string', 'max:255'],
            'customer_email' => ['required', StoreBookingRequest::EMAIL_RULE, 'max:255'],
            'customer_phone' => ['required', 'string', StoreBookingRequest::PHONE_RULE],
            'notes'          => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['required', 'in:cash,qris'],
            'promo_code'     => ['nullable', 'string', 'max:32'],
        ], [
            'customer_phone.regex' => 'Nomor HP tidak valid. Gunakan 8–15 angka, contoh 081234567890.',
        ]);

        try {
            $booking = DB::transaction(function () use ($data) {

                $slot = Slot::where('id', $data['slot_id'])
                            ->where('status', 'available')
                            ->lockForUpdate()
                            ->firstOrFail();

                abort_if($slot->date < now()->toDateString(), 422, 'Tanggal slot sudah lewat.');
                abort_if($slot->studio_id != $data['studio_id'], 422, 'Slot bukan milik studio ini.');

                $slot->update(['status' => 'locked', 'locked_until' => now()->addMinutes(30)]);

                // Any pending booking still on this slot let its lock lapse — retire it so it can't be confirmed later
                Booking::where('slot_id', $slot->id)->where('status', 'pending')->update(['status' => 'expired']);

                $studio  = Studio::findOrFail($data['studio_id']);
                $quote   = Pricing::quote($studio, $slot, $data['promo_code'] ?? null);
                abort_if($quote['promo_error'], 422, (string) $quote['promo_error']);

                $orderId = 'WALKIN-' . strtoupper(Str::random(6)) . '-' . time();

                $booking = Booking::create([
                    'studio_id'       => $studio->id,
                    'slot_id'         => $slot->id,
                    'promo_code_id'   => $quote['promo']?->id,
                    'discount_amount' => $quote['discount'],
                    'order_id'       => $orderId,
                    'status'         => 'pending',
                    'customer_name'  => $data['customer_name'],
                    'customer_email' => $data['customer_email'],
                    'customer_phone' => $data['customer_phone'],
                    'notes'          => $data['notes'] ?? null,
                    'expires_at'     => now()->addMinutes(30),
                ]);

                Payment::create([
                    'booking_id' => $booking->id,
                    'gateway'    => $data['payment_method'] === 'cash' ? 'cash' : 'midtrans',
                    'amount'     => $quote['total'],
                    'currency'   => 'IDR',
                    'status'     => 'pending',
                ]);

                return $booking;
            });

            // Cash: immediately confirm
            if ($data['payment_method'] === 'cash') {
                DB::transaction(function () use ($booking) {
                    $booking->update(['status' => 'confirmed', 'confirmed_at' => now()]);
                    $booking->slot->update(['status' => 'booked', 'locked_until' => null]);
                    $booking->payment()->update(['status' => 'paid', 'paid_at' => now(), 'method' => 'cash']);
                    $booking->sendConfirmation();
                });

                return response()->json([
                    'booking_id' => $booking->id,
                    'order_id'   => $booking->order_id,
                    'status'     => 'confirmed',
                ], 201);
            }

            // Fully discounted: nothing to charge via QRIS
            if ($booking->payment->amount === 0) {
                $booking->confirmFree();

                return response()->json(['booking_id' => $booking->id, 'order_id' => $booking->order_id, 'status' => 'confirmed'], 201);
            }

            // QRIS: generate Midtrans token
            ExpireBooking::dispatch($booking)->delay(now()->addMinutes(30));
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

    public function cancel(Booking $booking): JsonResponse
    {
        abort_if(! in_array($booking->status, ['pending', 'confirmed']), 422, 'Cannot cancel this booking.');

        $booking->update(['status' => 'cancelled']);
        $booking->releaseSlot();

        return response()->json(['message' => 'Booking dibatalkan.']);
    }

    /** Manually confirm a pending booking (e.g. after receiving cash). */
    public function confirm(Booking $booking): JsonResponse
    {
        abort_if($booking->status !== 'pending', 422, 'Only pending bookings can be confirmed.');

        DB::transaction(function () use ($booking) {
            $booking->update(['status' => 'confirmed', 'confirmed_at' => now()]);
            $booking->slot->update(['status' => 'booked', 'locked_until' => null]);
            $booking->payment()->update(['status' => 'paid', 'paid_at' => now()]);
            $booking->sendConfirmation();
        });

        return response()->json(['message' => 'Booking dikonfirmasi.']);
    }
}
