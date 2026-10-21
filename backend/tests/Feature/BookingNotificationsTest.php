<?php

namespace Tests\Feature;

use App\Models\{Booking, Setting};
use App\Notifications\{BookingReminder, NewBookingAlert};
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BookingNotificationsTest extends TestCase
{
    private function alertedTo(): array
    {
        $to = [];
        Notification::assertSentOnDemand(NewBookingAlert::class, function ($n, $channels, AnonymousNotifiable $who) use (&$to) {
            $to = (array) $who->routes['mail'];

            return true;
        });

        return $to;
    }

    public function test_studio_is_emailed_when_an_online_booking_is_paid(): void
    {
        Notification::fake();
        $this->admin(['email' => 'owner@studio.test']);
        $b = $this->book($this->slot($this->studio()));
        Notification::assertSentOnDemandTimes(NewBookingAlert::class, 0); // not paid yet

        $this->notifyMidtrans($b->order_id, 'settlement')->assertOk();

        $this->assertSame(['owner@studio.test'], $this->alertedTo());
    }

    public function test_studio_is_emailed_for_a_pay_at_studio_reservation_to_the_configured_addresses(): void
    {
        Notification::fake();
        Setting::set('admin_notify_email', 'a@studio.test, b@studio.test');

        $this->postJson('/api/bookings', $this->bookingPayload($this->slot($this->studio()), ['payment_method' => 'onsite']))->assertCreated();

        $this->assertSame(['a@studio.test', 'b@studio.test'], $this->alertedTo());
    }

    public function test_admin_taking_cash_does_not_email_the_studio_again(): void
    {
        $admin = $this->admin();
        $id = $this->postJson('/api/bookings', $this->bookingPayload($this->slot($this->studio()), ['payment_method' => 'onsite']))->json('booking_id');
        Notification::fake();

        $this->asUser($admin)->patchJson("/api/admin/bookings/{$id}/confirm", ['cash_received' => 50000])->assertOk();

        Notification::assertSentOnDemandTimes(NewBookingAlert::class, 0);
    }

    public function test_notify_address_is_validated(): void
    {
        $this->asUser($this->admin())->putJson('/api/admin/mail-settings', [
            'mail_host' => 'smtp.gmail.com', 'mail_port' => 587, 'mail_encryption' => 'tls',
            'mail_from_address' => 'studio@gmail.com', 'admin_notify_email' => 'ok@studio.test, nope',
        ])->assertUnprocessable()->assertJsonValidationErrors('admin_notify_email');
    }

    public function test_reminder_goes_out_once_the_day_before(): void
    {
        $studio   = $this->studio();
        $date     = $this->weekday(10);
        $tomorrow = $this->book($this->slot($studio, $date));
        $this->notifyMidtrans($tomorrow->order_id, 'settlement');
        $later    = $this->book($this->slot($studio, $date->copy()->addDay()->isWeekend() ? $date->copy()->next('Monday') : $date->copy()->addDay()));
        $this->notifyMidtrans($later->order_id, 'settlement');
        $this->app['cache']->store()->flush();
        $unpaid   = $this->book($this->slot($studio, $date, '11:00'));

        Notification::fake();
        $this->travelTo($date->copy()->subDay()->setTime(9, 0));

        $this->artisan('bookings:remind')->assertSuccessful();
        $this->artisan('bookings:remind')->assertSuccessful(); // rerun: nothing new

        Notification::assertSentOnDemandTimes(BookingReminder::class, 1);
        Notification::assertSentOnDemand(BookingReminder::class, fn ($n, $c, $who) => $who->routes['mail'] === $tomorrow->customer_email);
        $this->assertNotNull($tomorrow->fresh()->reminded_at);
        $this->assertNull($later->fresh()->reminded_at);
        $this->assertNull(Booking::find($unpaid->id)->reminded_at);
    }

    public function test_notify_address_can_be_saved_while_smtp_comes_from_env(): void
    {
        $admin = $this->admin();
        $this->asUser($admin)->putJson('/api/admin/mail-settings', ['mail_host' => '', 'mail_from_address' => '', 'admin_notify_email' => 'owner@studio.test'])
            ->assertOk();
        $this->assertSame('owner@studio.test', Setting::get('admin_notify_email'));

        $this->asUser($admin)->putJson('/api/admin/mail-settings', ['mail_host' => 'smtp.gmail.com'])
            ->assertUnprocessable()->assertJsonValidationErrors(['mail_port', 'mail_from_address']);
    }

    public function test_settings_page_reports_smtp_from_env(): void
    {
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => 'smtp.gmail.com', 'mail.mailers.smtp.username' => 'studio@gmail.com',
            'mail.mailers.smtp.password' => 'app-password', 'mail.from.address' => 'studio@gmail.com']);

        $this->asUser($this->admin())->getJson('/api/admin/mail-settings')
            ->assertJsonPath('env_smtp', ['host' => 'smtp.gmail.com', 'from' => 'studio@gmail.com'])
            ->assertJsonMissingPath('mail_password');
    }
}
