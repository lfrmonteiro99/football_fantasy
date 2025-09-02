<?php

namespace Database\Seeders;

use App\Models\Formation;
use Illuminate\Database\Seeder;

class FormationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $formations = [
            [
                'name' => '4-4-2',
                'display_name' => '4-4-2 Classic',
                'description' => 'Traditional formation with two banks of four and two strikers',
                'style' => 'balanced',
                'defenders_count' => 4,
                'midfielders_count' => 4,
                'forwards_count' => 2,
                'positions' => [
                    ['x' => 50, 'y' => 5, 'position' => 'GK'],   // Goalkeeper
                    ['x' => 20, 'y' => 25, 'position' => 'LB'],  // Left Back
                    ['x' => 35, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 65, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 80, 'y' => 25, 'position' => 'RB'],  // Right Back
                    ['x' => 20, 'y' => 50, 'position' => 'LM'],  // Left Midfielder
                    ['x' => 35, 'y' => 50, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 65, 'y' => 50, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 80, 'y' => 50, 'position' => 'RM'],  // Right Midfielder
                    ['x' => 40, 'y' => 80, 'position' => 'ST'],  // Striker
                    ['x' => 60, 'y' => 80, 'position' => 'ST'],  // Striker
                ],
                'is_active' => true
            ],
            [
                'name' => '4-3-3',
                'display_name' => '4-3-3 Attacking',
                'description' => 'Attacking formation with three forwards and three midfielders',
                'style' => 'attacking',
                'defenders_count' => 4,
                'midfielders_count' => 3,
                'forwards_count' => 3,
                'positions' => [
                    ['x' => 50, 'y' => 5, 'position' => 'GK'],   // Goalkeeper
                    ['x' => 20, 'y' => 25, 'position' => 'LB'],  // Left Back
                    ['x' => 35, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 65, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 80, 'y' => 25, 'position' => 'RB'],  // Right Back
                    ['x' => 30, 'y' => 45, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 50, 'y' => 45, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 70, 'y' => 45, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 20, 'y' => 75, 'position' => 'LW'],  // Left Winger
                    ['x' => 50, 'y' => 80, 'position' => 'ST'],  // Striker
                    ['x' => 80, 'y' => 75, 'position' => 'RW'],  // Right Winger
                ],
                'is_active' => true
            ],
            [
                'name' => '3-5-2',
                'display_name' => '3-5-2 Wing-backs',
                'description' => 'Formation with three centre-backs and attacking wing-backs',
                'style' => 'balanced',
                'defenders_count' => 3,
                'midfielders_count' => 5,
                'forwards_count' => 2,
                'positions' => [
                    ['x' => 50, 'y' => 5, 'position' => 'GK'],   // Goalkeeper
                    ['x' => 30, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 50, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 70, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 15, 'y' => 45, 'position' => 'WB'],  // Left Wing-back
                    ['x' => 35, 'y' => 50, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 50, 'y' => 50, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 65, 'y' => 50, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 85, 'y' => 45, 'position' => 'WB'],  // Right Wing-back
                    ['x' => 40, 'y' => 80, 'position' => 'ST'],  // Striker
                    ['x' => 60, 'y' => 80, 'position' => 'ST'],  // Striker
                ],
                'is_active' => true
            ],
            [
                'name' => '4-2-3-1',
                'display_name' => '4-2-3-1 Modern',
                'description' => 'Modern formation with two holding midfielders and attacking midfielder',
                'style' => 'balanced',
                'defenders_count' => 4,
                'midfielders_count' => 5,
                'forwards_count' => 1,
                'positions' => [
                    ['x' => 50, 'y' => 5, 'position' => 'GK'],   // Goalkeeper
                    ['x' => 20, 'y' => 25, 'position' => 'LB'],  // Left Back
                    ['x' => 35, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 65, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 80, 'y' => 25, 'position' => 'RB'],  // Right Back
                    ['x' => 40, 'y' => 40, 'position' => 'DM'],  // Defensive Midfielder
                    ['x' => 60, 'y' => 40, 'position' => 'DM'],  // Defensive Midfielder
                    ['x' => 25, 'y' => 60, 'position' => 'LM'],  // Left Midfielder
                    ['x' => 50, 'y' => 60, 'position' => 'AM'],  // Attacking Midfielder
                    ['x' => 75, 'y' => 60, 'position' => 'RM'],  // Right Midfielder
                    ['x' => 50, 'y' => 85, 'position' => 'ST'],  // Striker
                ],
                'is_active' => true
            ],
            [
                'name' => '5-3-2',
                'display_name' => '5-3-2 Defensive',
                'description' => 'Defensive formation with five defenders',
                'style' => 'defensive',
                'defenders_count' => 5,
                'midfielders_count' => 3,
                'forwards_count' => 2,
                'positions' => [
                    ['x' => 50, 'y' => 5, 'position' => 'GK'],   // Goalkeeper
                    ['x' => 15, 'y' => 30, 'position' => 'LB'],  // Left Back
                    ['x' => 30, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 50, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 70, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 85, 'y' => 30, 'position' => 'RB'],  // Right Back
                    ['x' => 35, 'y' => 55, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 50, 'y' => 55, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 65, 'y' => 55, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 40, 'y' => 80, 'position' => 'ST'],  // Striker
                    ['x' => 60, 'y' => 80, 'position' => 'ST'],  // Striker
                ],
                'is_active' => true
            ],
            [
                'name' => '4-1-4-1',
                'display_name' => '4-1-4-1 Holding',
                'description' => 'Formation with a holding midfielder and wide midfielders',
                'style' => 'balanced',
                'defenders_count' => 4,
                'midfielders_count' => 5,
                'forwards_count' => 1,
                'positions' => [
                    ['x' => 50, 'y' => 5, 'position' => 'GK'],   // Goalkeeper
                    ['x' => 20, 'y' => 25, 'position' => 'LB'],  // Left Back
                    ['x' => 35, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 65, 'y' => 25, 'position' => 'CB'],  // Centre Back
                    ['x' => 80, 'y' => 25, 'position' => 'RB'],  // Right Back
                    ['x' => 50, 'y' => 40, 'position' => 'DM'],  // Defensive Midfielder
                    ['x' => 15, 'y' => 55, 'position' => 'LM'],  // Left Midfielder
                    ['x' => 35, 'y' => 55, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 65, 'y' => 55, 'position' => 'CM'],  // Centre Midfielder
                    ['x' => 85, 'y' => 55, 'position' => 'RM'],  // Right Midfielder
                    ['x' => 50, 'y' => 85, 'position' => 'ST'],  // Striker
                ],
                'is_active' => true
            ]
        ];

        foreach ($formations as $formation) {
            Formation::create($formation);
        }
    }
}
