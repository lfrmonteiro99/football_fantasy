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
        Schema::create('tactical_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->onDelete('cascade');
            $table->foreignId('tactic_id')->constrained()->onDelete('cascade');
            $table->foreignId('player_id')->constrained()->onDelete('cascade');
            $table->foreignId('position_id')->constrained()->onDelete('cascade');
            $table->integer('x_coordinate'); // Position on the field (0-100)
            $table->integer('y_coordinate'); // Position on the field (0-100)
            $table->enum('role', ['starter', 'substitute', 'captain', 'vice_captain'])->default('starter');
            $table->integer('formation_slot'); // Which slot in the formation (1-11 for starters)
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Ensure unique position assignments per tactic
            $table->unique(['tactic_id', 'formation_slot', 'role']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tactical_positions');
    }
};
