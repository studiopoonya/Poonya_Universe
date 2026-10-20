<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Jobs\ExpireBooking;
use App\Models\{Booking, Payment, Slot, Studio};
use App\Services\{PaymentGatewayService, PaymentOutcome, Pricing, SlotBooker};
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
                $slots    = SlotBooker::run((int) $data['studio_id'], (int) $data['slot_id'], $sessions);
                $slot     = $slots->first();

                $studio  = Studio::findOrFail($data['studio_id']);
                $quote   = Pricing::quote($studio, $slot, $data['promo_code'] ?? null, $sessions);
                abort_if($quote['promo_error'], 422, (string) $quote['promo_error']);

                // Pay at the studio: a reservation that does NOT lock the slots (nothing to pay → treat as online)
                $onsite = ($data['payment_method'] ?? 'online') === 'onsite' && $quote['total'] > 0;
                if ($onsite) {
                    abort_if(SlotBooker::hasOnsiteReservation($slots), response()->json([
                        'message' => 'Jam ini sudah direservasi orang lain untuk bayar di tempat. Bayar via QRIS untuk langsung mengamankannya, atau pilih jam lain.',
                        'code'    => 'SLOT_RESERVED',
                    ], 409));
                } else {
                    $slots = SlotBooker::take((int) $data['studio_id'], (int) $data['slot_id'], $sessions, 'locked', 15);
                }

                $orderId = 'ORD-' . strtoupper(Str::random(8)) . '-' . time();

                $booking = Booking::create([
                    'user_id'         => $request->user()?->id,
                    'studio_id'       => $studio->id,
                    'slot_id'         => $slot->id,
                    'sessions'        => $sessions,
                    'promo_code_id'   => $quote['promo']?->id,
                    'discount_amount' => $quote['discount'],
                    'order_id'        => $orderId,
                    'status'         => $onsite ? 'onsite' : 'pending',
                    'customer_name'  => $data['customer_name'],
                    'customer_email' => $data['customer_email'],
                    'customer_phone' => $data['customer_phone'],
                    'notes'          => $data['notes'] ?? null,
                    // An onsite reservation lapses once its session is over
                    'expires_at'     => $onsite
                        ? \Carbon\Carbon::parse($slot->date . ' ' . $slot->start_time)->addMinutes(30 * $sessions)
                        : now()->addMinutes(15),
                ]);
                SlotBooker::attach($booking, $slots);

                Payment::create([
                    'booking_id' => $booking->id,
                    'gateway'    => $onsite ? 'cash' : PaymentGatewayService::provider(),
                    'amount'     => $quote['total'],
                    'currency'   => 'IDR',
                    'status'     => 'pending',
                ]);

                return $booking;
            });

            if ($booking->status === 'onsite') {
                $booking->sendConfirmation('onsite');

                return response()->json([
                    'booking_id' => $booking->id,
                    'order_id'   => $booking->order_id,
                    'status'     => 'onsite',
                ], 201);
            }

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
                $payment = $this->gateway->createTransaction($booking->load('studio'));
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
                ...$payment, // payment_token (Midtrans popup) or payment_url (Xendit checkout)
            ], 201);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return response()->json([
                'message' => 'Slot ini baru saja diambil. Silakan pilih waktu lain.',
                'code'    => 'SLOT_UNAVAILABLE',
            ], 409);
        }
    }

    /**
     * Turn a pay-at-studio reservation into an online payment, locking its slots now.
     * Offered right after reserving ("amankan jadwal sekarang"). Identified by Order ID + email.
     */
    public function payOnline(Request $request): JsonResponse
    {
        $data = $request->validate(['order_id' => ['required', 'string'], 'email' => ['required', 'email']]);

        $booking = Booking::where('order_id', $data['order_id'])
            ->whereRaw('LOWER(customer_email) = ?', [strtolower(trim($data['email']))])
            ->firstOrFail();
        abort_unless($booking->status === 'onsite', 422, 'Booking ini bukan reservasi bayar di tempat.');

        try {
            DB::transaction(function () use ($booking) {
                SlotBooker::take($booking->studio_id, $booking->slot_id, $booking->sessions, 'locked', 15, exceptBookingId: $booking->id);
                $booking->update(['status' => 'pending', 'expires_at' => now()->addMinutes(15)]);
                $booking->payment()->update(['gateway' => PaymentGatewayService::provider()]);
            });
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return response()->json(['message' => 'Jadwal ini baru saja diambil orang lain. Silakan pilih jam lain.', 'code' => 'SLOT_UNAVAILABLE'], 409);
        }

        ExpireBooking::dispatch($booking)->delay(now()->addMinutes(15));

        try {
            $payment = $this->gateway->createTransaction($booking->fresh(['studio', 'payment']));
        } catch (\Throwable $e) {
            report($e);
            // Back to a plain reservation rather than losing it
            DB::transaction(function () use ($booking) {
                $booking->releaseSlots();
                $booking->update(['status' => 'onsite']);
                $booking->payment()->update(['gateway' => 'cash']);
            });

            return response()->json(['message' => 'Pembayaran online sedang tidak bisa diproses. Reservasi bayar di tempat kamu tetap tercatat.', 'code' => 'PAYMENT_GATEWAY_ERROR'], 502);
        }

        return response()->json(['booking_id' => $booking->id, 'order_id' => $booking->order_id, ...$payment]);
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

        // Webhooks can't reach a laptop and can be late — while waiting on an online payment,
        // also ask the gateway (at most every 5 s per booking)
        if ($booking->status === 'pending' && in_array($booking->payment?->gateway, PaymentGatewayService::PROVIDERS, true)
            && \Illuminate\Support\Facades\Cache::add("pay-check:{$booking->id}", true, 5)) {
            try {
                $s = $this->gateway->fetchStatus($booking->payment->gateway, $booking->order_id);
                if ($s['outcome'] !== 'pending') {
                    PaymentOutcome::apply($booking->order_id, (string) ($s['payload']['transaction_id'] ?? $s['payload']['id'] ?? ''), (string) $s['method'],
                        $s['outcome'], strtolower((string) ($s['payload']['transaction_status'] ?? $s['payload']['status'] ?? '')) === 'cancel' ? 'cancelled' : 'expired', $s['payload']);
                    $booking->refresh();
                }
            } catch (\Throwable $e) {
                report($e); // fall back to the webhook
            }
        }

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
