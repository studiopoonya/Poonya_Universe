<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Optional Saturday/Sunday price; null = same as the weekday price
        Schema::table('studios', function (Blueprint $table) {
            $table->unsignedInteger('weekend_price')->nullable()->after('price');
        });

        Schema::create('promo_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->enum('type', ['percent', 'fixed']);
            $table->unsignedInteger('value');              // percent (1–100) or rupiah
            $table->unsignedInteger('max_uses')->nullable(); // null = unlimited
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('promo_code_id')->nullable()->after('slot_id')->constrained()->nullOnDelete();
            $table->unsignedInteger('discount_amount')->default(0)->after('promo_code_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['promo_code_id']);
            $table->dropColumn(['promo_code_id', 'discount_amount']);
        });
        Schema::dropIfExists('promo_codes');
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('weekend_price');
        });
    }
};
