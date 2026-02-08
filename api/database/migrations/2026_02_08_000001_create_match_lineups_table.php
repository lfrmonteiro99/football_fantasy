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
        Schema::create('match_lineups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_id')->constrained('matches')->onDelete('cascade');
            $table->foreignId('team_id')->constrained('teams')->onDelete('cascade');
            $table->foreignId('player_id')->constrained('players')->onDelete('cascade');
            $table->string('position', 5)->comment('Tactical position abbreviation: GK, CB, LB, RB, DM, CM, AM, LW, RW, ST, etc.');
            $table->boolean('is_starting')->default(true)->comment('true = starting XI, false = bench');
            $table->tinyInteger('sort_order')->default(0)->comment('Display ordering');
            $table->float('x')->nullable()->comment('Custom pitch x coordinate (0-100)');
            $table->float('y')->nullable()->comment('Custom pitch y coordinate (0-100)');
            $table->timestamps();

            $table->unique(['match_id', 'team_id', 'player_id'], 'match_lineups_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('match_lineups');
    }
};
