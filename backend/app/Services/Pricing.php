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
     * @return array{base_price:int, is_weekend:bool, discount:int, total:int, promo:?PromoCode, promo_error:?string}
     */
    public static function quote(Studio $studio, Slot $slot, ?string $promoCode = null): array
    {
        $isWeekend = Carbon::parse($slot->date)->isWeekend();
        $base      = $isWeekend && $studio->weekend_price ? (int) $studio->weekend_price : (int) $studio->price;

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
            'base_price'  => $base,
            'is_weekend'  => $isWeekend && (bool) $studio->weekend_price,
            'discount'    => $discount,
            'total'       => $base - $discount,
            'promo'       => $promo,
            'promo_error' => $error,
        ];
    }
}
