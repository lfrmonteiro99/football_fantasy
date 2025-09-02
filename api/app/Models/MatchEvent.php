<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchEvent extends Model
{
    protected $fillable = [
        'match_id',
        'minute',
        'event_type',
        'team_type',
        'player_name',
        'description',
        'x_coordinate',
        'y_coordinate',
        'commentary',
        'sub_events'
    ];

    protected $casts = [
        'sub_events' => 'array'
    ];

    /**
     * Get the match that owns the event.
     */
    public function match(): BelongsTo
    {
        return $this->belongsTo(GameMatch::class, 'match_id');
    }
}
