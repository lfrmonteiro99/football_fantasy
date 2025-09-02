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
        Schema::create('player_attributes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained()->onDelete('cascade');
            
            // Technical Attributes (1-20 scale)
            $table->tinyInteger('finishing')->default(10);
            $table->tinyInteger('first_touch')->default(10);
            $table->tinyInteger('free_kick_taking')->default(10);
            $table->tinyInteger('heading')->default(10);
            $table->tinyInteger('long_shots')->default(10);
            $table->tinyInteger('long_throws')->default(10);
            $table->tinyInteger('marking')->default(10);
            $table->tinyInteger('passing')->default(10);
            $table->tinyInteger('penalty_taking')->default(10);
            $table->tinyInteger('tackling')->default(10);
            $table->tinyInteger('technique')->default(10);
            $table->tinyInteger('corners')->default(10);
            $table->tinyInteger('crossing')->default(10);
            $table->tinyInteger('dribbling')->default(10);
            
            // Mental Attributes (1-20 scale)
            $table->tinyInteger('aggression')->default(10);
            $table->tinyInteger('anticipation')->default(10);
            $table->tinyInteger('bravery')->default(10);
            $table->tinyInteger('composure')->default(10);
            $table->tinyInteger('concentration')->default(10);
            $table->tinyInteger('decisions')->default(10);
            $table->tinyInteger('determination')->default(10);
            $table->tinyInteger('flair')->default(10);
            $table->tinyInteger('leadership')->default(10);
            $table->tinyInteger('off_the_ball')->default(10);
            $table->tinyInteger('positioning')->default(10);
            $table->tinyInteger('teamwork')->default(10);
            $table->tinyInteger('vision')->default(10);
            $table->tinyInteger('work_rate')->default(10);
            
            // Physical Attributes (1-20 scale)
            $table->tinyInteger('acceleration')->default(10);
            $table->tinyInteger('agility')->default(10);
            $table->tinyInteger('balance')->default(10);
            $table->tinyInteger('jumping_reach')->default(10);
            $table->tinyInteger('natural_fitness')->default(10);
            $table->tinyInteger('pace')->default(10);
            $table->tinyInteger('stamina')->default(10);
            $table->tinyInteger('strength')->default(10);
            
            // Goalkeeping Attributes (1-20 scale)
            $table->tinyInteger('aerial_reach')->default(10);
            $table->tinyInteger('command_of_area')->default(10);
            $table->tinyInteger('communication')->default(10);
            $table->tinyInteger('eccentricity')->default(10);
            $table->tinyInteger('handling')->default(10);
            $table->tinyInteger('kicking')->default(10);
            $table->tinyInteger('one_on_ones')->default(10);
            $table->tinyInteger('reflexes')->default(10);
            $table->tinyInteger('rushing_out')->default(10);
            $table->tinyInteger('throwing')->default(10);
            
            // Overall ratings calculated from attributes
            $table->decimal('current_ability', 5, 2)->default(50.0); // 0-100 scale
            $table->decimal('potential_ability', 5, 2)->default(50.0); // 0-100 scale
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('player_attributes');
    }
};
