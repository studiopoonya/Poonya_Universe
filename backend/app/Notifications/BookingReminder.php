<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent the day before the session. */
class BookingReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private \App\Models\Booking $booking)
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
        $onsite = $b->status === 'onsite';

        return (new MailMessage)
            ->subject('Besok Jadwal Foto Kamu — ' . config('app.name'))
            ->greeting('Halo, ' . $b->customer_name . '!')
            ->line('Cuma mengingatkan, besok kamu ada jadwal foto di ' . config('app.name') . ' 📸')
            ->line("**Studio:** {$b->studio?->name}")
            ->line('**Tanggal:** ' . \Carbon\Carbon::parse($b->slot->date)->locale('id')->translatedFormat('l, d F Y'))
            ->line('**Waktu:** ' . $b->timeRange() . ' WIB (' . ($b->sessions * 30) . ' menit)')
            ->line("**Order ID:** {$b->order_id}")
            ->lineIf($onsite, '**Pembayaran:** bayar di studio, Rp ' . number_format((int) $b->payment?->amount, 0, ',', '.') . '. Jadwal ini belum terkunci — bayar via QRIS di halaman Cek Booking supaya aman.')
            ->line('Datang 5–10 menit lebih awal ya, supaya sesimu bisa dimulai tepat waktu.')
            ->action('Lihat Booking', rtrim(config('app.frontend_url'), '/') . '/cek-booking?order_id=' . urlencode($b->order_id))
            ->line('Sampai jumpa besok!');
    }
}
