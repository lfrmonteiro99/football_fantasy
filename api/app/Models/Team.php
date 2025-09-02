<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Team extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'short_name',
        'city',
        'stadium_name',
        'stadium_capacity',
        'league_id',
        'budget',
        'reputation',
        'primary_color',
        'secondary_color',
        'founded_year',
        'primary_tactic_id',
    ];

    protected $casts = [
        'budget' => 'decimal:2',
        'reputation' => 'decimal:1',
        'founded_year' => 'integer',
        'stadium_capacity' => 'integer',
    ];

    /**
     * Get the league that owns the team.
     */
    public function league(): BelongsTo
    {
        return $this->belongsTo(League::class);
    }

    /**
     * Get the players for the team.
     */
    public function players(): HasMany
    {
        return $this->hasMany(Player::class);
    }

    /**
     * Get the tactics for the team.
     */
    public function tactics(): BelongsToMany
    {
        return $this->belongsToMany(Tactic::class, 'team_tactics')
                    ->withPivot('is_primary', 'is_active')
                    ->withTimestamps();
    }

    /**
     * Get the primary tactic for the team.
     */
    public function primaryTactic(): BelongsTo
    {
        return $this->belongsTo(Tactic::class, 'primary_tactic_id');
    }

    /**
     * Get the tactical positions for the team.
     */
    public function tacticalPositions(): HasMany
    {
        return $this->hasMany(TacticalPosition::class);
    }

    /**
     * Get home matches for the team.
     */
    public function homeMatches(): HasMany
    {
        return $this->hasMany(GameMatch::class, 'home_team_id');
    }

    /**
     * Get away matches for the team.
     */
    public function awayMatches(): HasMany
    {
        return $this->hasMany(GameMatch::class, 'away_team_id');
    }

    /**
     * Get all matches for the team (both home and away).
     */
    public function matches()
    {
        return GameMatch::where('home_team_id', $this->id)
            ->orWhere('away_team_id', $this->id);
    }

    /**
     * Get the manager (user) of this team.
     */
    public function manager()
    {
        return $this->hasOne(User::class, 'managed_team_id');
    }
}
