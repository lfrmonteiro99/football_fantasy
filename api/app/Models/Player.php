<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\Attribute;

class Player extends Model
{
    use HasFactory;

    protected $fillable = [
        'first_name',
        'last_name',
        'date_of_birth',
        'nationality',
        'preferred_foot',
        'height_cm',
        'weight_kg',
        'team_id',
        'primary_position_id',
        'secondary_positions',
        'market_value',
        'wage_per_week',
        'contract_start',
        'contract_end',
        'shirt_number',
        'is_injured',
        'injury_return_date',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'contract_start' => 'date',
        'contract_end' => 'date',
        'injury_return_date' => 'date',
        'secondary_positions' => 'array',
        'market_value' => 'decimal:2',
        'wage_per_week' => 'decimal:2',
        'is_injured' => 'boolean',
    ];

    /**
     * Get the team that owns the player.
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get the primary position of the player.
     */
    public function primaryPosition(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'primary_position_id');
    }

    /**
     * Get the player's attributes.
     */
    public function attributes(): HasOne
    {
        return $this->hasOne(PlayerAttribute::class);
    }

    /**
     * Get the tactical positions for this player.
     */
    public function tacticalPositions(): HasMany
    {
        return $this->hasMany(TacticalPosition::class);
    }

    /**
     * Get the player's full name.
     */
    protected function fullName(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->first_name . ' ' . $this->last_name,
        );
    }

    /**
     * Get the player's age.
     */
    protected function age(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->date_of_birth ? $this->date_of_birth->age : null,
        );
    }
}
