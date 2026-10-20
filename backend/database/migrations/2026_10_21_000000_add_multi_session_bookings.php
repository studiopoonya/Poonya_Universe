<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration
{
    /**
     * A booking can now hold several consecutive slots (e.g. 2 × 30 min = 1 hour).
     * bookings.slot_id stays as the first slot; booking_slot lists every slot held.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedTinyInteger('sessions')->default(1)->after('slot_id');
        });

        Schema::create('booking_slot', function (Blueprint $table) {
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('slot_id')->constrained()->restrictOnDelete();
            $table->primary(['booking_id', 'slot_id']);
            $table->index('slot_id');
        });

        // Existing bookings hold exactly their one slot
        DB::statement('INSERT INTO booking_slot (booking_id, slot_id) SELECT id, slot_id FROM bookings WHERE slot_id IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_slot');
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('sessions');
        });
    }
};
