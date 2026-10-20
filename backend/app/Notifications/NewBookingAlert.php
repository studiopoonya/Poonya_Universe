<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Tells the studio a booking came in (paid online, free promo, pay-at-studio reservation, or moved). */
class NewBookingAlert extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param  string  $kind  confirmed | rescheduled | onsite */
    public function __construct(private \App\Models\Booking $booking, private string $kind = 'confirmed')
    {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $b = $this->booking->loadMissing(['studio', 'slot', 'payment']);
        $p = $b->payment;

        $amount  = 'Rp ' . number_format((int) $p?->amount, 0, ',', '.');
        $payment = match (true) {
            $this->kind === 'onsite' => "Bayar di studio (belum dibayar) — {$amount}",
            $p?->method === 'promo'  => 'Gratis (promo 100%)',
            default                  => 'Lunas online' . ($p?->method ? ' via ' . strtoupper($p->method) : '') . " — {$amount}",
        };

        return (new MailMessage)
            ->subject(match ($this->kind) {
                'rescheduled' => '🔁 Jadwal Diubah',
                'onsite'      => '🧾 Reservasi Baru (Bayar di Studio)',
                default       => '🎉 Booking Baru',
            } . " — {$b->customer_name}, " . \Carbon\Carbon::parse($b->slot->date)->locale('id')->translatedFormat('D d M') . ' ' . $b->timeRange())
            ->greeting(match ($this->kind) {
                'rescheduled' => 'Customer mengubah jadwal booking.',
                'onsite'      => 'Ada reservasi baru, bayar di studio.',
                default       => 'Ada booking baru masuk!',
            })
            ->line("**Studio:** {$b->studio?->name}")
            ->line('**Jadwal:** ' . \Carbon\Carbon::parse($b->slot->date)->locale('id')->translatedFormat('l, d F Y') . ', ' . $b->timeRange() . ' WIB (' . ($b->sessions * 30) . ' menit)')
            ->line("**Customer:** {$b->customer_name}")
            ->line("**Email:** {$b->customer_email}")
            ->lineIf((bool) $b->customer_phone, "**No. HP:** {$b->customer_phone}")
            ->line("**Pembayaran:** {$payment}")
            ->line("**Order ID:** {$b->order_id}")
            ->action('Buka di Admin', rtrim(config('app.frontend_url'), '/') . '/admin/bookings?search=' . urlencode($b->order_id));
    }
}
