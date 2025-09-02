<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Formation extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'positions',
        'style',
        'defenders_count',
        'midfielders_count',
        'forwards_count',
        'is_active',
        'sample_instructions',
    ];

    protected $casts = [
        'positions' => 'array',
        'sample_instructions' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Get the tactics that use this formation.
     */
    public function tactics(): HasMany
    {
        return $this->hasMany(Tactic::class);
    }
    
    /**
     * Get sample instructions for this formation
     */
    public function getSampleInstructions(): array
    {
        return $this->sample_instructions ?? [];
    }
    
    /**
     * Check if formation has sample instructions
     */
    public function hasSampleInstructions(): bool
    {
        return !empty($this->sample_instructions);
    }
}
