<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tactics', function (Blueprint $table) {
            // In Possession fields
            $table->string('attacking_width')->default('standard')->after('characteristics');
            $table->string('approach_play')->default('balanced')->after('attacking_width');
            $table->string('passing_directness')->default('standard')->after('approach_play');
            $table->string('time_wasting')->default('never')->after('passing_directness');
            $table->string('final_third')->default('mixed')->after('time_wasting');
            $table->string('creative_freedom')->default('balanced')->after('final_third');
            
            // Transition fields
            $table->boolean('counter_press')->default(false)->after('creative_freedom');
            $table->boolean('counter_attack')->default(false)->after('counter_press');
            $table->boolean('regroup')->default(false)->after('counter_attack');
            $table->boolean('hold_shape')->default(false)->after('regroup');
            $table->string('goalkeeper_distribution')->default('mixed')->after('hold_shape');
            
            // Out of Possession fields
            $table->string('line_of_engagement')->default('standard')->after('goalkeeper_distribution');
            $table->string('pressing_intensity')->default('balanced')->after('line_of_engagement');
            $table->boolean('prevent_short_gk_distribution')->default(false)->after('pressing_intensity');
            $table->string('tackling')->default('balanced')->after('prevent_short_gk_distribution');
            $table->string('pressing_trap')->default('none')->after('tackling');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tactics', function (Blueprint $table) {
            $table->dropColumn([
                'attacking_width',
                'approach_play', 
                'passing_directness',
                'time_wasting',
                'final_third',
                'creative_freedom',
                'counter_press',
                'counter_attack',
                'regroup',
                'hold_shape',
                'goalkeeper_distribution',
                'line_of_engagement',
                'pressing_intensity',
                'prevent_short_gk_distribution',
                'tackling',
                'pressing_trap'
            ]);
        });
    }
};