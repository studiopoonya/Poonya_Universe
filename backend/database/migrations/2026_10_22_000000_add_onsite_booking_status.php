<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * 'onsite': reserved to pay at the studio. Its slots are NOT locked — anyone paying
     * online first takes them and the onsite reservation is cancelled.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE bookings MODIFY status ENUM('pending','onsite','confirmed','cancelled','expired') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::table('bookings')->where('status', 'onsite')->update(['status' => 'cancelled']);
        DB::statement("ALTER TABLE bookings MODIFY status ENUM('pending','confirmed','cancelled','expired') NOT NULL DEFAULT 'pending'");
    }
};
