<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Payment};
use Carbon\Carbon;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        Booking::expireStale();

        // ?month=2026-10 to look back; defaults to this month
        $request->validate(['month' => ['nullable', 'date_format:Y-m']]);
        $monthStart = $request->month ? Carbon::createFromFormat('Y-m', $request->month)->startOfMonth() : now()->startOfMonth();
        $monthEnd   = $monthStart->copy()->endOfMonth();

        $paidInMonth = fn () => Payment::where('payments.status', 'paid')->whereBetween('paid_at', [$monthStart, $monthEnd]);

        $totalBookings = Booking::whereBetween('created_at', [$monthStart, $monthEnd])->count();

        $confirmedBookings = Booking::where('status', 'confirmed')
            ->whereBetween('created_at', [$monthStart, $monthEnd])
            ->count();

        $upcomingToday = Booking::where('status', 'confirmed')
            ->whereHas('slot', fn ($q) => $q->where('date', today()->toDateString()))
            ->count();

        $recentBookings = Booking::with(['studio', 'slot', 'payment'])
            ->latest()
            ->limit(10)
            ->get();

        $revenueByDay = $paidInMonth()
            ->select(DB::raw('DATE(paid_at) as date'), DB::raw('SUM(amount) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'total' => (int) $r->total]);

        $revenueByStudio = $paidInMonth()
            ->join('bookings', 'bookings.id', '=', 'payments.booking_id')
            ->join('studios', 'studios.id', '=', 'bookings.studio_id')
            ->groupBy('studios.id', 'studios.name', 'studios.color')
            ->orderByDesc('total')
            ->get(['studios.name', 'studios.color', DB::raw('COUNT(*) as sessions'), DB::raw('SUM(payments.amount) as total')])
            ->map(fn ($r) => ['name' => $r->name, 'color' => $r->color, 'sessions' => (int) $r->sessions, 'total' => (int) $r->total]);

        return response()->json([
            'month' => $monthStart->format('Y-m'),
            'stats' => [
                'total_revenue'      => (int) $paidInMonth()->sum('amount'),
                'total_bookings'     => $totalBookings,
                'confirmed_bookings' => $confirmedBookings,
                'upcoming_today'     => $upcomingToday,
                'pending_refunds'    => Payment::where('status', 'refund_pending')->count(),
            ],
            'recent_bookings'   => $recentBookings,
            'revenue_by_day'    => $revenueByDay,
            'revenue_by_studio' => $revenueByStudio,
        ]);
    }
}
