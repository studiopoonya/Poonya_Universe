<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE payments MODIFY gateway ENUM('midtrans','xendit','stripe','cash') DEFAULT 'midtrans'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE payments MODIFY gateway ENUM('midtrans','xendit','stripe') DEFAULT 'midtrans'");
    }
};
