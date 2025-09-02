<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlayerAttribute extends Model
{
    use HasFactory;

    protected $fillable = [
        'player_id',
        // Technical Attributes
        'finishing',
        'first_touch',
        'free_kick_taking',
        'heading',
        'long_shots',
        'long_throws',
        'marking',
        'passing',
        'penalty_taking',
        'tackling',
        'technique',
        'corners',
        'crossing',
        'dribbling',
        // Mental Attributes
        'aggression',
        'anticipation',
        'bravery',
        'composure',
        'concentration',
        'decisions',
        'determination',
        'flair',
        'leadership',
        'off_the_ball',
        'positioning',
        'teamwork',
        'vision',
        'work_rate',
        // Physical Attributes
        'acceleration',
        'agility',
        'balance',
        'jumping_reach',
        'natural_fitness',
        'pace',
        'stamina',
        'strength',
        // Goalkeeping Attributes
        'aerial_reach',
        'command_of_area',
        'communication',
        'eccentricity',
        'handling',
        'kicking',
        'one_on_ones',
        'reflexes',
        'rushing_out',
        'throwing',
        // Overall ratings
        'current_ability',
        'potential_ability',
    ];

    protected $casts = [
        'current_ability' => 'decimal:2',
        'potential_ability' => 'decimal:2',
    ];

    /**
     * Get the player that owns the attributes.
     */
    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    /**
     * Calculate overall rating based on position
     */
    public function calculateOverallRating(?string $position = null): float
    {
        $position = $position ?? $this->player->primaryPosition->category;
        
        switch ($position) {
            case 'goalkeeper':
                return $this->calculateGoalkeeperRating();
            case 'defender':
                return $this->calculateDefenderRating();
            case 'midfielder':
                return $this->calculateMidfielderRating();
            case 'forward':
                return $this->calculateForwardRating();
            default:
                return $this->calculateGeneralRating();
        }
    }

    private function calculateGoalkeeperRating(): float
    {
        return (
            $this->handling * 0.2 +
            $this->reflexes * 0.2 +
            $this->aerial_reach * 0.15 +
            $this->one_on_ones * 0.15 +
            $this->command_of_area * 0.1 +
            $this->kicking * 0.1 +
            $this->throwing * 0.1
        );
    }

    private function calculateDefenderRating(): float
    {
        return (
            $this->tackling * 0.2 +
            $this->marking * 0.2 +
            $this->heading * 0.15 +
            $this->positioning * 0.15 +
            $this->strength * 0.1 +
            $this->pace * 0.1 +
            $this->passing * 0.1
        );
    }

    private function calculateMidfielderRating(): float
    {
        return (
            $this->passing * 0.2 +
            $this->vision * 0.15 +
            $this->technique * 0.15 +
            $this->first_touch * 0.15 +
            $this->stamina * 0.1 +
            $this->work_rate * 0.1 +
            $this->decisions * 0.15
        );
    }

    private function calculateForwardRating(): float
    {
        return (
            $this->finishing * 0.2 +
            $this->off_the_ball * 0.15 +
            $this->pace * 0.15 +
            $this->dribbling * 0.15 +
            $this->first_touch * 0.1 +
            $this->composure * 0.1 +
            $this->acceleration * 0.15
        );
    }

    private function calculateGeneralRating(): float
    {
        // General rating calculation
        $technical = ($this->finishing + $this->first_touch + $this->passing + $this->technique) / 4;
        $mental = ($this->decisions + $this->positioning + $this->teamwork + $this->work_rate) / 4;
        $physical = ($this->pace + $this->stamina + $this->strength + $this->acceleration) / 4;
        
        return ($technical * 0.4 + $mental * 0.4 + $physical * 0.2);
    }
}
