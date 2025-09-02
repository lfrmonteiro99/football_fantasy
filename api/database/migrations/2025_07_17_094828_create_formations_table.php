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
        Schema::create('formations', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // e.g., "4-4-2", "4-3-3", "3-5-2"
            $table->string('display_name'); // e.g., "4-4-2 Classic", "4-3-3 Attacking"
            $table->text('description')->nullable();
            $table->json('positions'); // Array of position configurations with x,y coordinates
            $table->enum('style', ['defensive', 'balanced', 'attacking'])->default('balanced');
            $table->integer('defenders_count');
            $table->integer('midfielders_count');
            $table->integer('forwards_count');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('formations');
    }
};
