<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Queued and sent only after the surrounding DB transaction commits, so a mail
 * failure can never roll back a confirmed payment.
 */
class BookingConfirmed extends Notification implements ShouldQueue
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
        $booking = $this->booking->loadMissing(['studio', 'slot']);
        $slot    = $booking->slot;

        return (new MailMessage)
            ->subject('Booking Dikonfirmasi — ' . config('app.name'))
            ->greeting('Halo, ' . $booking->customer_name . '!')
            ->line('Pembayaran berhasil dan booking kamu sudah dikonfirmasi.')
            ->line("**Studio:** {$booking->studio?->name}")
            ->line('**Tanggal:** ' . \Carbon\Carbon::parse($slot->date)->locale('id')->translatedFormat('l, d F Y'))
            ->line('**Waktu:** ' . substr($slot->start_time, 0, 5) . ' – ' . substr($slot->end_time, 0, 5))
            ->line("**Order ID:** {$booking->order_id}")
            ->line('Sampai jumpa di studio!');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'order_id'   => $this->booking->order_id,
        ];
    }
}
