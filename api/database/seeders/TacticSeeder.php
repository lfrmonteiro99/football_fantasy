<?php

namespace Database\Seeders;

use App\Models\Tactic;
use App\Models\Formation;
use Illuminate\Database\Seeder;

class TacticSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get all formations to distribute tactics across them
        $formations = Formation::all();
        
        if ($formations->isEmpty()) {
            $this->command->error('No formations found. Please run FormationSeeder first.');
            return;
        }

        // Create specific well-known tactics
        $specificTactics = [
            [
                'name' => 'Tiki-Taka',
                'description' => 'Short passing game with high possession, popularized by Barcelona and Spain',
                'formation_id' => $formations->where('name', '4-3-3')->first()?->id ?? $formations->first()->id,
                'mentality' => 'attacking',
                'team_instructions' => 'short_passing',
                'defensive_line' => 'high',
                'pressing' => 'often',
                'tempo' => 'fast',
                'width' => 'wide',
                'offside_trap' => true,
                'play_out_of_defence' => true,
                'use_offside_trap' => true,
                'close_down_more' => true,
                'tackle_harder' => false,
                'get_stuck_in' => false,
            ],
            [
                'name' => 'Gegenpressing',
                'description' => 'High intensity pressing and quick transitions, perfected by Jürgen Klopp',
                'formation_id' => $formations->where('name', '4-3-3')->first()?->id ?? $formations->first()->id,
                'mentality' => 'very_attacking',
                'team_instructions' => 'direct_passing',
                'defensive_line' => 'very_high',
                'pressing' => 'always',
                'tempo' => 'very_fast',
                'width' => 'wide',
                'offside_trap' => true,
                'play_out_of_defence' => true,
                'use_offside_trap' => true,
                'close_down_more' => true,
                'tackle_harder' => true,
                'get_stuck_in' => true,
            ],
            [
                'name' => 'Catenaccio',
                'description' => 'Defensive solidity with quick counter-attacks, classic Italian style',
                'formation_id' => $formations->where('name', '5-3-2')->first()?->id ?? $formations->first()->id,
                'mentality' => 'very_defensive',
                'team_instructions' => 'direct_passing',
                'defensive_line' => 'deep',
                'pressing' => 'never',
                'tempo' => 'slow',
                'width' => 'narrow',
                'offside_trap' => false,
                'play_out_of_defence' => false,
                'use_offside_trap' => false,
                'close_down_more' => false,
                'tackle_harder' => true,
                'get_stuck_in' => true,
            ],
            [
                'name' => 'Total Football',
                'description' => 'Fluid positional play with versatile players, Dutch philosophy',
                'formation_id' => $formations->where('name', '4-3-3')->first()?->id ?? $formations->first()->id,
                'mentality' => 'attacking',
                'team_instructions' => 'short_passing',
                'defensive_line' => 'high',
                'pressing' => 'often',
                'tempo' => 'fast',
                'width' => 'wide',
                'offside_trap' => true,
                'play_out_of_defence' => true,
                'use_offside_trap' => true,
                'close_down_more' => true,
                'tackle_harder' => false,
                'get_stuck_in' => false,
            ],
            [
                'name' => 'Park the Bus',
                'description' => 'Ultra-defensive approach focusing on clean sheets and set pieces',
                'formation_id' => $formations->where('name', '5-4-1')->first()?->id ?? $formations->where('name', '5-3-2')->first()?->id ?? $formations->first()->id,
                'mentality' => 'very_defensive',
                'team_instructions' => 'control_possession',
                'defensive_line' => 'very_deep',
                'pressing' => 'never',
                'tempo' => 'very_slow',
                'width' => 'very_narrow',
                'offside_trap' => false,
                'play_out_of_defence' => false,
                'use_offside_trap' => false,
                'close_down_more' => false,
                'tackle_harder' => true,
                'get_stuck_in' => true,
            ],
            [
                'name' => 'Counter Attack',
                'description' => 'Absorb pressure and hit opponents on the break with pace',
                'formation_id' => $formations->where('name', '4-4-2')->first()?->id ?? $formations->first()->id,
                'mentality' => 'defensive',
                'team_instructions' => 'direct_passing',
                'defensive_line' => 'deep',
                'pressing' => 'rarely',
                'tempo' => 'very_fast',
                'width' => 'wide',
                'offside_trap' => false,
                'play_out_of_defence' => false,
                'use_offside_trap' => false,
                'close_down_more' => false,
                'tackle_harder' => true,
                'get_stuck_in' => false,
            ],
            [
                'name' => 'High Press',
                'description' => 'Press high up the pitch to win the ball back quickly',
                'formation_id' => $formations->where('name', '4-2-3-1')->first()?->id ?? $formations->first()->id,
                'mentality' => 'attacking',
                'team_instructions' => 'mixed',
                'defensive_line' => 'very_high',
                'pressing' => 'always',
                'tempo' => 'fast',
                'width' => 'standard',
                'offside_trap' => true,
                'play_out_of_defence' => true,
                'use_offside_trap' => true,
                'close_down_more' => true,
                'tackle_harder' => false,
                'get_stuck_in' => true,
            ],
            [
                'name' => 'Possession Play',
                'description' => 'Control the game through ball retention and patient build-up',
                'formation_id' => $formations->where('name', '4-1-4-1')->first()?->id ?? $formations->first()->id,
                'mentality' => 'balanced',
                'team_instructions' => 'control_possession',
                'defensive_line' => 'standard',
                'pressing' => 'sometimes',
                'tempo' => 'slow',
                'width' => 'standard',
                'offside_trap' => false,
                'play_out_of_defence' => true,
                'use_offside_trap' => false,
                'close_down_more' => false,
                'tackle_harder' => false,
                'get_stuck_in' => false,
            ],
            [
                'name' => 'Wing Play',
                'description' => 'Use the flanks to create crossing opportunities and stretch the defense',
                'formation_id' => $formations->where('name', '4-4-2')->first()?->id ?? $formations->first()->id,
                'mentality' => 'attacking',
                'team_instructions' => 'mixed',
                'defensive_line' => 'standard',
                'pressing' => 'sometimes',
                'tempo' => 'fast',
                'width' => 'very_wide',
                'offside_trap' => false,
                'play_out_of_defence' => false,
                'use_offside_trap' => false,
                'close_down_more' => true,
                'tackle_harder' => false,
                'get_stuck_in' => false,
            ],
            [
                'name' => 'Through the Middle',
                'description' => 'Play through the center with intricate passing and movement',
                'formation_id' => $formations->where('name', '4-4-1-1')->first()?->id ?? $formations->where('name', '4-2-3-1')->first()?->id ?? $formations->first()->id,
                'mentality' => 'attacking',
                'team_instructions' => 'short_passing',
                'defensive_line' => 'high',
                'pressing' => 'often',
                'tempo' => 'standard',
                'width' => 'narrow',
                'offside_trap' => true,
                'play_out_of_defence' => true,
                'use_offside_trap' => false,
                'close_down_more' => true,
                'tackle_harder' => false,
                'get_stuck_in' => false,
            ],
        ];

        // Create the specific tactics
        foreach ($specificTactics as $tacticData) {
            Tactic::create($tacticData);
        }

        // Create additional random tactics using the factory
        Tactic::factory()->count(5)->attacking()->create();
        Tactic::factory()->count(5)->defensive()->create();
        Tactic::factory()->count(5)->possession()->create();
        Tactic::factory()->count(5)->counterAttacking()->create();
        Tactic::factory()->count(10)->create(); // Random mixed tactics

        $this->command->info('Created ' . Tactic::count() . ' tactics successfully!');
    }
} 