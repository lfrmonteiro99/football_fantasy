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
        Schema::table('matches', function (Blueprint $table) {
            // Drop the old unique constraint
            $table->dropUnique('unique_match_fixture');
            
            // Add new unique constraint that includes manager_id
            $table->unique([
                'manager_id',
                'league_id', 
                'season_id', 
                'home_team_id', 
                'away_team_id', 
                'matchday'
            ], 'unique_manager_match_fixture');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            // Drop the new unique constraint
            $table->dropUnique('unique_manager_match_fixture');
            
            // Restore the old unique constraint
            $table->unique([
                'league_id', 
                'season_id', 
                'home_team_id', 
                'away_team_id', 
                'matchday'
            ], 'unique_match_fixture');
        });
    }
};
