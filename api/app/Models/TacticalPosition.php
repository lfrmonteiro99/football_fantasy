<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TacticalPosition extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'tactic_id',
        'player_id',
        'position_id',
        'x_coordinate',
        'y_coordinate',
        'role',
        'formation_slot',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the team that owns this tactical position.
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get the tactic that owns this tactical position.
     */
    public function tactic(): BelongsTo
    {
        return $this->belongsTo(Tactic::class);
    }

    /**
     * Get the player assigned to this tactical position.
     */
    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    /**
     * Get the position for this tactical position.
     */
    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }
}
