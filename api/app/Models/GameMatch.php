<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;
use App\Models\MatchLineup;

class GameMatch extends Model
{
    protected $table = 'matches';

    protected $fillable = [
        'home_team_id',
        'away_team_id',
        'league_id',
        'season_id',
        'manager_id',
        'match_date',
        'matchday',
        'match_time',
        'home_formation_id',
        'away_formation_id',
        'stadium',
        'weather',
        'temperature',
        'attendance',
        'home_score',
        'away_score',
        'status',
        'stadium',
        'match_stats',
    ];

    protected $casts = [
        'match_date' => 'datetime',
        'home_score' => 'integer',
        'away_score' => 'integer',
        'temperature' => 'integer',
        'attendance' => 'integer',
        'match_stats' => 'array',
        'home_goals' => 'integer',
        'away_goals' => 'integer',
        'matchday' => 'integer',
    ];

    // Relationships
    public function homeTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'home_team_id');
    }

    public function awayTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'away_team_id');
    }

    public function league(): BelongsTo
    {
        return $this->belongsTo(League::class);
    }

    public function homeFormation(): BelongsTo
    {
        return $this->belongsTo(Formation::class, 'home_formation_id');
    }

    public function awayFormation(): BelongsTo
    {
        return $this->belongsTo(Formation::class, 'away_formation_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(MatchEvent::class, 'match_id');
    }

    /**
     * Get the lineup entries for this match.
     */
    public function lineups(): HasMany
    {
        return $this->hasMany(MatchLineup::class, 'match_id');
    }

    // Scopes
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeScheduled($query)
    {
        return $query->where('status', 'scheduled');
    }

    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }

    /**
     * Get the season that owns the match.
     */
    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class);
    }

    /**
     * Get the manager that owns the match.
     */
    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    /**
     * Boot the model and add validation events.
     */
    protected static function boot()
    {
        parent::boot();

        // Validate before creating
        static::creating(function ($match) {
            $match->validateTeamsDifferent();
        });

        // Validate before updating
        static::updating(function ($match) {
            $match->validateTeamsDifferent();
        });
    }

    /**
     * Validate that home and away teams are different.
     */
    protected function validateTeamsDifferent()
    {
        if ($this->home_team_id === $this->away_team_id) {
            throw ValidationException::withMessages([
                'teams' => 'A team cannot play against itself. Home team and away team must be different.'
            ]);
        }
    }
}
