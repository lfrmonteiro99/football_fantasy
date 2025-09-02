<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            // Add a check constraint to ensure home_team_id != away_team_id
            // Note: SQLite doesn't support CHECK constraints in table alterations,
            // so we'll add a custom validation at the application level
            
            // Add a unique constraint to prevent duplicate fixtures in the same matchday
            $table->unique([
                'league_id', 
                'season_id', 
                'home_team_id', 
                'away_team_id', 
                'matchday'
            ], 'unique_match_fixture');
        });
        
        // Add a custom check using raw SQL (works for most databases)
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE matches ADD CONSTRAINT check_different_teams CHECK (home_team_id != away_team_id)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->dropUnique('unique_match_fixture');
        });
        
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE matches DROP CONSTRAINT check_different_teams');
        }
    }
};