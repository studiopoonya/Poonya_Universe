<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Slots were unique per (date, start_time), which blocks a second studio from
     * having the same time slot. Make them unique per studio instead.
     *
     * Some databases already got this change by hand, so each step checks first.
     */
    public function up(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            if (Schema::hasIndex('slots', ['date', 'start_time'], 'unique')) {
                $table->dropUnique(['date', 'start_time']);
            }
            if (! Schema::hasIndex('slots', ['studio_id', 'date', 'start_time'], 'unique')) {
                $table->unique(['studio_id', 'date', 'start_time'], 'slots_studio_date_time_unique');
            }
        });
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropUnique('slots_studio_date_time_unique');
            $table->unique(['date', 'start_time']);
        });
    }
};
