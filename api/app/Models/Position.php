<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Position extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'short_name',
        'category',
        'key_attributes',
    ];

    protected $casts = [
        'key_attributes' => 'array',
    ];

    /**
     * Get the players with this as their primary position.
     */
    public function primaryPlayers(): HasMany
    {
        return $this->hasMany(Player::class, 'primary_position_id');
    }

    /**
     * Get the tactical positions for this position.
     */
    public function tacticalPositions(): HasMany
    {
        return $this->hasMany(TacticalPosition::class);
    }
}
