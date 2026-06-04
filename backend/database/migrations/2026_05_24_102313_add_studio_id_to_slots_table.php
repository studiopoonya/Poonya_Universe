<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->foreignId('studio_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->index('studio_id');
        });

        // Assign all existing slots to the first studio
        $firstStudio = DB::table('studios')->orderBy('id')->value('id');
        if ($firstStudio) {
            DB::table('slots')->whereNull('studio_id')->update(['studio_id' => $firstStudio]);
        }
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropForeign(['studio_id']);
            $table->dropIndex(['studio_id']);
            $table->dropColumn('studio_id');
        });
    }
};
