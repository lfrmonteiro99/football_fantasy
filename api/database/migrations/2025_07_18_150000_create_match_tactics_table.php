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
        Schema::create('match_tactics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_id')->constrained('matches')->onDelete('cascade');
            $table->enum('team_type', ['home', 'away']);
            $table->foreignId('team_id')->constrained('teams')->onDelete('cascade');
            
            // Formation changes
            $table->foreignId('formation_id')->nullable()->constrained('formations')->onDelete('set null');
            $table->json('custom_positions')->nullable(); // Custom position coordinates
            
            // Tactical instruction changes
            $table->string('mentality')->nullable();
            $table->string('team_instructions')->nullable();
            $table->string('pressing')->nullable();
            $table->string('tempo')->nullable();
            $table->string('width')->nullable();
            $table->boolean('offside_trap')->nullable();
            $table->boolean('play_out_of_defence')->nullable();
            $table->boolean('use_offside_trap')->nullable();
            $table->boolean('close_down_more')->nullable();
            $table->boolean('tackle_harder')->nullable();
            $table->boolean('get_stuck_in')->nullable();
            
            // Player assignments for the match
            $table->json('player_assignments')->nullable(); // [position_index => player_id]
            
            // Substitutions made during the match
            $table->json('substitutions')->nullable(); // Array of substitution objects
            
            // When these changes were applied
            $table->integer('applied_at_minute')->default(0);
            
            $table->timestamps();
            
            // Ensure one record per team per match
            $table->unique(['match_id', 'team_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('match_tactics');
    }
}; 