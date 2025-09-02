<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class League extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'country',
        'level',
        'max_teams',
        'reputation',
        'logo',
    ];

    protected $casts = [
        'reputation' => 'decimal:1',
        'level' => 'integer',
        'max_teams' => 'integer',
    ];

    /**
     * Get the teams that belong to this league.
     */
    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    /**
     * Get the matches for the league.
     */
    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }
}
