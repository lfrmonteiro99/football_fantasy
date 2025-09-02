<?php

namespace Database\Factories;

use App\Models\Formation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Tactic>
 */
class TacticFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $tacticNames = [
            'Tiki-Taka', 'Gegenpressing', 'Catenaccio', 'Total Football', 'Park the Bus',
            'Counter Attack', 'Possession Play', 'Direct Play', 'High Press', 'Low Block',
            'Wing Play', 'Through the Middle', 'Route One', 'False 9', 'Inverted Wingers'
        ];

        $descriptions = [
            'Short passing game with high possession',
            'High intensity pressing and quick transitions',
            'Defensive solidity with quick counter-attacks',
            'Fluid positional play with versatile players',
            'Ultra-defensive approach focusing on clean sheets',
            'Absorb pressure and hit on the break',
            'Control the game through ball retention',
            'Get the ball forward quickly and directly',
            'Press high up the pitch to win the ball back',
            'Sit deep and compact to frustrate opponents',
            'Use the flanks to create crossing opportunities',
            'Play through the center with intricate passing',
            'Long ball tactics to bypass midfield',
            'Striker drops deep to create space',
            'Wingers cut inside to create overloads'
        ];

        return [
            'name' => $this->faker->randomElement($tacticNames),
            'description' => $this->faker->randomElement($descriptions),
            'formation_id' => Formation::factory(),
            'mentality' => $this->faker->randomElement(['very_defensive', 'defensive', 'balanced', 'attacking', 'very_attacking']),
            'team_instructions' => $this->faker->randomElement(['control_possession', 'direct_passing', 'short_passing', 'mixed']),
            'defensive_line' => $this->faker->randomElement(['very_deep', 'deep', 'standard', 'high', 'very_high']),
            'pressing' => $this->faker->randomElement(['never', 'rarely', 'sometimes', 'often', 'always']),
            'tempo' => $this->faker->randomElement(['very_slow', 'slow', 'standard', 'fast', 'very_fast']),
            'width' => $this->faker->randomElement(['very_narrow', 'narrow', 'standard', 'wide', 'very_wide']),
            'offside_trap' => $this->faker->boolean(30),
            'play_out_of_defence' => $this->faker->boolean(50),
            'use_offside_trap' => $this->faker->boolean(25),
            'close_down_more' => $this->faker->boolean(40),
            'tackle_harder' => $this->faker->boolean(30),
            'get_stuck_in' => $this->faker->boolean(35),
        ];
    }

    /**
     * Indicate that the tactic is attacking.
     */
    public function attacking(): static
    {
        return $this->state(fn (array $attributes) => [
            'mentality' => $this->faker->randomElement(['attacking', 'very_attacking']),
            'team_instructions' => $this->faker->randomElement(['direct_passing', 'short_passing']),
            'defensive_line' => $this->faker->randomElement(['high', 'very_high']),
            'pressing' => $this->faker->randomElement(['often', 'always']),
            'tempo' => $this->faker->randomElement(['fast', 'very_fast']),
            'width' => $this->faker->randomElement(['wide', 'very_wide']),
            'close_down_more' => true,
        ]);
    }

    /**
     * Indicate that the tactic is defensive.
     */
    public function defensive(): static
    {
        return $this->state(fn (array $attributes) => [
            'mentality' => $this->faker->randomElement(['defensive', 'very_defensive']),
            'team_instructions' => $this->faker->randomElement(['control_possession', 'direct_passing']),
            'defensive_line' => $this->faker->randomElement(['deep', 'very_deep']),
            'pressing' => $this->faker->randomElement(['never', 'rarely']),
            'tempo' => $this->faker->randomElement(['slow', 'very_slow']),
            'width' => $this->faker->randomElement(['narrow', 'very_narrow']),
            'offside_trap' => false,
            'tackle_harder' => true,
            'get_stuck_in' => true,
        ]);
    }

    /**
     * Indicate that the tactic is possession-based.
     */
    public function possession(): static
    {
        return $this->state(fn (array $attributes) => [
            'team_instructions' => 'control_possession',
            'tempo' => $this->faker->randomElement(['slow', 'standard']),
            'pressing' => $this->faker->randomElement(['sometimes', 'often']),
            'play_out_of_defence' => true,
            'close_down_more' => false,
            'tackle_harder' => false,
        ]);
    }

    /**
     * Indicate that the tactic is counter-attacking.
     */
    public function counterAttacking(): static
    {
        return $this->state(fn (array $attributes) => [
            'mentality' => 'defensive',
            'team_instructions' => 'direct_passing',
            'defensive_line' => $this->faker->randomElement(['deep', 'very_deep']),
            'pressing' => $this->faker->randomElement(['never', 'rarely']),
            'tempo' => 'very_fast',
            'width' => 'wide',
            'offside_trap' => false,
            'play_out_of_defence' => false,
        ]);
    }
}
