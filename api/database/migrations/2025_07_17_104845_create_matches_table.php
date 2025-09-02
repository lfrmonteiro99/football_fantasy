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
        Schema::create('matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('league_id')->constrained()->onDelete('cascade');
            $table->foreignId('season_id')->constrained()->onDelete('cascade');
            $table->foreignId('home_team_id')->constrained('teams');
            $table->foreignId('away_team_id')->constrained('teams');
            $table->datetime('match_date');
            $table->time('match_time');
            $table->integer('matchday');
            $table->foreignId('home_formation_id')->nullable()->constrained('formations');
            $table->foreignId('away_formation_id')->nullable()->constrained('formations');
            $table->string('stadium')->nullable();
            $table->string('weather')->nullable();
            $table->integer('temperature')->nullable();
            $table->integer('attendance')->nullable();
            $table->integer('home_score')->default(0);
            $table->integer('away_score')->default(0);
            $table->integer('home_goals')->nullable();
            $table->integer('away_goals')->nullable();
            $table->json('match_stats')->nullable();
            $table->enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled'])->default('scheduled');
            $table->timestamps();

            // Add indexes for performance
            $table->index(['league_id', 'season_id']);
            $table->index('match_date');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('matches');
    }
};
