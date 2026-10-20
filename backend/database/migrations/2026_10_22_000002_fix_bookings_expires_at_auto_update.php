<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * On MariaDB/MySQL with explicit_defaults_for_timestamp=OFF (XAMPP default), the first
     * NOT NULL timestamp column silently gets "DEFAULT CURRENT_TIMESTAMP ON UPDATE
     * CURRENT_TIMESTAMP". bookings.expires_at got it, so ANY update to a booking reset its
     * expiry to "now". Redefine it as a plain nullable timestamp (values are kept).
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE bookings MODIFY expires_at TIMESTAMP NULL DEFAULT NULL');
    }

    public function down(): void
    {
        // Intentionally not restoring the auto-update behaviour
    }
};
