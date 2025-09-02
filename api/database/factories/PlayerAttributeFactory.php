<?php

namespace Database\Factories;

use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PlayerAttribute>
 */
class PlayerAttributeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Generate base attributes with realistic distributions
        $attributes = [];
        
        // Technical Attributes (1-20 scale)
        $attributes['finishing'] = $this->faker->numberBetween(1, 20);
        $attributes['first_touch'] = $this->faker->numberBetween(1, 20);
        $attributes['free_kick_taking'] = $this->faker->numberBetween(1, 20);
        $attributes['heading'] = $this->faker->numberBetween(1, 20);
        $attributes['long_shots'] = $this->faker->numberBetween(1, 20);
        $attributes['long_throws'] = $this->faker->numberBetween(1, 20);
        $attributes['marking'] = $this->faker->numberBetween(1, 20);
        $attributes['passing'] = $this->faker->numberBetween(1, 20);
        $attributes['penalty_taking'] = $this->faker->numberBetween(1, 20);
        $attributes['tackling'] = $this->faker->numberBetween(1, 20);
        $attributes['technique'] = $this->faker->numberBetween(1, 20);
        $attributes['corners'] = $this->faker->numberBetween(1, 20);
        $attributes['crossing'] = $this->faker->numberBetween(1, 20);
        $attributes['dribbling'] = $this->faker->numberBetween(1, 20);
        
        // Mental Attributes (1-20 scale)
        $attributes['aggression'] = $this->faker->numberBetween(1, 20);
        $attributes['anticipation'] = $this->faker->numberBetween(1, 20);
        $attributes['bravery'] = $this->faker->numberBetween(1, 20);
        $attributes['composure'] = $this->faker->numberBetween(1, 20);
        $attributes['concentration'] = $this->faker->numberBetween(1, 20);
        $attributes['decisions'] = $this->faker->numberBetween(1, 20);
        $attributes['determination'] = $this->faker->numberBetween(1, 20);
        $attributes['flair'] = $this->faker->numberBetween(1, 20);
        $attributes['leadership'] = $this->faker->numberBetween(1, 20);
        $attributes['off_the_ball'] = $this->faker->numberBetween(1, 20);
        $attributes['positioning'] = $this->faker->numberBetween(1, 20);
        $attributes['teamwork'] = $this->faker->numberBetween(1, 20);
        $attributes['vision'] = $this->faker->numberBetween(1, 20);
        $attributes['work_rate'] = $this->faker->numberBetween(1, 20);
        
        // Physical Attributes (1-20 scale)
        $attributes['acceleration'] = $this->faker->numberBetween(1, 20);
        $attributes['agility'] = $this->faker->numberBetween(1, 20);
        $attributes['balance'] = $this->faker->numberBetween(1, 20);
        $attributes['jumping_reach'] = $this->faker->numberBetween(1, 20);
        $attributes['natural_fitness'] = $this->faker->numberBetween(1, 20);
        $attributes['pace'] = $this->faker->numberBetween(1, 20);
        $attributes['stamina'] = $this->faker->numberBetween(1, 20);
        $attributes['strength'] = $this->faker->numberBetween(1, 20);
        
        // Goalkeeping Attributes (1-20 scale)
        $attributes['aerial_reach'] = $this->faker->numberBetween(1, 20);
        $attributes['command_of_area'] = $this->faker->numberBetween(1, 20);
        $attributes['communication'] = $this->faker->numberBetween(1, 20);
        $attributes['eccentricity'] = $this->faker->numberBetween(1, 20);
        $attributes['handling'] = $this->faker->numberBetween(1, 20);
        $attributes['kicking'] = $this->faker->numberBetween(1, 20);
        $attributes['one_on_ones'] = $this->faker->numberBetween(1, 20);
        $attributes['reflexes'] = $this->faker->numberBetween(1, 20);
        $attributes['rushing_out'] = $this->faker->numberBetween(1, 20);
        $attributes['throwing'] = $this->faker->numberBetween(1, 20);
        
        // Calculate overall ratings
        $currentAbility = $this->faker->randomFloat(2, 30.0, 95.0);
        $potentialAbility = $this->faker->randomFloat(2, $currentAbility, 100.0);
        
        $attributes['current_ability'] = $currentAbility;
        $attributes['potential_ability'] = $potentialAbility;
        $attributes['player_id'] = Player::factory();
        
        return $attributes;
    }

    /**
     * Indicate that the player is a goalkeeper.
     */
    public function goalkeeper(): static
    {
        return $this->state(fn (array $attributes) => [
            // Boost goalkeeper attributes
            'handling' => $this->faker->numberBetween(10, 20),
            'reflexes' => $this->faker->numberBetween(10, 20),
            'aerial_reach' => $this->faker->numberBetween(10, 20),
            'one_on_ones' => $this->faker->numberBetween(8, 18),
            'command_of_area' => $this->faker->numberBetween(8, 18),
            'kicking' => $this->faker->numberBetween(8, 18),
            'throwing' => $this->faker->numberBetween(8, 18),
            'rushing_out' => $this->faker->numberBetween(8, 18),
            'communication' => $this->faker->numberBetween(8, 18),
            'eccentricity' => $this->faker->numberBetween(1, 15),
            
            // Lower outfield attributes
            'finishing' => $this->faker->numberBetween(1, 8),
            'dribbling' => $this->faker->numberBetween(1, 8),
            'pace' => $this->faker->numberBetween(1, 12),
            'acceleration' => $this->faker->numberBetween(1, 12),
        ]);
    }

    /**
     * Indicate that the player is a defender.
     */
    public function defender(): static
    {
        return $this->state(fn (array $attributes) => [
            // Boost defensive attributes
            'tackling' => $this->faker->numberBetween(10, 20),
            'marking' => $this->faker->numberBetween(10, 20),
            'heading' => $this->faker->numberBetween(10, 20),
            'positioning' => $this->faker->numberBetween(10, 20),
            'strength' => $this->faker->numberBetween(10, 20),
            'bravery' => $this->faker->numberBetween(10, 20),
            'concentration' => $this->faker->numberBetween(10, 20),
            'anticipation' => $this->faker->numberBetween(10, 20),
            
            // Lower attacking attributes
            'finishing' => $this->faker->numberBetween(1, 10),
            'dribbling' => $this->faker->numberBetween(1, 12),
            'flair' => $this->faker->numberBetween(1, 12),
        ]);
    }

    /**
     * Indicate that the player is a midfielder.
     */
    public function midfielder(): static
    {
        return $this->state(fn (array $attributes) => [
            // Boost midfield attributes
            'passing' => $this->faker->numberBetween(10, 20),
            'vision' => $this->faker->numberBetween(10, 20),
            'technique' => $this->faker->numberBetween(10, 20),
            'first_touch' => $this->faker->numberBetween(10, 20),
            'stamina' => $this->faker->numberBetween(12, 20),
            'work_rate' => $this->faker->numberBetween(12, 20),
            'decisions' => $this->faker->numberBetween(10, 20),
            'teamwork' => $this->faker->numberBetween(10, 20),
            'positioning' => $this->faker->numberBetween(10, 20),
        ]);
    }

    /**
     * Indicate that the player is a forward.
     */
    public function forward(): static
    {
        return $this->state(fn (array $attributes) => [
            // Boost attacking attributes
            'finishing' => $this->faker->numberBetween(10, 20),
            'off_the_ball' => $this->faker->numberBetween(10, 20),
            'composure' => $this->faker->numberBetween(10, 20),
            'dribbling' => $this->faker->numberBetween(10, 20),
            'pace' => $this->faker->numberBetween(10, 20),
            'acceleration' => $this->faker->numberBetween(10, 20),
            'agility' => $this->faker->numberBetween(10, 20),
            'first_touch' => $this->faker->numberBetween(10, 20),
            'flair' => $this->faker->numberBetween(8, 18),
            
            // Lower defensive attributes
            'tackling' => $this->faker->numberBetween(1, 10),
            'marking' => $this->faker->numberBetween(1, 10),
        ]);
    }

    /**
     * Indicate that the player is a star player.
     */
    public function star(): static
    {
        return $this->state(fn (array $attributes) => [
            'current_ability' => $this->faker->randomFloat(2, 80.0, 98.0),
            'potential_ability' => $this->faker->randomFloat(2, 85.0, 100.0),
        ]);
    }

    /**
     * Indicate that the player is a youth player.
     */
    public function youth(): static
    {
        return $this->state(fn (array $attributes) => [
            'current_ability' => $this->faker->randomFloat(2, 30.0, 70.0),
            'potential_ability' => $this->faker->randomFloat(2, 50.0, 95.0),
        ]);
    }
}
