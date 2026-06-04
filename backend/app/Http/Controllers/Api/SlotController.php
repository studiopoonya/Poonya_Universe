<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Slot;
use Illuminate\Http\{JsonResponse, Request};

class SlotController extends Controller
{
    public function available(Request $request): JsonResponse
    {
        $request->validate([
            'studio_id' => ['required', 'integer', 'exists:studios,id'],
            'date'      => ['required', 'date', 'after_or_equal:today'],
        ]);

        // Release expired locks for this studio
        Slot::where('studio_id', $request->studio_id)
            ->where('status', 'locked')
            ->where('locked_until', '<', now())
            ->update(['status' => 'available', 'locked_until' => null]);

        $slots = Slot::where('studio_id', $request->studio_id)
            ->forDate($request->date)
            ->orderBy('start_time')
            ->get()
            ->map(fn ($slot) => [
                'id'           => $slot->id,
                'start_time'   => substr($slot->start_time, 0, 5),
                'end_time'     => substr($slot->end_time, 0, 5),
                'is_available' => $slot->status === 'available',
            ]);

        return response()->json($slots);
    }
}
