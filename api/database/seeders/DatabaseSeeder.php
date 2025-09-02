<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Disable foreign key checks
        DB::statement('PRAGMA foreign_keys = OFF;');
        // Truncate tables
        DB::table('player_attributes')->truncate();
        DB::table('players')->truncate();
        DB::table('teams')->truncate();
        DB::table('leagues')->truncate();
        DB::table('positions')->truncate();
        DB::table('formations')->truncate();
        DB::table('tactics')->truncate();
        DB::table('team_tactics')->truncate();
        DB::table('tactical_positions')->truncate();
        // Enable foreign key checks
        DB::statement('PRAGMA foreign_keys = ON;');

        // Run all seeders
        $this->call([
            PositionSeeder::class,
            LeagueSeeder::class,
            TeamSeeder::class,
            PortugueseTeamsSeeder::class,
            FormationSeeder::class,
            TacticSeeder::class,
            TeamTacticSeeder::class,
            PlayerSeeder::class,
        ]);
    }
}
