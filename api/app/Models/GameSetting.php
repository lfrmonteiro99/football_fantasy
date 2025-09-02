<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class GameSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'type',
        'description'
    ];

    /**
     * Get a setting value by key with type casting.
     */
    public static function get(string $key, $default = null)
    {
        $setting = self::where('key', $key)->first();
        
        if (!$setting) {
            return $default;
        }

        return self::castValue($setting->value, $setting->type);
    }

    /**
     * Set a setting value with automatic type detection.
     */
    public static function set(string $key, $value, ?string $description = null): self
    {
        $type = self::detectType($value);
        $stringValue = self::valueToString($value, $type);

        return self::updateOrCreate(
            ['key' => $key],
            [
                'value' => $stringValue,
                'type' => $type,
                'description' => $description
            ]
        );
    }

    /**
     * Cast string value to appropriate type.
     */
    private static function castValue(string $value, string $type)
    {
        switch ($type) {
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'integer':
                return (int) $value;
            case 'float':
                return (float) $value;
            case 'date':
                return Carbon::parse($value);
            case 'json':
                return json_decode($value, true);
            default:
                return $value;
        }
    }

    /**
     * Detect the type of a value.
     */
    private static function detectType($value): string
    {
        if (is_bool($value)) {
            return 'boolean';
        }
        if (is_int($value)) {
            return 'integer';
        }
        if (is_float($value)) {
            return 'float';
        }
        if ($value instanceof Carbon) {
            return 'date';
        }
        if (is_array($value) || is_object($value)) {
            return 'json';
        }
        
        return 'string';
    }

    /**
     * Convert value to string for storage.
     */
    private static function valueToString($value, string $type): string
    {
        switch ($type) {
            case 'boolean':
                return $value ? '1' : '0';
            case 'date':
                return $value instanceof Carbon ? $value->toDateTimeString() : (string) $value;
            case 'json':
                return json_encode($value);
            default:
                return (string) $value;
        }
    }
}