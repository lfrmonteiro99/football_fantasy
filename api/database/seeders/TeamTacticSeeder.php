<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\Tactic;
use Illuminate\Database\Seeder;

class TeamTacticSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $teams = Team::all();
        $tactics = Tactic::with('formation')->get();
        
        if ($teams->isEmpty()) {
            $this->command->error('No teams found. Please run TeamSeeder first.');
            return;
        }
        
        if ($tactics->isEmpty()) {
            $this->command->error('No tactics found. Please run TacticSeeder first.');
            return;
        }

        // Define realistic team-tactic combinations based on real football
        $teamTacticMappings = [
            // Premier League Teams
            'Manchester United' => ['Gegenpressing', 'Wing Play', 'High Press'],
            'Manchester City' => ['Tiki-Taka', 'Possession Play', 'High Press'],
            'Liverpool' => ['Gegenpressing', 'High Press', 'Counter Attack'],
            'Chelsea' => ['Possession Play', 'Through the Middle', 'Tiki-Taka'],
            'Arsenal' => ['Tiki-Taka', 'Possession Play', 'Through the Middle'],
            'Tottenham' => ['High Press', 'Counter Attack', 'Wing Play'],
            
            // La Liga Teams
            'Real Madrid' => ['Counter Attack', 'Wing Play', 'High Press'],
            'Barcelona' => ['Tiki-Taka', 'Possession Play', 'Through the Middle'],
            'Atletico Madrid' => ['Catenaccio', 'Counter Attack', 'Park the Bus'],
            
            // Serie A Teams
            'Juventus' => ['Catenaccio', 'Possession Play', 'Counter Attack'],
            'AC Milan' => ['Counter Attack', 'Wing Play', 'High Press'],
            'Inter Milan' => ['Catenaccio', 'Counter Attack', 'Through the Middle'],
            
            // Bundesliga Teams
            'Bayern Munich' => ['Gegenpressing', 'High Press', 'Tiki-Taka'],
            'Borussia Dortmund' => ['Gegenpressing', 'High Press', 'Counter Attack'],
            
            // Ligue 1 Teams
            'Paris Saint-Germain' => ['Possession Play', 'Counter Attack', 'Wing Play'],
        ];

        $assignedCount = 0;
        
        foreach ($teams as $team) {
            $teamName = $team->name;
            
            // Get tactics for this team or use random ones
            $tacticNames = $teamTacticMappings[$teamName] ?? [];
            
            if (empty($tacticNames)) {
                // For teams not in our mapping, assign random tactics based on team reputation
                $reputation = (float) $team->reputation;
                
                if ($reputation >= 8.5) {
                    // Top teams get attacking tactics
                    $tacticNames = ['Tiki-Taka', 'Gegenpressing', 'High Press'];
                } elseif ($reputation >= 7.0) {
                    // Good teams get balanced tactics
                    $tacticNames = ['Possession Play', 'Counter Attack', 'Wing Play'];
                } else {
                    // Lower reputation teams get defensive tactics
                    $tacticNames = ['Catenaccio', 'Park the Bus', 'Counter Attack'];
                }
            }
            
            // Assign tactics to team
            foreach ($tacticNames as $index => $tacticName) {
                $tactic = $tactics->where('name', $tacticName)->first();
                
                if ($tactic) {
                    $isPrimary = $index === 0; // First tactic is primary
                    
                    // Check if already assigned
                    if (!$team->tactics()->where('tactic_id', $tactic->id)->exists()) {
                        $team->tactics()->attach($tactic->id, [
                            'is_primary' => $isPrimary,
                            'is_active' => true,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        $assignedCount++;
                    }
                }
            }
        }

        // Assign additional random tactics to teams that might need more variety
        foreach ($teams as $team) {
            $currentTacticsCount = $team->tactics()->count();
            
            if ($currentTacticsCount < 3) {
                // Add more tactics to reach at least 3 per team
                $availableTactics = $tactics->whereNotIn('id', $team->tactics()->pluck('tactic_id'));
                $tacticsToAdd = min(3 - $currentTacticsCount, $availableTactics->count());
                
                $randomTactics = $availableTactics->random(min($tacticsToAdd, $availableTactics->count()));
                
                foreach ($randomTactics as $tactic) {
                    $team->tactics()->attach($tactic->id, [
                        'is_primary' => false,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $assignedCount++;
                }
            }
        }

        $this->command->info("Successfully assigned {$assignedCount} team-tactic combinations!");
        
        // Show some statistics
        $this->command->info("\nTeam-Tactic Statistics:");
        foreach ($teams->take(5) as $team) {
            $teamTactics = $team->tactics()->with('formation')->get();
            $primaryTactic = $teamTactics->where('pivot.is_primary', true)->first();
            
            $this->command->line("• {$team->name}: {$teamTactics->count()} tactics" . 
                ($primaryTactic ? " (Primary: {$primaryTactic->name})" : ""));
        }
    }
} 