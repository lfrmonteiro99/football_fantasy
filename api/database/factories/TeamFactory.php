<?php

namespace Database\Factories;

use App\Models\League;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Team>
 */
class TeamFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $teamNames = [
            'Manchester United', 'Manchester City', 'Liverpool', 'Chelsea', 'Arsenal', 'Tottenham',
            'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Valencia', 'Sevilla',
            'Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 'Roma', 'Lazio',
            'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen',
            'Paris Saint-Germain', 'Lyon', 'Marseille', 'Monaco', 'Lille',
            'Porto', 'Benfica', 'Sporting CP', 'Braga',
            'Ajax', 'PSV Eindhoven', 'Feyenoord', 'AZ Alkmaar',
            'Club Brugge', 'Anderlecht', 'Gent', 'Standard Liège'
        ];

        $cities = [
            'Manchester', 'London', 'Liverpool', 'Madrid', 'Barcelona', 'Valencia',
            'Turin', 'Milan', 'Naples', 'Rome', 'Munich', 'Dortmund', 'Leipzig',
            'Paris', 'Lyon', 'Marseille', 'Porto', 'Lisbon', 'Amsterdam', 'Brussels'
        ];

        $stadiums = [
            'Old Trafford', 'Etihad Stadium', 'Anfield', 'Stamford Bridge', 'Emirates Stadium',
            'Santiago Bernabéu', 'Camp Nou', 'Wanda Metropolitano', 'Allianz Stadium',
            'San Siro', 'Stadio Diego Armando Maradona', 'Allianz Arena', 'Signal Iduna Park',
            'Parc des Princes', 'Stade Vélodrome', 'Estádio do Dragão', 'Estádio da Luz',
            'Johan Cruyff Arena', 'De Kuip', 'Jan Breydel Stadium'
        ];

        $teamName = $this->faker->randomElement($teamNames);
        $shortName = strtoupper(substr($teamName, 0, 3));
        
        // Generate short name from first letters of words if team name has multiple words
        if (str_contains($teamName, ' ')) {
            $words = explode(' ', $teamName);
            $shortName = '';
            foreach ($words as $word) {
                $shortName .= strtoupper(substr($word, 0, 1));
                if (strlen($shortName) >= 3) break;
            }
        }

        return [
            'name' => $teamName,
            'short_name' => substr($shortName, 0, 3),
            'city' => $this->faker->randomElement($cities),
            'stadium_name' => $this->faker->randomElement($stadiums),
            'stadium_capacity' => $this->faker->numberBetween(20000, 80000),
            'league_id' => League::factory(),
            'budget' => $this->faker->randomFloat(2, 10000000, 500000000), // 10M to 500M
            'reputation' => $this->faker->randomFloat(1, 3.0, 10.0),
            'primary_color' => $this->faker->hexColor(),
            'secondary_color' => $this->faker->hexColor(),
            'founded_year' => $this->faker->numberBetween(1850, 2000),
        ];
    }
}
