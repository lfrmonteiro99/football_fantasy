<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\League>
 */
class LeagueFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $leagues = [
            ['name' => 'Premier League', 'country' => 'England', 'level' => 1, 'reputation' => 9.5],
            ['name' => 'Championship', 'country' => 'England', 'level' => 2, 'reputation' => 7.5],
            ['name' => 'La Liga', 'country' => 'Spain', 'level' => 1, 'reputation' => 9.2],
            ['name' => 'Segunda División', 'country' => 'Spain', 'level' => 2, 'reputation' => 7.0],
            ['name' => 'Serie A', 'country' => 'Italy', 'level' => 1, 'reputation' => 8.8],
            ['name' => 'Serie B', 'country' => 'Italy', 'level' => 2, 'reputation' => 6.5],
            ['name' => 'Bundesliga', 'country' => 'Germany', 'level' => 1, 'reputation' => 8.5],
            ['name' => '2. Bundesliga', 'country' => 'Germany', 'level' => 2, 'reputation' => 6.8],
            ['name' => 'Ligue 1', 'country' => 'France', 'level' => 1, 'reputation' => 8.0],
            ['name' => 'Ligue 2', 'country' => 'France', 'level' => 2, 'reputation' => 6.2],
            ['name' => 'Primeira Liga', 'country' => 'Portugal', 'level' => 1, 'reputation' => 7.8],
            ['name' => 'Liga Portugal 2', 'country' => 'Portugal', 'level' => 2, 'reputation' => 5.5],
            ['name' => 'Eredivisie', 'country' => 'Netherlands', 'level' => 1, 'reputation' => 7.5],
            ['name' => 'Eerste Divisie', 'country' => 'Netherlands', 'level' => 2, 'reputation' => 5.8],
            ['name' => 'Belgian Pro League', 'country' => 'Belgium', 'level' => 1, 'reputation' => 6.8],
        ];

        $league = $this->faker->randomElement($leagues);

        return [
            'name' => $league['name'],
            'country' => $league['country'],
            'level' => $league['level'],
            'max_teams' => $league['level'] === 1 ? 20 : 24,
            'reputation' => $league['reputation'],
        ];
    }
}
