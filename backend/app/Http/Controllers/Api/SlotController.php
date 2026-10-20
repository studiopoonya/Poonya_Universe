<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Slot, Studio};
use App\Services\SlotGenerator;
use Illuminate\Http\{JsonResponse, Request};

class SlotController extends Controller
{
    public function available(Request $request): JsonResponse
    {
        $request->validate([
            'studio_id' => ['required', 'integer', 'exists:studios,id'],
            'date'      => ['required', 'date', 'after_or_equal:today'],
        ]);

        // Expire unpaid bookings (in case no queue worker ran), then release lapsed locks
        \App\Models\Booking::expireStale();

        // Release expired locks for this studio
        Slot::where('studio_id', $request->studio_id)
            ->where('status', 'locked')
            ->where('locked_until', '<', now())
            ->update(['status' => 'available', 'locked_until' => null]);

        $date  = \Carbon\Carbon::parse($request->date)->startOfDay();
        $query = fn () => Slot::where('studio_id', $request->studio_id)->forDate($date->toDateString());

        // Slots used to exist only after someone ran `slots:generate` by hand, so dates past the
        // last run showed nothing. Create the day on demand, within the booking horizon.
        if (! $query()->exists() && $date->lte(today()->addDays(SlotGenerator::HORIZON_DAYS))) {
            SlotGenerator::forDay(Studio::findOrFail($request->studio_id), $date);
        }

        $slots = $query()
            ->orderBy('start_time')
            ->get()
            ->map(fn ($slot) => [
                'id'           => $slot->id,
                'start_time'   => substr($slot->start_time, 0, 5),
                'end_time'     => substr($slot->end_time, 0, 5),
                'is_available' => $slot->status === 'available' && ! $slot->hasStarted(),
            ]);

        return response()->json($slots);
    }
}
