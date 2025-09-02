<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tactic extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'formation_id',
        'mentality',
        'team_instructions',
        
        // Existing fields
        'defensive_line',
        'pressing',
        'tempo',
        'width',
        'offside_trap',
        'play_out_of_defence',
        'use_offside_trap',
        'close_down_more',
        'tackle_harder',
        'get_stuck_in',
        
        // New tactical instruction fields
        'attacking_width',
        'approach_play',
        'passing_directness',
        'time_wasting',
        'final_third',
        'creative_freedom',
        
        // Individual final third options
        'work_ball_into_box',
        'low_crosses',
        'whipped_crosses',
        'hit_early_crosses',
        
        // Transition fields
        'counter_press',
        'counter_attack',
        'regroup',
        'hold_shape',
        'goalkeeper_distribution',
        
        // Individual goalkeeper distribution options
        'distribute_quickly',
        'slow_pace_down',
        'roll_out',
        'throw_long',
        'take_short_kicks',
        'take_long_kicks',
        
        // Out of possession fields
        'line_of_engagement',
        'pressing_intensity',
        'prevent_short_gk_distribution',
        'tackling',
        'pressing_trap',
        
        // Individual tackling options
        'stay_on_feet',
        
        // Complex fields
        'custom_positions',
        'player_assignments',
        'characteristics',
    ];

    protected $casts = [
        // Existing boolean fields
        'offside_trap' => 'boolean',
        'play_out_of_defence' => 'boolean',
        'use_offside_trap' => 'boolean',
        'close_down_more' => 'boolean',
        'tackle_harder' => 'boolean',
        'get_stuck_in' => 'boolean',
        
        // New transition boolean fields
        'counter_press' => 'boolean',
        'counter_attack' => 'boolean',
        'regroup' => 'boolean',
        'hold_shape' => 'boolean',
        'prevent_short_gk_distribution' => 'boolean',
        
        // Final third boolean options
        'work_ball_into_box' => 'boolean',
        'low_crosses' => 'boolean',
        'whipped_crosses' => 'boolean',
        'hit_early_crosses' => 'boolean',
        
        // Goalkeeper distribution boolean options
        'distribute_quickly' => 'boolean',
        'slow_pace_down' => 'boolean',
        'roll_out' => 'boolean',
        'throw_long' => 'boolean',
        'take_short_kicks' => 'boolean',
        'take_long_kicks' => 'boolean',
        
        // Tackling boolean options
        'stay_on_feet' => 'boolean',
        
        // Array fields
        'custom_positions' => 'array',
        'player_assignments' => 'array',
        'characteristics' => 'array',
    ];

    /**
     * Get the formation that the tactic uses.
     */
    public function formation(): BelongsTo
    {
        return $this->belongsTo(Formation::class);
    }

    /**
     * Get the teams that use this tactic.
     */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_tactics')
                    ->withPivot('is_primary', 'is_active')
                    ->withTimestamps();
    }

    /**
     * Get the tactical positions for this tactic.
     */
    public function tacticalPositions(): HasMany
    {
        return $this->hasMany(TacticalPosition::class);
    }
}
