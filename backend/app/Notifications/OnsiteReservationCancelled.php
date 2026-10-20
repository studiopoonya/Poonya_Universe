<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A pay-at-studio reservation lost its slot to someone who paid online first. */
class OnsiteReservationCancelled extends Notification implements ShouldQueue
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
        $b = $this->booking->loadMissing(['studio', 'slot']);

        return (new MailMessage)
            ->subject('Reservasi Kamu Dibatalkan — ' . config('app.name'))
            ->greeting('Halo, ' . $b->customer_name . '!')
            ->line('Maaf, jadwal reservasi "bayar di tempat" kamu sudah diambil customer lain yang membayar online lebih dulu.')
            ->line("**Studio:** {$b->studio?->name}")
            ->line('**Jadwal:** ' . \Carbon\Carbon::parse($b->slot->date)->locale('id')->translatedFormat('l, d F Y') . ', ' . $b->timeRange() . ' WIB')
            ->action('Booking Jadwal Lain', rtrim(config('app.frontend_url'), '/') . '/booking')
            ->line('Tips: bayar langsung via QRIS saat booking supaya jadwal langsung terkunci untukmu.');
    }
}
