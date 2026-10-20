<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** For cash payments: what the customer handed over and the change given back. */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedInteger('cash_received')->nullable()->after('amount');
            $table->unsignedInteger('cash_change')->nullable()->after('cash_received');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['cash_received', 'cash_change']);
        });
    }
};
