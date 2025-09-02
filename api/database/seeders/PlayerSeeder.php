<?php

namespace Database\Seeders;

use App\Models\Player;
use App\Models\PlayerAttribute;
use App\Models\Team;
use App\Models\Position;
use Illuminate\Database\Seeder;

class PlayerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $teams = Team::all();
        $positions = Position::all();
        
        // Get position IDs for easier reference
        $goalkeeper = $positions->where('short_name', 'GK')->first();
        $centreback = $positions->where('short_name', 'CB')->first();
        $leftback = $positions->where('short_name', 'LB')->first();
        $rightback = $positions->where('short_name', 'RB')->first();
        $defensiveMidfielder = $positions->where('short_name', 'DM')->first();
        $centralMidfielder = $positions->where('short_name', 'CM')->first();
        $attackingMidfielder = $positions->where('short_name', 'AM')->first();
        $leftMidfielder = $positions->where('short_name', 'LM')->first();
        $rightMidfielder = $positions->where('short_name', 'RM')->first();
        $striker = $positions->where('short_name', 'ST')->first();
        $leftWinger = $positions->where('short_name', 'LW')->first();
        $rightWinger = $positions->where('short_name', 'RW')->first();

        foreach ($teams as $team) {
            // Create a balanced squad for each team
            $this->createSquadForTeam($team, [
                $goalkeeper->id => 3,      // 3 Goalkeepers
                $centreback->id => 4,      // 4 Centre-backs
                $leftback->id => 2,        // 2 Left-backs
                $rightback->id => 2,       // 2 Right-backs
                $defensiveMidfielder->id => 2,  // 2 Defensive midfielders
                $centralMidfielder->id => 4,    // 4 Central midfielders
                $attackingMidfielder->id => 2,  // 2 Attacking midfielders
                $leftMidfielder->id => 1,       // 1 Left midfielder
                $rightMidfielder->id => 1,      // 1 Right midfielder
                $striker->id => 3,         // 3 Strikers
                $leftWinger->id => 2,      // 2 Left wingers
                $rightWinger->id => 2,     // 2 Right wingers
            ]);
        }
    }

    private function createSquadForTeam(Team $team, array $positionCounts): void
    {
        $shirtNumber = 1;
        $teamReputation = $team->reputation;
        
        foreach ($positionCounts as $positionId => $count) {
            $position = Position::find($positionId);
            
            for ($i = 0; $i < $count; $i++) {
                // Create player based on team reputation and position
                $player = $this->createPlayerForPosition($team, $position, $shirtNumber, $teamReputation, $i);
                $shirtNumber++;
                
                // Create attributes for the player
                $this->createPlayerAttributes($player, $position, $teamReputation, $i);
            }
        }
    }

    private function createPlayerForPosition(Team $team, Position $position, int $shirtNumber, float $teamReputation, int $playerIndex): Player
    {
        // Find the next available shirt number for this team
        $usedNumbers = Player::where('team_id', $team->id)->pluck('shirt_number')->toArray();
        while (in_array($shirtNumber, $usedNumbers) && $shirtNumber <= 99) {
            $shirtNumber++;
        }
        if ($shirtNumber > 99) {
            // Fallback: assign a random unused number between 1 and 99
            $allNumbers = range(1, 99);
            $available = array_diff($allNumbers, $usedNumbers);
            $shirtNumber = !empty($available) ? array_shift($available) : null;
        }
        
        $nationalities = $this->getNationalitiesForTeam($team);
        
        // First player in each position is usually the star player
        $isStarPlayer = $playerIndex === 0;
        $isYoungPlayer = $playerIndex === count($this->getPositionCounts()) - 1; // Last player is often young
        
        $age = $this->getAgeForPlayer($isStarPlayer, $isYoungPlayer);
        $marketValue = $this->getMarketValueForPlayer($teamReputation, $position, $isStarPlayer, $isYoungPlayer);
        $wage = $marketValue * 0.0001; // Rough wage calculation
        
        return Player::create([
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'date_of_birth' => now()->subYears($age)->subDays(rand(0, 365)),
            'nationality' => fake()->randomElement($nationalities),
            'preferred_foot' => fake()->randomElement(['left', 'right', 'both']),
            'height_cm' => $this->getHeightForPosition($position),
            'weight_kg' => $this->getWeightForPosition($position),
            'team_id' => $team->id,
            'primary_position_id' => $position->id,
            'secondary_positions' => $this->getSecondaryPositions($position),
            'market_value' => $marketValue,
            'wage_per_week' => $wage,
            'contract_start' => now()->subYears(rand(0, 3)),
            'contract_end' => now()->addYears(rand(1, 5)),
            'shirt_number' => $shirtNumber,
            'is_injured' => fake()->boolean(5), // 5% chance of injury
            'injury_return_date' => fake()->optional(0.05)->dateTimeBetween('now', '+2 months'),
        ]);
    }

    private function createPlayerAttributes(Player $player, Position $position, float $teamReputation, int $playerIndex): void
    {
        $isStarPlayer = $playerIndex === 0;
        $isYoungPlayer = $playerIndex >= 2; // Last few players are young
        
        // Base attributes influenced by team reputation
        $baseAttribute = (int) ($teamReputation * 2); // 6-20 range roughly
        $variation = 4; // ±4 variation
        
        $attributes = [];
        
        // Generate all attributes with position-specific boosts
        $attributeNames = [
            'finishing', 'first_touch', 'free_kick_taking', 'heading', 'long_shots',
            'long_throws', 'marking', 'passing', 'penalty_taking', 'tackling',
            'technique', 'corners', 'crossing', 'dribbling', 'aggression',
            'anticipation', 'bravery', 'composure', 'concentration', 'decisions',
            'determination', 'flair', 'leadership', 'off_the_ball', 'positioning',
            'teamwork', 'vision', 'work_rate', 'acceleration', 'agility',
            'balance', 'jumping_reach', 'natural_fitness', 'pace', 'stamina',
            'strength', 'aerial_reach', 'command_of_area', 'communication',
            'eccentricity', 'handling', 'kicking', 'one_on_ones', 'reflexes',
            'rushing_out', 'throwing'
        ];

        foreach ($attributeNames as $attr) {
            $value = $baseAttribute + rand(-$variation, $variation);
            $value = max(1, min(20, $value)); // Ensure 1-20 range
            
            // Position-specific boosts
            if ($position->category === 'goalkeeper' && in_array($attr, ['handling', 'reflexes', 'aerial_reach', 'one_on_ones', 'command_of_area'])) {
                $value = min(20, $value + rand(2, 6));
            } elseif ($position->category === 'defender' && in_array($attr, ['tackling', 'marking', 'heading', 'positioning', 'strength'])) {
                $value = min(20, $value + rand(2, 5));
            } elseif ($position->category === 'midfielder' && in_array($attr, ['passing', 'vision', 'technique', 'first_touch', 'stamina'])) {
                $value = min(20, $value + rand(2, 5));
            } elseif ($position->category === 'forward' && in_array($attr, ['finishing', 'off_the_ball', 'pace', 'dribbling', 'composure'])) {
                $value = min(20, $value + rand(2, 5));
            }
            
            $attributes[$attr] = $value;
        }

        // Star player boost
        if ($isStarPlayer) {
            foreach ($position->key_attributes as $keyAttr) {
                if (isset($attributes[$keyAttr])) {
                    $attributes[$keyAttr] = min(20, $attributes[$keyAttr] + rand(2, 4));
                }
            }
        }

        // Young player adjustments
        if ($isYoungPlayer) {
            // Lower current ability but higher potential
            foreach ($attributes as $key => $value) {
                $attributes[$key] = max(1, $value - rand(1, 3));
            }
        }

        // Calculate overall ratings
        $currentAbility = $this->calculateCurrentAbility($attributes, $position);
        $potentialAbility = $isYoungPlayer ? 
            min(100, $currentAbility + rand(10, 30)) : 
            min(100, $currentAbility + rand(-5, 10));

        $attributes['player_id'] = $player->id;
        $attributes['current_ability'] = $currentAbility;
        $attributes['potential_ability'] = $potentialAbility;

        PlayerAttribute::create($attributes);
    }

    private function calculateCurrentAbility(array $attributes, Position $position): float
    {
        $keyAttributes = $position->key_attributes;
        $total = 0;
        $count = 0;

        foreach ($keyAttributes as $attr) {
            if (isset($attributes[$attr])) {
                $total += $attributes[$attr];
                $count++;
            }
        }

        // Average of key attributes * 5 to get 0-100 scale
        return $count > 0 ? ($total / $count) * 5 : 50;
    }

    private function getNationalitiesForTeam(Team $team): array
    {
        $baseNationalities = ['England', 'Spain', 'Germany', 'France', 'Italy', 'Portugal', 'Netherlands', 'Belgium'];
        
        // Add league-specific nationalities
        switch ($team->league->country) {
            case 'England':
                return array_merge($baseNationalities, ['England', 'Scotland', 'Wales', 'Ireland']);
            case 'Spain':
                return array_merge($baseNationalities, ['Spain', 'Argentina', 'Brazil', 'Colombia']);
            case 'Germany':
                return array_merge($baseNationalities, ['Germany', 'Austria', 'Switzerland', 'Poland']);
            case 'Italy':
                return array_merge($baseNationalities, ['Italy', 'Argentina', 'Brazil', 'Croatia']);
            case 'France':
                return array_merge($baseNationalities, ['France', 'Algeria', 'Morocco', 'Senegal']);
            default:
                return $baseNationalities;
        }
    }

    private function getAgeForPlayer(bool $isStarPlayer, bool $isYoungPlayer): int
    {
        if ($isYoungPlayer) {
            return rand(16, 21);
        } elseif ($isStarPlayer) {
            return rand(24, 32);
        } else {
            return rand(20, 34);
        }
    }

    private function getMarketValueForPlayer(float $teamReputation, Position $position, bool $isStarPlayer, bool $isYoungPlayer): float
    {
        $baseValue = $teamReputation * 5000000; // 15M to 50M base
        
        if ($isStarPlayer) {
            $baseValue *= rand(3, 8);
        } elseif ($isYoungPlayer) {
            $baseValue *= rand(1, 3) * 0.5;
        } else {
            $baseValue *= rand(1, 3);
        }
        
        return max(100000, $baseValue);
    }

    private function getHeightForPosition(Position $position): int
    {
        switch ($position->category) {
            case 'goalkeeper':
                return rand(180, 205);
            case 'defender':
                return rand(175, 195);
            case 'midfielder':
                return rand(165, 185);
            case 'forward':
                return rand(170, 190);
            default:
                return rand(170, 185);
        }
    }

    private function getWeightForPosition(Position $position): int
    {
        switch ($position->category) {
            case 'goalkeeper':
                return rand(75, 95);
            case 'defender':
                return rand(70, 90);
            case 'midfielder':
                return rand(65, 80);
            case 'forward':
                return rand(65, 85);
            default:
                return rand(65, 85);
        }
    }

    private function getSecondaryPositions(Position $position): ?array
    {
        $secondaryPositions = [];
        
        switch ($position->short_name) {
            case 'CB':
                $secondaryPositions = [2, 3, 4]; // Can play LB, RB, other CB positions
                break;
            case 'LB':
                $secondaryPositions = [2, 5, 10]; // CB, WB, LM
                break;
            case 'RB':
                $secondaryPositions = [2, 5, 11]; // CB, WB, RM
                break;
            case 'CM':
                $secondaryPositions = [7, 8, 9]; // DM, CM, AM
                break;
            case 'LW':
                $secondaryPositions = [10, 12, 15]; // LM, ST, other winger positions
                break;
            case 'RW':
                $secondaryPositions = [11, 12, 14]; // RM, ST, other winger positions
                break;
        }
        
        return empty($secondaryPositions) ? null : $secondaryPositions;
    }

    private function getPositionCounts(): array
    {
        return [
            'GK' => 3, 'CB' => 4, 'LB' => 2, 'RB' => 2,
            'DM' => 2, 'CM' => 4, 'AM' => 2, 'LM' => 1, 'RM' => 1,
            'ST' => 3, 'LW' => 2, 'RW' => 2
        ];
    }
}
