<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * - package_id: bookings are priced per studio now, so the package is optional.
     * - slot_id: a slot can have many bookings over time (expired/cancelled ones stay
     *   as history). Double-booking is prevented by the slot status lock instead.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedBigInteger('package_id')->nullable()->change();

            // FK needs an index on slot_id, so add the plain one before dropping the unique
            $table->index('slot_id');
            $table->dropUnique(['slot_id']);
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->unique('slot_id');
            $table->dropIndex(['slot_id']);

            $table->unsignedBigInteger('package_id')->nullable(false)->change();
        });
    }
};
