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
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('league_id')->constrained()->onDelete('cascade');
            $table->foreignId('primary_tactic_id')->nullable();
            $table->string('name');
            $table->string('short_name', 3);
            $table->string('city');
            $table->string('stadium_name')->nullable();
            $table->integer('stadium_capacity')->nullable();
            $table->decimal('budget', 15, 2)->default(0); // Budget in currency
            $table->decimal('reputation', 3, 1)->default(5.0); // 1-10 scale
            $table->string('primary_color', 7)->default('#000000'); // Hex color
            $table->string('secondary_color', 7)->default('#FFFFFF'); // Hex color
            $table->year('founded_year')->nullable();
            $table->timestamps();

            // Add indexes
            $table->index('league_id');
            $table->index('reputation');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teams');
    }
};
