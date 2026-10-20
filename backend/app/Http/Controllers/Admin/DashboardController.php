<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Payment, Slot};
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        Booking::expireStale();

        $monthStart = now()->startOfMonth();
        $monthEnd   = now()->endOfMonth();

        $totalRevenue = Payment::where('status', 'paid')
            ->whereBetween('paid_at', [$monthStart, $monthEnd])
            ->sum('amount');

        $totalBookings = Booking::whereBetween('created_at', [$monthStart, $monthEnd])->count();

        $confirmedBookings = Booking::where('status', 'confirmed')
            ->whereBetween('created_at', [$monthStart, $monthEnd])
            ->count();

        $upcomingToday = Booking::where('status', 'confirmed')
            ->whereHas('slot', fn ($q) => $q->where('date', today()))
            ->count();

        $recentBookings = Booking::with(['studio', 'slot', 'payment'])
            ->latest()
            ->limit(10)
            ->get();

        $revenueByDay = Payment::where('status', 'paid')
            ->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->select(DB::raw('DATE(paid_at) as date'), DB::raw('SUM(amount) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'stats' => [
                'total_revenue'      => $totalRevenue,
                'total_bookings'     => $totalBookings,
                'confirmed_bookings' => $confirmedBookings,
                'upcoming_today'     => $upcomingToday,
            ],
            'recent_bookings' => $recentBookings,
            'revenue_by_day'  => $revenueByDay,
        ]);
    }
}
