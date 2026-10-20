<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** The Accounts page creates 'staff' users, but the enum only allowed customer/admin. */
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('customer','admin','staff') NOT NULL DEFAULT 'customer'");
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'staff')->update(['role' => 'customer']);
        DB::statement("ALTER TABLE users MODIFY role ENUM('customer','admin') NOT NULL DEFAULT 'customer'");
    }
};
