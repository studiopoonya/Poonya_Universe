<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('studios', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('price');          // price per slot (30 min)
            $table->unsignedTinyInteger('capacity')->default(2); // max people
            $table->json('features')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->string('color', 20)->default('#4f6ef7'); // accent color for card
            $table->boolean('is_active')->default(true);
            $table->tinyInteger('sort_order')->unsigned()->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('studios');
    }
};
