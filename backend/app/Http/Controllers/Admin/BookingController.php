<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Jobs\ExpireBooking;
use App\Models\{Booking, Payment, Slot, Studio};
use App\Services\{PaymentGatewayService, Pricing, SlotBooker};
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingController extends Controller
{
    public function __construct(private PaymentGatewayService $gateway) {}

    public function index(Request $request): JsonResponse
    {
        Booking::expireStale();

        return response()->json($this->filtered($request)->latest()->paginate(20));
    }

    /** Same filters as the list, as a CSV that opens directly in Excel (Indonesian locale). */
    public function export(Request $request): StreamedResponse
    {
        $request->validate(['month' => ['nullable', 'date_format:Y-m']]);

        $query = $this->filtered($request)
            ->when($request->month, fn ($q) => $q->whereHas('slot', fn ($s) => $s->where('date', 'like', "{$request->month}-%")))
            ->with('promoCode')
            ->orderByDesc('id');

        $name = 'booking-' . ($request->month ?: now()->format('Y-m-d')) . '.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows names correctly
            fputcsv($out, ['Order ID', 'Tanggal Sesi', 'Jam', 'Sesi', 'Studio', 'Nama', 'Email', 'No. HP', 'Status Booking',
                'Kode Promo', 'Diskon', 'Total Bayar', 'Status Bayar', 'Metode', 'Dibuat'], ';');

            $query->chunk(500, function ($bookings) use ($out) {
                foreach ($bookings as $b) {
                    fputcsv($out, [
                        $b->order_id,
                        $b->slot?->date,
                        $b->slot ? substr($b->slot->start_time, 0, 5) . '-' . $b->end_time : '',
                        $b->sessions,
                        $b->studio?->name,
                        $b->customer_name,
                        $b->customer_email,
                        // ="..." keeps Excel from dropping the leading 0 / using scientific notation
                        '="' . $b->customer_phone . '"',
                        $b->status,
                        $b->promoCode?->code,
                        $b->discount_amount,
                        $b->payment?->amount,
                        $b->payment?->status,
                        $b->payment?->method,
                        $b->created_at?->format('Y-m-d H:i'),
                    ], ';');
                }
            });

            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function filtered(Request $request)
    {
        return Booking::with(['studio', 'slot', 'payment', 'user'])
            ->when($request->search, fn ($q) => $q->where(function ($q) use ($request) {
                $q->where('customer_name',  'like', "%{$request->search}%")
                  ->orWhere('customer_phone', 'like', "%{$request->search}%")
                  ->orWhere('order_id',      'like', "%{$request->search}%");
            }))
            ->when($request->status === 'refund', fn ($q) => $q->whereHas('payment', fn ($p) => $p->where('status', 'refund_pending')))
            ->when($request->status && $request->status !== 'refund', fn ($q) => $q->where('status', $request->status))
            ->when($request->date,   fn ($q) => $q->whereHas('slot', fn ($s) => $s->where('date', $request->date)));
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
            'sessions'       => ['nullable', 'integer', 'between:1,' . Booking::MAX_SESSIONS],
        ], [
            'customer_phone.regex' => 'Nomor HP tidak valid. Gunakan 8–15 angka, contoh 081234567890.',
        ]);

        try {
            $booking = DB::transaction(function () use ($data) {

                abort_if(Slot::whereKey($data['slot_id'])->value('date') < now()->toDateString(), 422, 'Tanggal slot sudah lewat.');

                // Walk-ins may start a slot that is already running today
                $sessions = (int) ($data['sessions'] ?? 1);
                $slots    = SlotBooker::take((int) $data['studio_id'], (int) $data['slot_id'], $sessions, 'locked', 30, allowStarted: true);
                $slot     = $slots->first();

                $studio  = Studio::findOrFail($data['studio_id']);
                $quote   = Pricing::quote($studio, $slot, $data['promo_code'] ?? null, $sessions);
                abort_if($quote['promo_error'], 422, (string) $quote['promo_error']);

                $orderId = 'WALKIN-' . strtoupper(Str::random(6)) . '-' . time();

                $booking = Booking::create([
                    'studio_id'       => $studio->id,
                    'slot_id'         => $slot->id,
                    'sessions'        => $sessions,
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
                SlotBooker::attach($booking, $slots);

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
                    $booking->bookSlots();
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
        abort_if(! in_array($booking->status, ['pending', 'onsite', 'confirmed']), 422, 'Booking ini tidak bisa dibatalkan.');

        $needsRefund = DB::transaction(function () use ($booking) {
            $heldSlots = $booking->status !== 'onsite'; // onsite reservations never locked their slots
            $booking->update(['status' => 'cancelled']);
            if ($heldSlots) $booking->releaseSlots();

            // The customer already paid — track the money until it's returned
            $paid = $booking->payment && $booking->payment->status === 'paid' && $booking->payment->amount > 0;
            if ($paid) $booking->payment()->update(['status' => 'refund_pending']);

            return $paid;
        });

        return response()->json([
            'message' => $needsRefund ? 'Booking dibatalkan. Pembayaran ditandai perlu refund.' : 'Booking dibatalkan.',
        ]);
    }

    /** Admin returned the money for a refund-pending payment. */
    public function markRefunded(Booking $booking): JsonResponse
    {
        abort_unless($booking->payment?->status === 'refund_pending', 422, 'Booking ini tidak sedang menunggu refund.');

        $booking->payment()->update(['status' => 'refunded']);

        return response()->json(['message' => 'Refund dicatat.']);
    }

    /** Manually confirm a pending booking (e.g. after receiving cash). */
    /**
     * Manually confirm a booking: a pending one (e.g. paid outside Midtrans), or a
     * pay-at-studio reservation when the customer arrives and pays cash.
     */
    public function confirm(Booking $booking): JsonResponse
    {
        abort_if(! in_array($booking->status, ['pending', 'onsite']), 422, 'Hanya booking menunggu / bayar di tempat yang bisa dikonfirmasi.');

        try {
            DB::transaction(function () use ($booking) {
                if ($booking->status === 'onsite') {
                    // Its slots were never locked: take them now, unless someone paid online first
                    SlotBooker::take($booking->studio_id, $booking->slot_id, $booking->sessions, 'booked', allowStarted: true, exceptBookingId: $booking->id);
                } else {
                    $booking->bookSlots();
                }

                $booking->update(['status' => 'confirmed', 'confirmed_at' => now()]);
                $booking->payment()->update(['status' => 'paid', 'paid_at' => now(), 'method' => $booking->payment->gateway === 'cash' ? 'cash' : $booking->payment->method]);
                $booking->sendConfirmation();
            });
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return response()->json(['message' => 'Jadwal ini sudah diambil customer lain yang bayar online. Pilih jam lain untuk customer ini.'], 409);
        }

        return response()->json(['message' => 'Booking dikonfirmasi.']);
    }
}
