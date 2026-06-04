<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingConfirmed extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(private \App\Models\Booking $booking) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $booking = $this->booking;
        $slot    = $booking->slot;
        $package = $booking->package;

        return (new MailMessage)
            ->subject('Booking Dikonfirmasi — ' . config('app.name'))
            ->greeting('Halo, ' . $booking->customer_name . '!')
            ->line('Pembayaran berhasil dan booking Anda telah dikonfirmasi.')
            ->line("**Paket:** {$package->name}")
            ->line("**Tanggal:** " . \Carbon\Carbon::parse($slot->date)->translatedFormat('l, d F Y'))
            ->line("**Waktu:** {$slot->start_time} – {$slot->end_time}")
            ->line("**Order ID:** {$booking->order_id}")
            ->action('Lihat Detail', config('app.frontend_url') . '/booking/' . $booking->id)
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
