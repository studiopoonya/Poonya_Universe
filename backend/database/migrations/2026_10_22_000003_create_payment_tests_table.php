<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Small test charges from admin Settings ("Tes Pembayaran"), kept apart from bookings. */
    public function up(): void
    {
        Schema::create('payment_tests', function (Blueprint $table) {
            $table->id();
            $table->string('order_id', 64)->unique();
            $table->string('provider', 20);
            $table->unsignedInteger('amount');
            $table->enum('status', ['pending', 'paid', 'failed'])->default('pending');
            $table->string('method', 64)->nullable();
            $table->json('gateway_payload')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_tests');
    }
};
