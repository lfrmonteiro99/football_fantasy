<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MatchTactic extends Model
{
    use HasFactory;

    protected $fillable = [
        'match_id',
        'team_type',
        'team_id',
        'formation_id',
        'custom_positions',
        'mentality',
        'team_instructions',
        'pressing',
        'tempo',
        'width',
        'offside_trap',
        'play_out_of_defence',
        'use_offside_trap',
        'close_down_more',
        'tackle_harder',
        'get_stuck_in',
        'player_assignments',
        'substitutions',
        'applied_at_minute',
    ];

    protected $casts = [
        'custom_positions' => 'array',
        'player_assignments' => 'array',
        'substitutions' => 'array',
        'offside_trap' => 'boolean',
        'play_out_of_defence' => 'boolean',
        'use_offside_trap' => 'boolean',
        'close_down_more' => 'boolean',
        'tackle_harder' => 'boolean',
        'get_stuck_in' => 'boolean',
    ];

    public function match()
    {
        return $this->belongsTo(GameMatch::class, 'match_id');
    }

    public function team()
    {
        return $this->belongsTo(Team::class);
    }

    public function formation()
    {
        return $this->belongsTo(Formation::class);
    }

    /**
     * Get the effective formation for this match tactic
     * Returns custom positions if set, otherwise the formation's positions
     */
    public function getEffectivePositions()
    {
        if ($this->custom_positions) {
            return $this->custom_positions;
        }

        return $this->formation ? $this->formation->positions : [];
    }

    /**
     * Get the effective tactical instructions
     * Merges base tactic instructions with match-specific changes
     */
    public function getEffectiveInstructions($baseTactic = null)
    {
        $instructions = [];

        if ($baseTactic) {
            $instructions = [
                'mentality' => $baseTactic->mentality,
                'team_instructions' => $baseTactic->team_instructions,
                'pressing' => $baseTactic->pressing,
                'tempo' => $baseTactic->tempo,
                'width' => $baseTactic->width,
                'offside_trap' => $baseTactic->offside_trap,
                'play_out_of_defence' => $baseTactic->play_out_of_defence,
                'use_offside_trap' => $baseTactic->use_offside_trap,
                'close_down_more' => $baseTactic->close_down_more,
                'tackle_harder' => $baseTactic->tackle_harder,
                'get_stuck_in' => $baseTactic->get_stuck_in,
            ];
        }

        // Override with match-specific changes
        foreach ($this->fillable as $field) {
            if (in_array($field, ['match_id', 'team_type', 'team_id', 'formation_id', 'custom_positions', 'player_assignments', 'substitutions', 'applied_at_minute'])) {
                continue;
            }
            
            if ($this->$field !== null) {
                $instructions[$field] = $this->$field;
            }
        }

        return $instructions;
    }

    /**
     * Get all substitutions made during the match
     */
    public function getSubstitutions()
    {
        return $this->substitutions ?? [];
    }

    /**
     * Add a substitution to the match
     */
    public function addSubstitution($playerOutId, $playerInId, $minute)
    {
        $substitutions = $this->substitutions ?? [];
        $substitutions[] = [
            'player_out_id' => $playerOutId,
            'player_in_id' => $playerInId,
            'minute' => $minute,
            'timestamp' => now()->toISOString(),
        ];
        
        $this->update(['substitutions' => $substitutions]);
    }

    /**
     * Get the current lineup based on player assignments and substitutions
     */
    public function getCurrentLineup($baseLineup = [])
    {
        $lineup = $baseLineup;
        
        // Apply player assignments if set
        if ($this->player_assignments) {
            foreach ($this->player_assignments as $positionIndex => $playerId) {
                if (isset($lineup[$positionIndex])) {
                    $lineup[$positionIndex] = $playerId;
                }
            }
        }

        // Apply substitutions
        foreach ($this->getSubstitutions() as $substitution) {
            $playerOutId = $substitution['player_out_id'];
            $playerInId = $substitution['player_in_id'];
            
            // Find and replace the substituted player
            foreach ($lineup as $positionIndex => $playerId) {
                if ($playerId == $playerOutId) {
                    $lineup[$positionIndex] = $playerInId;
                    break;
                }
            }
        }

        return $lineup;
    }
} 