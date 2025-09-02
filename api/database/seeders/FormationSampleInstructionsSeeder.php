<?php

namespace Database\Seeders;

use App\Models\Formation;
use Illuminate\Database\Seeder;

class FormationSampleInstructionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $formations = Formation::all();
        
        foreach ($formations as $formation) {
            $sampleInstructions = $this->getSampleInstructionsForFormation($formation);
            $formation->update(['sample_instructions' => $sampleInstructions]);
        }
    }
    
    private function getSampleInstructionsForFormation(Formation $formation): array
    {
        $baseInstructions = [
            'attacking_width' => 'standard',
            'approach_play' => 'balanced',
            'passing_directness' => 'standard',
            'tempo' => 'standard',
            'time_wasting' => 'never',
            'final_third' => 'mixed',
            'creative_freedom' => 'balanced',
            'counter_press' => false,
            'counter_attack' => false,
            'regroup' => false,
            'hold_shape' => false,
            'goalkeeper_distribution' => 'mixed',
            'defensive_line' => 'standard',
            'line_of_engagement' => 'standard',
            'pressing_intensity' => 'balanced',
            'prevent_short_gk_distribution' => false,
            'tackling' => 'balanced',
            'pressing_trap' => 'none',
        ];
        
        // Customize based on formation name and style
        switch ($formation->name) {
            case '4-3-3':
                return array_merge($baseInstructions, [
                    'attacking_width' => 'wide',
                    'approach_play' => 'more_direct',
                    'final_third' => 'work_ball_into_box',
                    'creative_freedom' => 'expressive',
                    'counter_press' => true,
                    'defensive_line' => 'high',
                    'line_of_engagement' => 'high',
                    'pressing_intensity' => 'often',
                ]);
                
            case '4-4-2':
                return array_merge($baseInstructions, [
                    'attacking_width' => 'standard',
                    'approach_play' => 'balanced',
                    'final_third' => 'mixed',
                    'creative_freedom' => 'balanced',
                    'hold_shape' => true,
                    'defensive_line' => 'standard',
                    'line_of_engagement' => 'standard',
                    'pressing_intensity' => 'balanced',
                ]);
                
            case '4-2-3-1':
                return array_merge($baseInstructions, [
                    'attacking_width' => 'wide',
                    'approach_play' => 'patient',
                    'passing_directness' => 'short',
                    'final_third' => 'work_ball_into_box',
                    'creative_freedom' => 'expressive',
                    'counter_attack' => true,
                    'defensive_line' => 'standard',
                    'line_of_engagement' => 'standard',
                    'pressing_intensity' => 'balanced',
                ]);
                
            case '3-5-2':
                return array_merge($baseInstructions, [
                    'attacking_width' => 'very_wide',
                    'approach_play' => 'more_direct',
                    'final_third' => 'low_crosses',
                    'creative_freedom' => 'balanced',
                    'counter_attack' => true,
                    'defensive_line' => 'standard',
                    'line_of_engagement' => 'standard',
                    'pressing_intensity' => 'balanced',
                ]);
                
            case '5-3-2':
                return array_merge($baseInstructions, [
                    'attacking_width' => 'narrow',
                    'approach_play' => 'patient',
                    'passing_directness' => 'direct',
                    'tempo' => 'slow',
                    'final_third' => 'hit_early_crosses',
                    'creative_freedom' => 'disciplined',
                    'regroup' => true,
                    'defensive_line' => 'deep',
                    'line_of_engagement' => 'deep',
                    'pressing_intensity' => 'rarely',
                ]);
                
            case '4-1-4-1':
                return array_merge($baseInstructions, [
                    'attacking_width' => 'standard',
                    'approach_play' => 'patient',
                    'passing_directness' => 'short',
                    'final_third' => 'work_ball_into_box',
                    'creative_freedom' => 'balanced',
                    'hold_shape' => true,
                    'defensive_line' => 'standard',
                    'line_of_engagement' => 'standard',
                    'pressing_intensity' => 'balanced',
                ]);
                
            case '5-4-1':
                return array_merge($baseInstructions, [
                    'attacking_width' => 'narrow',
                    'approach_play' => 'more_direct',
                    'passing_directness' => 'direct',
                    'tempo' => 'fast',
                    'final_third' => 'hit_early_crosses',
                    'creative_freedom' => 'disciplined',
                    'counter_attack' => true,
                    'regroup' => true,
                    'defensive_line' => 'very_deep',
                    'line_of_engagement' => 'deep',
                    'pressing_intensity' => 'never',
                ]);
                
            default:
                // Apply style-based defaults for unknown formations
                switch ($formation->style) {
                    case 'attacking':
                        return array_merge($baseInstructions, [
                            'attacking_width' => 'wide',
                            'approach_play' => 'more_direct',
                            'final_third' => 'work_ball_into_box',
                            'creative_freedom' => 'expressive',
                            'counter_press' => true,
                            'defensive_line' => 'high',
                            'line_of_engagement' => 'high',
                            'pressing_intensity' => 'often',
                        ]);
                        
                    case 'defensive':
                        return array_merge($baseInstructions, [
                            'attacking_width' => 'narrow',
                            'approach_play' => 'patient',
                            'passing_directness' => 'direct',
                            'final_third' => 'hit_early_crosses',
                            'creative_freedom' => 'disciplined',
                            'regroup' => true,
                            'defensive_line' => 'deep',
                            'line_of_engagement' => 'deep',
                            'pressing_intensity' => 'rarely',
                        ]);
                        
                    default: // balanced
                        return $baseInstructions;
                }
        }
    }
}