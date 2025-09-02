<?php

namespace App\Services;

use App\Models\Tactic;

class TacticalAnalysisService
{
    /**
     * Generate characteristics based on tactic configuration
     */
    public function generateCharacteristics(Tactic $tactic): array
    {
        $characteristics = [];
        
        // Formation-based characteristics
        $characteristics = array_merge($characteristics, $this->getFormationCharacteristics($tactic));
        
        // Position-based characteristics (from custom positions)
        $characteristics = array_merge($characteristics, $this->getPositionCharacteristics($tactic));
        
        // Instruction-based characteristics
        $characteristics = array_merge($characteristics, $this->getInstructionCharacteristics($tactic));
        
        // Mentality-based characteristics
        $characteristics = array_merge($characteristics, $this->getMentalityCharacteristics($tactic));
        
        // Remove duplicates and limit to reasonable number
        $characteristics = array_unique($characteristics);
        
        // Sort by importance/relevance and limit to 8-10 characteristics
        return array_slice($characteristics, 0, 10);
    }
    
    /**
     * Get characteristics based on formation structure
     */
    private function getFormationCharacteristics(Tactic $tactic): array
    {
        $characteristics = [];
        $formation = $tactic->formation;
        
        if (!$formation) return $characteristics;
        
        // Defensive structure
        if ($formation->defenders_count >= 5) {
            $characteristics[] = 'Solid defensive foundation';
            $characteristics[] = 'Strong defensive shape';
        } elseif ($formation->defenders_count <= 3) {
            $characteristics[] = 'High-risk defensive setup';
            $characteristics[] = 'Vulnerable to counter-attacks';
        }
        
        // Midfield dominance
        if ($formation->midfielders_count >= 5) {
            $characteristics[] = 'Midfield overload';
            $characteristics[] = 'Superior ball retention';
            $characteristics[] = 'Tactical flexibility';
        } elseif ($formation->midfielders_count <= 2) {
            $characteristics[] = 'Direct transition play';
            $characteristics[] = 'Risk of midfield bypass';
        }
        
        // Attacking threat
        if ($formation->forwards_count >= 3) {
            $characteristics[] = 'Multi-pronged attack';
            $characteristics[] = 'Constant attacking threat';
        } elseif ($formation->forwards_count == 1) {
            $characteristics[] = 'Lone striker system';
            $characteristics[] = 'Relies on midfield support';
        }
        
        // Specific formation patterns
        if ($formation->name === '4-3-3') {
            $characteristics[] = 'Wide attacking threat';
            $characteristics[] = 'High pressing capability';
        } elseif ($formation->name === '4-4-2') {
            $characteristics[] = 'Traditional structure';
            $characteristics[] = 'Balanced approach';
        } elseif (strpos($formation->name, '3-') === 0) {
            $characteristics[] = 'Wing-back dependency';
            $characteristics[] = 'Central overload';
        }
        
        return $characteristics;
    }
    
    /**
     * Get characteristics based on custom positions
     */
    private function getPositionCharacteristics(Tactic $tactic): array
    {
        $characteristics = [];
        
        if (!$tactic->custom_positions || !is_array($tactic->custom_positions)) {
            return $characteristics;
        }
        
        $positions = $tactic->custom_positions;
        $positionCounts = $this->analyzePositions($positions);
        
        // Wide play analysis
        $widePositions = $this->countWidePositions($positions);
        if ($widePositions >= 4) {
            $characteristics[] = 'Emphasis on wide play';
            $characteristics[] = 'Wing-oriented attacks';
        } elseif ($widePositions <= 1) {
            $characteristics[] = 'Narrow attacking focus';
            $characteristics[] = 'Central concentration';
        }
        
        // Defensive line height
        $defensiveLineHeight = $this->calculateDefensiveLineHeight($positions);
        if ($defensiveLineHeight > 35) {
            $characteristics[] = 'High defensive line';
            $characteristics[] = 'Aggressive positioning';
        } elseif ($defensiveLineHeight < 25) {
            $characteristics[] = 'Deep defensive block';
            $characteristics[] = 'Counter-attacking setup';
        }
        
        // Midfield positioning
        $midfielderSpread = $this->calculateMidfielderSpread($positions);
        if ($midfielderSpread > 30) {
            $characteristics[] = 'Wide midfield coverage';
        } else {
            $characteristics[] = 'Compact midfield';
        }
        
        return $characteristics;
    }
    
    /**
     * Get characteristics based on tactical instructions
     */
    private function getInstructionCharacteristics(Tactic $tactic): array
    {
        $characteristics = [];
        
        // Attacking width
        switch ($tactic->attacking_width) {
            case 'very_wide':
            case 'wide':
                $characteristics[] = 'Stretches play wide';
                $characteristics[] = 'Wing-focused attacks';
                break;
            case 'very_narrow':
            case 'narrow':
                $characteristics[] = 'Narrow attacking play';
                $characteristics[] = 'Central penetration';
                break;
        }
        
        // Approach play
        switch ($tactic->approach_play) {
            case 'more_direct':
                $characteristics[] = 'Direct attacking approach';
                $characteristics[] = 'Quick transitions';
                break;
            case 'patient':
                $characteristics[] = 'Patient build-up play';
                $characteristics[] = 'Possession-based approach';
                break;
        }
        
        // Passing directness
        switch ($tactic->passing_directness) {
            case 'very_short':
            case 'short':
                $characteristics[] = 'Short passing network';
                $characteristics[] = 'Technical precision';
                break;
            case 'direct':
            case 'very_direct':
                $characteristics[] = 'Direct passing style';
                $characteristics[] = 'Vertical progression';
                break;
        }
        
        // Tempo
        switch ($tactic->tempo) {
            case 'very_fast':
            case 'fast':
                $characteristics[] = 'High-tempo play';
                $characteristics[] = 'Intense pressing';
                break;
            case 'very_slow':
            case 'slow':
                $characteristics[] = 'Controlled tempo';
                $characteristics[] = 'Methodical approach';
                break;
        }
        
        // Transition instructions
        if ($tactic->counter_press) {
            $characteristics[] = 'Aggressive counter-pressing';
            $characteristics[] = 'Immediate ball recovery';
        }
        
        if ($tactic->counter_attack) {
            $characteristics[] = 'Rapid counter-attacks';
            $characteristics[] = 'Direct transitions';
        }
        
        // Pressing intensity
        switch ($tactic->pressing_intensity) {
            case 'often':
            case 'always':
                $characteristics[] = 'High pressing game';
                $characteristics[] = 'Aggressive ball winning';
                break;
            case 'never':
            case 'rarely':
                $characteristics[] = 'Defensive patience';
                $characteristics[] = 'Structured defending';
                break;
        }
        
        // Defensive line
        switch ($tactic->defensive_line) {
            case 'very_high':
            case 'high':
                $characteristics[] = 'High defensive line';
                $characteristics[] = 'Aggressive positioning';
                break;
            case 'very_deep':
            case 'deep':
                $characteristics[] = 'Deep defensive block';
                $characteristics[] = 'Counter-attacking focus';
                break;
        }
        
        return $characteristics;
    }
    
    /**
     * Get characteristics based on mentality
     */
    private function getMentalityCharacteristics(Tactic $tactic): array
    {
        $characteristics = [];
        
        switch ($tactic->mentality) {
            case 'very_attacking':
                $characteristics[] = 'Ultra-aggressive approach';
                $characteristics[] = 'All-out attack mentality';
                $characteristics[] = 'High-risk, high-reward';
                break;
            case 'attacking':
                $characteristics[] = 'Attacking mindset';
                $characteristics[] = 'Forward-thinking play';
                $characteristics[] = 'Proactive approach';
                break;
            case 'balanced':
                $characteristics[] = 'Tactical balance';
                $characteristics[] = 'Adaptable system';
                break;
            case 'defensive':
                $characteristics[] = 'Defensive stability';
                $characteristics[] = 'Disciplined structure';
                $characteristics[] = 'Safety-first approach';
                break;
            case 'very_defensive':
                $characteristics[] = 'Ultra-defensive setup';
                $characteristics[] = 'Damage limitation';
                $characteristics[] = 'Rigid defensive structure';
                break;
        }
        
        return $characteristics;
    }
    
    /**
     * Helper methods for position analysis
     */
    private function analyzePositions(array $positions): array
    {
        $counts = [
            'defenders' => 0,
            'midfielders' => 0,
            'forwards' => 0
        ];
        
        foreach ($positions as $position) {
            $pos = $position['position'] ?? '';
            if (in_array($pos, ['CB', 'LB', 'RB', 'WB', 'SW'])) {
                $counts['defenders']++;
            } elseif (in_array($pos, ['DM', 'CM', 'AM', 'LM', 'RM'])) {
                $counts['midfielders']++;
            } elseif (in_array($pos, ['ST', 'CF', 'LW', 'RW', 'F9'])) {
                $counts['forwards']++;
            }
        }
        
        return $counts;
    }
    
    private function countWidePositions(array $positions): int
    {
        $count = 0;
        foreach ($positions as $position) {
            $x = $position['x'] ?? 50;
            if ($x < 20 || $x > 80) {
                $count++;
            }
        }
        return $count;
    }
    
    private function calculateDefensiveLineHeight(array $positions): float
    {
        $defenderYPositions = [];
        foreach ($positions as $position) {
            $pos = $position['position'] ?? '';
            if (in_array($pos, ['CB', 'LB', 'RB', 'WB', 'SW'])) {
                $defenderYPositions[] = $position['y'] ?? 25;
            }
        }
        
        return empty($defenderYPositions) ? 25 : array_sum($defenderYPositions) / count($defenderYPositions);
    }
    
    private function calculateMidfielderSpread(array $positions): float
    {
        $midfielderXPositions = [];
        foreach ($positions as $position) {
            $pos = $position['position'] ?? '';
            if (in_array($pos, ['DM', 'CM', 'AM', 'LM', 'RM'])) {
                $midfielderXPositions[] = $position['x'] ?? 50;
            }
        }
        
        if (empty($midfielderXPositions)) return 0;
        
        return max($midfielderXPositions) - min($midfielderXPositions);
    }
}