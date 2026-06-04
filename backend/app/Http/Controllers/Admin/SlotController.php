<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Slot;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\Artisan;

class SlotController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $slots = Slot::when($request->date, fn ($q) => $q->where('date', $request->date))
            ->orderBy('date')
            ->orderBy('start_time')
            ->paginate(50);

        return response()->json($slots);
    }

    public function generate(Request $request): JsonResponse
    {
        $request->validate(['days' => ['required', 'integer', 'min:1', 'max:90']]);

        Artisan::call('slots:generate', ['days' => $request->days]);

        return response()->json(['message' => "Slots generated for {$request->days} days."]);
    }

    public function block(Slot $slot): JsonResponse
    {
        abort_if($slot->status === 'booked', 422, 'Cannot block a booked slot.');

        $slot->update(['status' => 'blocked']);

        return response()->json(['message' => 'Slot diblokir.']);
    }

    public function unblock(Slot $slot): JsonResponse
    {
        abort_if($slot->status !== 'blocked', 422, 'Slot is not blocked.');

        $slot->update(['status' => 'available']);

        return response()->json(['message' => 'Slot diaktifkan kembali.']);
    }
}
