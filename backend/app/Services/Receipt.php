<?php

namespace App\Services;

use App\Models\Booking;
use Barryvdh\DomPDF\Facade\Pdf;

/** Payment receipt (struk) as a PDF — only for bookings that are actually paid. */
class Receipt
{
    public static function available(Booking $booking): bool
    {
        return $booking->payment?->status === 'paid';
    }

    public static function number(Booking $booking): string
    {
        return 'INV-' . ($booking->payment->paid_at ?? $booking->confirmed_at ?? now())->format('Ymd') . '-' . str_pad((string) $booking->id, 5, '0', STR_PAD_LEFT);
    }

    public static function filename(Booking $booking): string
    {
        return 'Struk-' . $booking->order_id . '.pdf';
    }

    /** Raw PDF bytes. */
    public static function render(Booking $booking): string
    {
        $b = $booking->loadMissing(['studio', 'slot', 'payment', 'promoCode']);
        $p = $b->payment;

        $method = match ($p->method) {
            null, ''        => $p->gateway === 'cash' ? 'Tunai' : 'Online',
            'cash'          => 'Tunai',
            'promo'         => 'Promo 100%',
            'qris'          => 'QRIS',
            'bank_transfer' => 'Transfer Bank',
            'credit_card'   => 'Kartu Kredit',
            default         => ucwords(str_replace('_', ' ', $p->method)),
        };

        return Pdf::loadView('pdf.receipt', [
            'b'        => $b,
            'p'        => $p,
            'number'   => self::number($b),
            'method'   => $method,
            'subtotal' => $p->amount + (int) $b->discount_amount,
            'date'     => \Carbon\Carbon::parse($b->slot->date)->locale('id')->translatedFormat('l, d F Y'),
            'paidAt'   => ($p->paid_at ?? $b->confirmed_at)?->locale('id')->translatedFormat('d F Y, H:i'),
        ])->setPaper('a5')->setOption('isFontSubsettingEnabled', true)->output();
    }

    public static function rupiah(?int $n): string
    {
        return 'Rp ' . number_format((int) $n, 0, ',', '.');
    }
}
