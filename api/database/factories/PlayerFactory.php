<?php

namespace Database\Factories;

use App\Models\Team;
use App\Models\Position;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Player>
 */
class PlayerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $nationalities = [
            'England', 'Spain', 'Germany', 'France', 'Italy', 'Portugal', 'Netherlands', 'Belgium',
            'Brazil', 'Argentina', 'Uruguay', 'Colombia', 'Chile', 'Mexico', 'USA', 'Canada',
            'Croatia', 'Poland', 'Czech Republic', 'Denmark', 'Sweden', 'Norway', 'Austria',
            'Switzerland', 'Turkey', 'Greece', 'Serbia', 'Slovenia', 'Slovakia', 'Hungary',
            'Morocco', 'Algeria', 'Tunisia', 'Egypt', 'Nigeria', 'Ghana', 'Senegal', 'Ivory Coast',
            'Cameroon', 'South Africa', 'Japan', 'South Korea', 'Australia', 'New Zealand'
        ];

        $contractStart = $this->faker->dateTimeBetween('-3 years', 'now');
        $contractEnd = $this->faker->dateTimeBetween('now', '+5 years');

        return [
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName(),
            'date_of_birth' => $this->faker->dateTimeBetween('-40 years', '-16 years'),
            'nationality' => $this->faker->randomElement($nationalities),
            'preferred_foot' => $this->faker->randomElement(['left', 'right', 'both']),
            'height_cm' => $this->faker->numberBetween(160, 210),
            'weight_kg' => $this->faker->numberBetween(60, 100),
            'team_id' => Team::factory(),
            'primary_position_id' => Position::factory(),
            'secondary_positions' => $this->faker->optional(0.7)->randomElements(
                range(1, 16), // Assuming we have 16 positions
                $this->faker->numberBetween(1, 3)
            ),
            'market_value' => $this->faker->randomFloat(2, 100000, 150000000), // 100K to 150M
            'wage_per_week' => $this->faker->randomFloat(2, 1000, 500000), // 1K to 500K per week
            'contract_start' => $contractStart,
            'contract_end' => $contractEnd,
            'shirt_number' => $this->faker->optional(0.8)->numberBetween(1, 99),
            'is_injured' => $this->faker->boolean(10), // 10% chance of being injured
            'injury_return_date' => $this->faker->optional(0.1)->dateTimeBetween('now', '+3 months'),
        ];
    }

    /**
     * Indicate that the player is a goalkeeper.
     */
    public function goalkeeper(): static
    {
        return $this->state(fn (array $attributes) => [
            'height_cm' => $this->faker->numberBetween(180, 205),
            'weight_kg' => $this->faker->numberBetween(75, 95),
        ]);
    }

    /**
     * Indicate that the player is a defender.
     */
    public function defender(): static
    {
        return $this->state(fn (array $attributes) => [
            'height_cm' => $this->faker->numberBetween(175, 195),
            'weight_kg' => $this->faker->numberBetween(70, 90),
        ]);
    }

    /**
     * Indicate that the player is a midfielder.
     */
    public function midfielder(): static
    {
        return $this->state(fn (array $attributes) => [
            'height_cm' => $this->faker->numberBetween(165, 185),
            'weight_kg' => $this->faker->numberBetween(65, 80),
        ]);
    }

    /**
     * Indicate that the player is a forward.
     */
    public function forward(): static
    {
        return $this->state(fn (array $attributes) => [
            'height_cm' => $this->faker->numberBetween(170, 190),
            'weight_kg' => $this->faker->numberBetween(65, 85),
        ]);
    }

    /**
     * Indicate that the player is young (under 23).
     */
    public function young(): static
    {
        return $this->state(fn (array $attributes) => [
            'date_of_birth' => $this->faker->dateTimeBetween('-23 years', '-16 years'),
            'market_value' => $this->faker->randomFloat(2, 50000, 50000000), // Lower market value
            'wage_per_week' => $this->faker->randomFloat(2, 500, 50000), // Lower wages
        ]);
    }

    /**
     * Indicate that the player is a veteran (over 32).
     */
    public function veteran(): static
    {
        return $this->state(fn (array $attributes) => [
            'date_of_birth' => $this->faker->dateTimeBetween('-40 years', '-32 years'),
            'market_value' => $this->faker->randomFloat(2, 100000, 20000000), // Lower market value
        ]);
    }
}
