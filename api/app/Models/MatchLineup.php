<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchLineup extends Model
{
    protected $fillable = [
        'match_id',
        'team_id',
        'player_id',
        'position',
        'is_starting',
        'sort_order',
        'x',
        'y',
    ];

    protected $casts = [
        'is_starting' => 'boolean',
        'x' => 'float',
        'y' => 'float',
        'sort_order' => 'integer',
    ];

    /**
     * Get the match this lineup entry belongs to.
     */
    public function match(): BelongsTo
    {
        return $this->belongsTo(GameMatch::class, 'match_id');
    }

    /**
     * Get the team this lineup entry belongs to.
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get the player for this lineup entry.
     */
    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }
}
