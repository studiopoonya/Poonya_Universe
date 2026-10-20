<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * 'refund_pending': money was received but the customer has no session (paid after the
     * booking expired, or a paid booking was cancelled). Admin refunds it, then marks 'refunded'.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE payments MODIFY status ENUM('pending','paid','failed','refund_pending','refunded') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::table('payments')->where('status', 'refund_pending')->update(['status' => 'paid']);
        DB::statement("ALTER TABLE payments MODIFY status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending'");
    }
};
