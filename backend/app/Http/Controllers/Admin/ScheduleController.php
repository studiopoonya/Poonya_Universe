<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{Booking, ClosedDate, OperationalHour, Slot};
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

/** Operational hours, holidays and per-slot blocking (admin "Jadwal" page). */
class ScheduleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'hours'        => OperationalHour::orderBy('weekday')->get(['weekday', 'is_open', 'open_time', 'close_time']),
            'closed_dates' => ClosedDate::where('date', '>=', today()->toDateString())->orderBy('date')->get(),
        ]);
    }

    public function updateHours(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hours'              => ['required', 'array', 'size:7'],
            'hours.*.weekday'    => ['required', 'integer', 'between:0,6', 'distinct'],
            'hours.*.is_open'    => ['required', 'boolean'],
            'hours.*.open_time'  => ['required', 'date_format:H:i'],
            'hours.*.close_time' => ['required', 'date_format:H:i', 'after:hours.*.open_time'],
        ], [
            'hours.*.close_time.after' => 'Jam tutup harus setelah jam buka.',
        ]);

        $removed = DB::transaction(function () use ($data) {
            foreach ($data['hours'] as $h) {
                OperationalHour::updateOrCreate(['weekday' => $h['weekday']], [
                    'is_open'    => $h['is_open'],
                    'open_time'  => $h['open_time'] . ':00',
                    'close_time' => $h['close_time'] . ':00',
                ]);
            }

            // From tomorrow on, drop untouched free slots so days are rebuilt with the new hours.
            // Slots that were ever booked (or blocked by hand) stay as they are.
            return Slot::where('date', '>', today()->toDateString())
                ->where('status', 'available')
                ->whereDoesntHave('booking')
                ->delete();
        });

        return response()->json(['message' => 'Jam operasional disimpan. Berlaku mulai besok.', 'slots_rebuilt' => $removed]);
    }

    public function addClosedDate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date'   => ['required', 'date', 'after_or_equal:today', 'unique:closed_dates,date'],
            'reason' => ['nullable', 'string', 'max:120'],
        ], ['date.unique' => 'Tanggal ini sudah ditandai libur.']);

        $closed = DB::transaction(function () use ($data) {
            $closed = ClosedDate::create($data);

            // Free slots disappear; locked/booked ones stay so existing customers keep their session
            Slot::whereDate('date', $data['date'])->where('status', 'available')->whereDoesntHave('booking')->delete();
            Slot::whereDate('date', $data['date'])->where('status', 'available')->update(['status' => 'blocked']);

            return $closed;
        });

        $existing = Booking::whereIn('status', ['pending', 'confirmed'])
            ->whereHas('slot', fn ($q) => $q->whereDate('date', $data['date']))
            ->count();

        return response()->json([
            'closed_date' => $closed,
            'message'     => $existing
                ? "Tanggal ditandai libur. Ada {$existing} booking aktif di tanggal ini — hubungi customer untuk reschedule/refund."
                : 'Tanggal ditandai libur.',
        ], 201);
    }

    public function removeClosedDate(ClosedDate $closedDate): JsonResponse
    {
        $date = $closedDate->date->toDateString();

        DB::transaction(function () use ($closedDate, $date) {
            $closedDate->delete();
            // Slots blocked by the holiday come back as regular free slots
            Slot::whereDate('date', $date)->where('status', 'blocked')->update(['status' => 'available']);
        });

        return response()->json(['message' => 'Tanggal dibuka kembali.']);
    }

    /** Slots of one studio on one day, for blocking/unblocking. */
    public function slots(Request $request): JsonResponse
    {
        $data = $request->validate([
            'studio_id' => ['required', 'integer', 'exists:studios,id'],
            'date'      => ['required', 'date'],
        ]);

        // Make sure the day exists before showing it
        \App\Services\SlotGenerator::forDay(\App\Models\Studio::findOrFail($data['studio_id']), \Carbon\Carbon::parse($data['date']));

        $slots = Slot::where('studio_id', $data['studio_id'])
            ->whereDate('date', $data['date'])
            ->orderBy('start_time')
            ->with(['bookings' => fn ($q) => $q->whereIn('status', ['pending', 'confirmed'])->select('id', 'slot_id', 'customer_name', 'status')])
            ->get()
            ->map(fn (Slot $s) => [
                'id'         => $s->id,
                'start_time' => substr($s->start_time, 0, 5),
                'end_time'   => substr($s->end_time, 0, 5),
                'status'     => $s->status,
                'customer'   => $s->bookings->first()?->customer_name,
            ]);

        return response()->json($slots);
    }
}
