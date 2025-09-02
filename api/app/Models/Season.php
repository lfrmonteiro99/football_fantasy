<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Season extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'start_date',
        'end_date',
        'is_current',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'is_current' => 'boolean',
    ];

    /**
     * Get the matches for the season.
     */
    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }

    /**
     * Set this season as current and unmark other seasons.
     */
    public function setAsCurrent(): void
    {
        // First, unmark all seasons
        self::where('is_current', true)
            ->update(['is_current' => false]);

        // Then mark this one as current
        $this->is_current = true;
        $this->save();
    }

    /**
     * Get the current season.
     */
    public static function current()
    {
        return self::where('is_current', true)->first();
    }
}

