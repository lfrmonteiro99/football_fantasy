<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Position>
 */
class PositionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $positions = [
            // Goalkeepers
            ['name' => 'Goalkeeper', 'short_name' => 'GK', 'category' => 'goalkeeper', 'key_attributes' => ['handling', 'reflexes', 'aerial_reach', 'one_on_ones', 'command_of_area']],
            
            // Defenders
            ['name' => 'Centre-Back', 'short_name' => 'CB', 'category' => 'defender', 'key_attributes' => ['tackling', 'marking', 'heading', 'positioning', 'strength']],
            ['name' => 'Left-Back', 'short_name' => 'LB', 'category' => 'defender', 'key_attributes' => ['tackling', 'marking', 'crossing', 'pace', 'stamina']],
            ['name' => 'Right-Back', 'short_name' => 'RB', 'category' => 'defender', 'key_attributes' => ['tackling', 'marking', 'crossing', 'pace', 'stamina']],
            ['name' => 'Wing-Back', 'short_name' => 'WB', 'category' => 'defender', 'key_attributes' => ['crossing', 'pace', 'stamina', 'tackling', 'dribbling']],
            ['name' => 'Sweeper', 'short_name' => 'SW', 'category' => 'defender', 'key_attributes' => ['tackling', 'marking', 'passing', 'anticipation', 'positioning']],
            
            // Midfielders
            ['name' => 'Defensive Midfielder', 'short_name' => 'DM', 'category' => 'midfielder', 'key_attributes' => ['tackling', 'marking', 'passing', 'work_rate', 'positioning']],
            ['name' => 'Central Midfielder', 'short_name' => 'CM', 'category' => 'midfielder', 'key_attributes' => ['passing', 'vision', 'technique', 'first_touch', 'stamina']],
            ['name' => 'Attacking Midfielder', 'short_name' => 'AM', 'category' => 'midfielder', 'key_attributes' => ['passing', 'vision', 'technique', 'dribbling', 'long_shots']],
            ['name' => 'Left Midfielder', 'short_name' => 'LM', 'category' => 'midfielder', 'key_attributes' => ['crossing', 'dribbling', 'pace', 'stamina', 'passing']],
            ['name' => 'Right Midfielder', 'short_name' => 'RM', 'category' => 'midfielder', 'key_attributes' => ['crossing', 'dribbling', 'pace', 'stamina', 'passing']],
            
            // Forwards
            ['name' => 'Striker', 'short_name' => 'ST', 'category' => 'forward', 'key_attributes' => ['finishing', 'off_the_ball', 'composure', 'heading', 'pace']],
            ['name' => 'Centre-Forward', 'short_name' => 'CF', 'category' => 'forward', 'key_attributes' => ['finishing', 'off_the_ball', 'strength', 'heading', 'first_touch']],
            ['name' => 'Left Winger', 'short_name' => 'LW', 'category' => 'forward', 'key_attributes' => ['dribbling', 'pace', 'crossing', 'finishing', 'acceleration']],
            ['name' => 'Right Winger', 'short_name' => 'RW', 'category' => 'forward', 'key_attributes' => ['dribbling', 'pace', 'crossing', 'finishing', 'acceleration']],
            ['name' => 'False 9', 'short_name' => 'F9', 'category' => 'forward', 'key_attributes' => ['passing', 'vision', 'dribbling', 'finishing', 'technique']],
        ];

        $position = $this->faker->randomElement($positions);

        return [
            'name' => $position['name'],
            'short_name' => $position['short_name'],
            'category' => $position['category'],
            'key_attributes' => $position['key_attributes'],
        ];
    }
}
