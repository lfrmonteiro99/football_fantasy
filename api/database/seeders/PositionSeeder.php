<?php

namespace Database\Seeders;

use App\Models\Position;
use Illuminate\Database\Seeder;

class PositionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $positions = [
            // Goalkeepers
            [
                'name' => 'Goalkeeper',
                'short_name' => 'GK',
                'category' => 'goalkeeper',
                'key_attributes' => ['handling', 'reflexes', 'aerial_reach', 'one_on_ones', 'command_of_area', 'kicking', 'throwing', 'communication']
            ],
            
            // Defenders
            [
                'name' => 'Centre-Back',
                'short_name' => 'CB',
                'category' => 'defender',
                'key_attributes' => ['tackling', 'marking', 'heading', 'positioning', 'strength', 'concentration', 'jumping_reach']
            ],
            [
                'name' => 'Left-Back',
                'short_name' => 'LB',
                'category' => 'defender',
                'key_attributes' => ['tackling', 'marking', 'crossing', 'pace', 'stamina', 'positioning', 'work_rate']
            ],
            [
                'name' => 'Right-Back',
                'short_name' => 'RB',
                'category' => 'defender',
                'key_attributes' => ['tackling', 'marking', 'crossing', 'pace', 'stamina', 'positioning', 'work_rate']
            ],
            [
                'name' => 'Wing-Back',
                'short_name' => 'WB',
                'category' => 'defender',
                'key_attributes' => ['crossing', 'pace', 'stamina', 'tackling', 'dribbling', 'work_rate', 'off_the_ball']
            ],
            [
                'name' => 'Sweeper',
                'short_name' => 'SW',
                'category' => 'defender',
                'key_attributes' => ['tackling', 'marking', 'passing', 'anticipation', 'positioning', 'composure', 'concentration']
            ],
            
            // Midfielders
            [
                'name' => 'Defensive Midfielder',
                'short_name' => 'DM',
                'category' => 'midfielder',
                'key_attributes' => ['tackling', 'marking', 'passing', 'work_rate', 'positioning', 'teamwork', 'decisions']
            ],
            [
                'name' => 'Central Midfielder',
                'short_name' => 'CM',
                'category' => 'midfielder',
                'key_attributes' => ['passing', 'vision', 'technique', 'first_touch', 'stamina', 'teamwork', 'decisions']
            ],
            [
                'name' => 'Attacking Midfielder',
                'short_name' => 'AM',
                'category' => 'midfielder',
                'key_attributes' => ['passing', 'vision', 'technique', 'dribbling', 'long_shots', 'flair', 'off_the_ball']
            ],
            [
                'name' => 'Left Midfielder',
                'short_name' => 'LM',
                'category' => 'midfielder',
                'key_attributes' => ['crossing', 'dribbling', 'pace', 'stamina', 'passing', 'work_rate', 'off_the_ball']
            ],
            [
                'name' => 'Right Midfielder',
                'short_name' => 'RM',
                'category' => 'midfielder',
                'key_attributes' => ['crossing', 'dribbling', 'pace', 'stamina', 'passing', 'work_rate', 'off_the_ball']
            ],
            
            // Forwards
            [
                'name' => 'Striker',
                'short_name' => 'ST',
                'category' => 'forward',
                'key_attributes' => ['finishing', 'off_the_ball', 'composure', 'heading', 'pace', 'first_touch', 'acceleration']
            ],
            [
                'name' => 'Centre-Forward',
                'short_name' => 'CF',
                'category' => 'forward',
                'key_attributes' => ['finishing', 'off_the_ball', 'strength', 'heading', 'first_touch', 'dribbling', 'technique']
            ],
            [
                'name' => 'Left Winger',
                'short_name' => 'LW',
                'category' => 'forward',
                'key_attributes' => ['dribbling', 'pace', 'crossing', 'finishing', 'acceleration', 'flair', 'off_the_ball']
            ],
            [
                'name' => 'Right Winger',
                'short_name' => 'RW',
                'category' => 'forward',
                'key_attributes' => ['dribbling', 'pace', 'crossing', 'finishing', 'acceleration', 'flair', 'off_the_ball']
            ],
            [
                'name' => 'False 9',
                'short_name' => 'F9',
                'category' => 'forward',
                'key_attributes' => ['passing', 'vision', 'dribbling', 'finishing', 'technique', 'off_the_ball', 'first_touch']
            ],
        ];

        foreach ($positions as $position) {
            Position::create($position);
        }
    }
}
