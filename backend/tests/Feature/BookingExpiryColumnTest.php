<?php

namespace Tests\Feature;

use Tests\TestCase;

class BookingExpiryColumnTest extends TestCase
{
    /** Updating a booking must not reset its expiry (MariaDB "ON UPDATE CURRENT_TIMESTAMP" trap). */
    public function test_updating_a_booking_keeps_its_expiry(): void
    {
        $b = $this->book($this->slot($this->studio()), ['payment_method' => 'onsite']);
        $expires = $b->fresh()->expires_at->toDateTimeString();
        $this->travel(5)->minutes();

        $b->update(['customer_name' => 'Nama Baru']);

        $this->assertSame($expires, $b->fresh()->expires_at->toDateTimeString());
    }
}
