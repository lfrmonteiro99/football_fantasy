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
        Schema::create('tactics', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('formation_id')->constrained()->onDelete('cascade');
            
            // Tactical Instructions
            $table->enum('mentality', ['very_defensive', 'defensive', 'balanced', 'attacking', 'very_attacking'])->default('balanced');
            $table->enum('team_instructions', ['control_possession', 'direct_passing', 'short_passing', 'mixed'])->default('mixed');
            $table->enum('defensive_line', ['very_deep', 'deep', 'standard', 'high', 'very_high'])->default('standard');
            $table->enum('pressing', ['never', 'rarely', 'sometimes', 'often', 'always'])->default('sometimes');
            $table->enum('tempo', ['very_slow', 'slow', 'standard', 'fast', 'very_fast'])->default('standard');
            $table->enum('width', ['very_narrow', 'narrow', 'standard', 'wide', 'very_wide'])->default('standard');
            
            // Additional tactical settings
            $table->boolean('offside_trap')->default(false);
            $table->boolean('play_out_of_defence')->default(false);
            $table->boolean('use_offside_trap')->default(false);
            $table->boolean('close_down_more')->default(false);
            $table->boolean('tackle_harder')->default(false);
            $table->boolean('get_stuck_in')->default(false);
            
            // Per-tactic custom formation and player assignments
            $table->json('custom_positions')->nullable();
            $table->json('player_assignments')->nullable();
            $table->timestamps();
        });

        // If the columns already exist, this will be a no-op in SQLite.
        if (!Schema::hasColumn('tactics', 'player_assignments')) {
            Schema::table('tactics', function (Blueprint $table) {
                $table->json('player_assignments')->nullable();
            });
        }
        if (!Schema::hasColumn('tactics', 'custom_positions')) {
            Schema::table('tactics', function (Blueprint $table) {
                $table->json('custom_positions')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tactics');
    }
};
