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
        abort_if($slot->status === 'booked', 422, 'Slot sudah dibooking, tidak bisa diblokir.');
        // A paid webhook would flip it to booked and silently undo the block
        abort_if($slot->status === 'locked', 422, 'Slot sedang dalam proses pembayaran. Coba lagi setelah 15 menit.');

        $slot->update(['status' => 'blocked']);

        return response()->json(['message' => 'Slot diblokir.']);
    }

    public function unblock(Slot $slot): JsonResponse
    {
        abort_if($slot->status !== 'blocked', 422, 'Slot tidak sedang diblokir.');

        $slot->update(['status' => 'available']);

        return response()->json(['message' => 'Slot diaktifkan kembali.']);
    }
}
