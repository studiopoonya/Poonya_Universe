<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Payment, Slot, Studio};
use App\Services\SlotBooker;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Booking::expireStale();

        // ?per_page=10|20|50 from the list; anything else falls back to 20
        $perPage = in_array((int) $request->per_page, [10, 20, 50], true) ? (int) $request->per_page : 20;

        return response()->json($this->filtered($request)->latest('bookings.id')->paginate($perPage));
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
    public function confirm(Request $request, Booking $booking): JsonResponse
    {
        abort_if(! in_array($booking->status, ['pending', 'onsite']), 422, 'Hanya booking menunggu / bayar di tempat yang bisa dikonfirmasi.');

        // Cash at the counter: record what was handed over so the change is on file
        $isCash = $booking->payment?->gateway === 'cash';
        $data = $request->validate([
            'cash_received' => [$booking->status === 'onsite' && $booking->payment?->amount > 0 ? 'required' : 'nullable', 'integer', 'min:' . (int) $booking->payment?->amount],
        ], ['cash_received.min' => 'Uang yang diterima kurang dari tagihan.', 'cash_received.required' => 'Masukkan jumlah uang yang diterima.']);
        $cash = $isCash ? ($data['cash_received'] ?? null) : null;

        try {
            DB::transaction(function () use ($booking, $cash) {
                if ($booking->status === 'onsite') {
                    // Its slots were never locked: take them now, unless someone paid online first
                    SlotBooker::take($booking->studio_id, $booking->slot_id, $booking->sessions, 'booked', allowStarted: true, exceptBookingId: $booking->id);
                } else {
                    $booking->bookSlots();
                }

                $booking->update(['status' => 'confirmed', 'confirmed_at' => now()]);
                $booking->payment()->update([
                    'status'        => 'paid',
                    'paid_at'       => now(),
                    'method'        => $booking->payment->gateway === 'cash' ? 'cash' : $booking->payment->method,
                    'cash_received' => $cash,
                    'cash_change'   => $cash !== null ? $cash - $booking->payment->amount : null,
                ]);
                $booking->sendConfirmation();
            });
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return response()->json(['message' => 'Jadwal ini sudah diambil customer lain yang bayar online. Pilih jam lain untuk customer ini.'], 409);
        }

        return response()->json(['message' => 'Booking dikonfirmasi.']);
    }
}
