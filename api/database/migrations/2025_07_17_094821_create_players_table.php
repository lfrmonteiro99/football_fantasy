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
        Schema::create('players', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('last_name');
            $table->date('date_of_birth');
            $table->string('nationality');
            $table->enum('preferred_foot', ['left', 'right', 'both'])->default('right');
            $table->integer('height_cm'); // Height in centimeters
            $table->integer('weight_kg'); // Weight in kilograms
            $table->foreignId('team_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('primary_position_id')->constrained('positions');
            $table->json('secondary_positions')->nullable(); // Array of position IDs
            $table->decimal('market_value', 15, 2)->default(0);
            $table->decimal('wage_per_week', 10, 2)->default(0);
            $table->date('contract_start')->nullable();
            $table->date('contract_end')->nullable();
            $table->integer('shirt_number')->nullable();
            $table->boolean('is_injured')->default(false);
            $table->date('injury_return_date')->nullable();
            $table->timestamps();
            
            // Ensure unique shirt numbers per team
            $table->unique(['team_id', 'shirt_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('players');
    }
};
