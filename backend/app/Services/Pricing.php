<?php

namespace App\Services;

use App\Models\{PromoCode, Slot, Studio};
use Carbon\Carbon;

/**
 * Single source of truth for what a booking costs: weekday/weekend studio price
 * minus an optional promo code. Used by the quote endpoint, customer booking and
 * walk-in booking, so the price shown is always the price charged.
 */
class Pricing
{
    /**
     * @return array{per_session:int, sessions:int, base_price:int, is_weekend:bool, discount:int, total:int, promo:?PromoCode, promo_error:?string}
     */
    public static function quote(Studio $studio, Slot $slot, ?string $promoCode = null, int $sessions = 1): array
    {
        $isWeekend = Carbon::parse($slot->date)->isWeekend();
        $perSession = $isWeekend && $studio->weekend_price ? (int) $studio->weekend_price : (int) $studio->price;
        $base       = $perSession * max(1, $sessions); // promo applies to the whole booking

        $promo = null;
        $error = null;
        $code  = strtoupper(trim((string) $promoCode));

        if ($code !== '') {
            $promo = PromoCode::where('code', $code)->first();
            $error = $promo ? $promo->unusableReason() : 'Kode promo tidak ditemukan.';
            if ($error) $promo = null;
        }

        $discount = $promo ? $promo->discountFor($base) : 0;

        return [
            'per_session' => $perSession,
            'sessions'    => max(1, $sessions),
            'base_price'  => $base,
            'is_weekend'  => $isWeekend && (bool) $studio->weekend_price,
            'discount'    => $discount,
            'total'       => $base - $discount,
            'promo'       => $promo,
            'promo_error' => $error,
        ];
    }
}
