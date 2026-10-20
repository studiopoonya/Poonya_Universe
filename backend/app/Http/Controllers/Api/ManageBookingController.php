<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Slot};
use App\Services\Pricing;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

/**
 * Customer self-service ("Cek Booking"): look up a booking with Order ID + email,
 * and move it to another slot once, up to 24 hours before the session.
 */
class ManageBookingController extends Controller
{
    public function lookup(Request $request): JsonResponse
    {
        $booking = $this->find($request);

        return response()->json($this->present($booking));
    }

    public function reschedule(Request $request): JsonResponse
    {
        $request->validate(['slot_id' => ['required', 'integer', 'exists:slots,id']]);
        $booking = $this->find($request);

        $booking = DB::transaction(function () use ($booking, $request) {
            $booking = Booking::with('slot', 'studio', 'payment')->lockForUpdate()->findOrFail($booking->id);
            abort_if($reason = $booking->rescheduleBlockedReason(), 422, (string) $reason);

            $new = Slot::where('id', $request->slot_id)->lockForUpdate()->firstOrFail();
            abort_if($new->id === $booking->slot_id, 422, 'Itu jadwal kamu yang sekarang.');
            abort_if($new->studio_id !== $booking->studio_id, 422, 'Ubah jadwal hanya bisa di studio yang sama.');
            abort_if($new->status !== 'available' || $new->hasStarted(), 409, 'Slot ini sudah tidak tersedia. Pilih waktu lain.');

            // Paid price must match (e.g. weekday → weekend costs more); the admin handles those by hand
            $paidBase = $booking->payment->amount + $booking->discount_amount;
            abort_if(
                Pricing::quote($booking->studio, $new)['base_price'] !== $paidBase,
                422,
                'Harga di jadwal itu berbeda (weekday/weekend). Pilih jadwal dengan harga yang sama atau hubungi admin.'
            );

            $old = $booking->slot;
            $new->update(['status' => 'booked', 'locked_until' => null]);
            $booking->update(['slot_id' => $new->id, 'reschedule_count' => $booking->reschedule_count + 1]);
            $old->update(['status' => 'available', 'locked_until' => null]);

            $booking->sendConfirmation(rescheduled: true);

            return $booking->fresh(['slot', 'studio', 'payment']);
        });

        return response()->json([...$this->present($booking), 'message' => 'Jadwal berhasil diubah. Detail baru sudah dikirim ke email kamu.']);
    }

    /** Order ID + the email used at checkout — both must match. */
    private function find(Request $request): Booking
    {
        $data = $request->validate([
            'order_id' => ['required', 'string', 'max:64'],
            'email'    => ['required', 'email'],
        ]);

        $booking = Booking::with(['slot', 'studio', 'payment'])
            ->where('order_id', strtoupper(trim($data['order_id'])))
            ->whereRaw('LOWER(customer_email) = ?', [strtolower(trim($data['email']))])
            ->first();

        abort_unless($booking, 404, 'Booking tidak ditemukan. Periksa Order ID dan email yang dipakai saat booking.');

        return $booking;
    }

    private function present(Booking $b): array
    {
        return [
            'order_id'         => $b->order_id,
            'status'           => $b->status,
            'customer_name'    => $b->customer_name,
            'studio_id'        => $b->studio_id,
            'studio'           => $b->studio?->name,
            'date'             => $b->slot?->date,
            'start_time'       => $b->slot ? substr($b->slot->start_time, 0, 5) : null,
            'end_time'         => $b->slot ? substr($b->slot->end_time, 0, 5) : null,
            'amount'           => $b->payment?->amount,
            'payment_status'   => $b->payment?->status,
            'rescheduled'      => $b->reschedule_count > 0,
            'reschedule_error' => $b->slot ? $b->rescheduleBlockedReason() : 'Booking ini tidak punya jadwal.',
        ];
    }
}
