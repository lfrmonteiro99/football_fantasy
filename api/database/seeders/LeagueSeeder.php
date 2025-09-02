<?php

namespace Database\Seeders;

use App\Models\League;
use Illuminate\Database\Seeder;

class LeagueSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $leagues = [
            // England
            ['name' => 'Premier League', 'country' => 'England', 'level' => 1, 'max_teams' => 20, 'reputation' => 9.5],
            ['name' => 'Championship', 'country' => 'England', 'level' => 2, 'max_teams' => 24, 'reputation' => 7.5],
            
            // Spain
            ['name' => 'La Liga', 'country' => 'Spain', 'level' => 1, 'max_teams' => 20, 'reputation' => 9.2],
            ['name' => 'Segunda División', 'country' => 'Spain', 'level' => 2, 'max_teams' => 22, 'reputation' => 7.0],
            
            // Germany
            ['name' => 'Bundesliga', 'country' => 'Germany', 'level' => 1, 'max_teams' => 18, 'reputation' => 8.5],
            ['name' => '2. Bundesliga', 'country' => 'Germany', 'level' => 2, 'max_teams' => 18, 'reputation' => 6.8],
            
            // Italy
            ['name' => 'Serie A', 'country' => 'Italy', 'level' => 1, 'max_teams' => 20, 'reputation' => 8.8],
            ['name' => 'Serie B', 'country' => 'Italy', 'level' => 2, 'max_teams' => 20, 'reputation' => 6.5],
            
            // France
            ['name' => 'Ligue 1', 'country' => 'France', 'level' => 1, 'max_teams' => 20, 'reputation' => 8.0],
            ['name' => 'Ligue 2', 'country' => 'France', 'level' => 2, 'max_teams' => 20, 'reputation' => 6.2],
            
            // Portugal
            ['name' => 'Primeira Liga', 'country' => 'Portugal', 'level' => 1, 'max_teams' => 18, 'reputation' => 7.8],
            ['name' => 'Liga Portugal 2', 'country' => 'Portugal', 'level' => 2, 'max_teams' => 18, 'reputation' => 5.5],
            
            // Netherlands
            ['name' => 'Eredivisie', 'country' => 'Netherlands', 'level' => 1, 'max_teams' => 18, 'reputation' => 7.5],
            ['name' => 'Eerste Divisie', 'country' => 'Netherlands', 'level' => 2, 'max_teams' => 20, 'reputation' => 5.8],
            
            // Belgium
            ['name' => 'Belgian Pro League', 'country' => 'Belgium', 'level' => 1, 'max_teams' => 18, 'reputation' => 6.8],
            
            // Brazil
            ['name' => 'Brasileirão', 'country' => 'Brazil', 'level' => 1, 'max_teams' => 20, 'reputation' => 8.2],
            
            // Argentina
            ['name' => 'Liga Profesional', 'country' => 'Argentina', 'level' => 1, 'max_teams' => 28, 'reputation' => 7.9],
        ];

        foreach ($leagues as $league) {
            League::create($league);
        }
    }
}
