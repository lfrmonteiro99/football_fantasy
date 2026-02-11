<?php

declare(strict_types=1);

namespace App\Services\Simulation;

use App\Models\Formation;
use App\Models\GameMatch;
use App\Models\Player;
use App\Models\Tactic;
use App\Models\Team;

/**
 * Mutable game state container for the tick-based simulation engine.
 *
 * Holds all runtime data for a single match: lineups, score, per-player
 * state, cumulative statistics, and ball position. The SimulationEngine
 * mutates this object each minute and reads from it to produce tick data.
 */
class MatchState
{
    public int $minute = 0;

    /** @var array{home: int, away: int} */
    public array $score = ['home' => 0, 'away' => 0];

    /** Current possessing side: 'home'|'away' */
    public string $possession = 'home';

    /** Current pitch zone relative to possessing team: 'def_home'|'mid'|'att_home' */
    public string $zone = 'mid';

    /** Current ball position on pitch (0-100 coordinate system) */
    public array $ball = ['x' => 50.0, 'y' => 50.0];

    /** @var array<int, Player> Starting XI indexed by player id */
    public array $homeLineup = [];

    /** @var array<int, Player> Starting XI indexed by player id */
    public array $awayLineup = [];

    /** @var array<int, Player> Bench players indexed by player id */
    public array $homeBench = [];

    /** @var array<int, Player> Bench players indexed by player id */
    public array $awayBench = [];

    /**
     * Per-player runtime state.
     *
     * @var array<int, array{fatigue: float, yellow_cards: int, is_sent_off: bool, is_subbed_off: bool, goals: int, assists: int, position: string, morale: float}>
     */
    public array $playerStates = [];

    /** @var array<int, array{minute: int, player_in_id: int, player_out_id: int}> */
    public array $homeSubstitutions = [];

    /** @var array<int, array{minute: int, player_in_id: int, player_out_id: int}> */
    public array $awaySubstitutions = [];

    public int $homePossessionMinutes = 0;
    public int $awayPossessionMinutes = 0;

    /** @var array{home: array<string, int|float>, away: array<string, int|float>} */
    public array $stats = [
        'home' => [
            'possession_pct' => 50.0,
            'shots' => 0,
            'shots_on_target' => 0,
            'corners' => 0,
            'fouls' => 0,
            'yellow_cards' => 0,
            'red_cards' => 0,
            'saves' => 0,
            'passes' => 0,
            'tackles' => 0,
            'offsides' => 0,
        ],
        'away' => [
            'possession_pct' => 50.0,
            'shots' => 0,
            'shots_on_target' => 0,
            'corners' => 0,
            'fouls' => 0,
            'yellow_cards' => 0,
            'red_cards' => 0,
            'saves' => 0,
            'passes' => 0,
            'tackles' => 0,
            'offsides' => 0,
        ],
    ];

    /**
     * Designated set-piece takers (player IDs).
     *
     * @var array{corner: int|null, free_kick: int|null, penalty: int|null}
     */
    public array $homeSetPieceTakers = ['corner' => null, 'free_kick' => null, 'penalty' => null];

    /** @var array{corner: int|null, free_kick: int|null, penalty: int|null} */
    public array $awaySetPieceTakers = ['corner' => null, 'free_kick' => null, 'penalty' => null];

    public ?Team $homeTeam = null;
    public ?Team $awayTeam = null;
    public ?Formation $homeFormation = null;
    public ?Formation $awayFormation = null;
    public ?Tactic $homeTactic = null;
    public ?Tactic $awayTactic = null;

    /** Injury time minutes to add at end of each half */
    public int $firstHalfInjuryTime = 0;
    public int $secondHalfInjuryTime = 0;

    /**
     * Current simulation phase.
     * One of: kickoff, open_play, attack_home, attack_away, set_piece, half_time, full_time
     */
    public string $phase = 'kickoff';

    /**
     * Get the lineup array for a given side.
     *
     * @return array<int, Player>
     */
    public function getLineup(string $side): array
    {
        return $side === 'home' ? $this->homeLineup : $this->awayLineup;
    }

    /**
     * Get the bench array for a given side.
     *
     * @return array<int, Player>
     */
    public function getBench(string $side): array
    {
        return $side === 'home' ? $this->homeBench : $this->awayBench;
    }

    /**
     * Get substitutions count for a side.
     */
    public function getSubstitutionCount(string $side): int
    {
        return $side === 'home'
            ? count($this->homeSubstitutions)
            : count($this->awaySubstitutions);
    }

    /**
     * Get available (not sent off, not subbed off) players from a lineup.
     *
     * @return array<int, Player>
     */
    public function getAvailablePlayers(string $side): array
    {
        $lineup = $this->getLineup($side);
        $available = [];

        foreach ($lineup as $id => $player) {
            $state = $this->playerStates[$id] ?? null;
            if ($state && ($state['is_sent_off'] || $state['is_subbed_off'])) {
                continue;
            }
            $available[$id] = $player;
        }

        return $available;
    }

    /**
     * Get available outfield players (excludes GK) for a side.
     *
     * @return array<int, Player>
     */
    public function getAvailableOutfieldPlayers(string $side): array
    {
        $players = $this->getAvailablePlayers($side);

        return array_filter($players, function (Player $player) {
            $state = $this->playerStates[$player->id] ?? null;
            return $state && $state['position'] !== 'GK';
        });
    }

    /**
     * Get the goalkeeper for a side.
     */
    public function getGoalkeeper(string $side): ?Player
    {
        $lineup = $this->getLineup($side);

        foreach ($lineup as $id => $player) {
            $state = $this->playerStates[$id] ?? null;
            if ($state && $state['position'] === 'GK' && !$state['is_sent_off'] && !$state['is_subbed_off']) {
                return $player;
            }
        }

        return null;
    }

    /**
     * Get the opposing side.
     */
    public function opponent(string $side): string
    {
        return $side === 'home' ? 'away' : 'home';
    }

    /**
     * Get a player's effective attribute value with a 5-layer modifier chain:
     *   1. Fatigue (post-60 min reduction up to 25%)
     *   2. Morale (below 5 = penalty, above 7 = bonus)
     *   3. Home advantage (+3% home, -2% mental for away)
     *   4. Position familiarity (out-of-position penalty)
     *   5. Tactic modifiers (mentality, pressing, tempo, width, etc.)
     */
    public function getEffectiveAttribute(int $playerId, string $attribute): float
    {
        // Get player and base value
        $player = $this->homeLineup[$playerId] ?? $this->awayLineup[$playerId] ?? null;
        if (!$player || !$player->attributes) {
            return 10.0;
        }

        $baseValue = (float) ($player->attributes->{$attribute} ?? 10);
        $state = $this->playerStates[$playerId] ?? null;
        if (!$state) {
            return $baseValue;
        }

        $modifier = 1.0;

        // LAYER 1: Fatigue (existing logic, kept as-is)
        // After minute 60, fatigue reduces attributes up to 25%
        $fatigue = $state['fatigue'];
        if ($this->minute > 60 && $fatigue > 0) {
            $modifier *= (1.0 - $fatigue * 0.25);
        }

        // LAYER 2: Morale
        // morale is 1-10 scale, 7 = neutral
        // Below 5: -5% to -12%
        // Above 7: +3% to +9%
        $morale = $state['morale'] ?? 7.0;
        if ($morale < 5.0) {
            // Linear: morale 1 = -12%, morale 4.9 = ~-5%
            $moralePenalty = 0.05 + (5.0 - $morale) * 0.0175;
            $modifier *= (1.0 - $moralePenalty);
        } elseif ($morale > 7.0) {
            // Linear: morale 7.1 = ~+0.3%, morale 10 = +9%
            $moraleBonus = ($morale - 7.0) * 0.03;
            $modifier *= (1.0 + $moraleBonus);
        }

        // LAYER 3: Home advantage
        // Home team gets +3% to all attributes
        // Away team gets -2% to mental attributes
        $side = isset($this->homeLineup[$playerId]) ? 'home' : 'away';
        if ($side === 'home') {
            $modifier *= 1.03;
        } else {
            $mentalAttrs = ['composure', 'concentration', 'decisions', 'aggression', 'anticipation', 'bravery', 'determination', 'flair', 'leadership', 'off_the_ball', 'positioning', 'teamwork', 'vision', 'work_rate'];
            if (in_array($attribute, $mentalAttrs, true)) {
                $modifier *= 0.98;
            }
        }

        // LAYER 4: Position familiarity
        // If player is playing out of their natural position, penalize attributes
        $assignedPosition = $state['position'] ?? '';
        $naturalPosition = $player->primaryPosition->short_name ?? '';
        if ($assignedPosition && $naturalPosition && $assignedPosition !== $naturalPosition) {
            $penalty = $this->getPositionMismatchPenalty($naturalPosition, $assignedPosition, $attribute);
            $modifier *= (1.0 - $penalty);
        }

        // LAYER 5: Tactic modifier
        // The team's tactic settings modify certain attributes
        $tactic = $side === 'home' ? $this->homeTactic : $this->awayTactic;
        if ($tactic) {
            $modifier *= $this->getTacticAttributeModifier($tactic, $attribute, $state['position'] ?? '');
        }

        return max(1.0, $baseValue * $modifier);
    }

    /**
     * Calculate position mismatch penalty based on how far a player is from their natural position.
     *
     * Returns a penalty fraction (0.0 to 0.50) scaled by attribute type:
     *   - Technical attributes get the full penalty
     *   - Mental attributes get 60% of the penalty
     *   - Physical attributes get 30% of the penalty
     *
     * Position distance tiers:
     *   Compatible (adjacent): 5% base penalty
     *   Stretched: 15% base penalty
     *   Major mismatch: 30% base penalty
     *   Catastrophic (GK <-> outfield): 50% base penalty
     */
    private function getPositionMismatchPenalty(string $naturalPos, string $assignedPos, string $attribute): float
    {
        // Define position distance groups
        $compatible = [
            'CB' => ['SW', 'DM'],
            'SW' => ['CB'],
            'LB' => ['LM', 'WB'],
            'RB' => ['RM', 'WB'],
            'WB' => ['LB', 'RB', 'LM', 'RM'],
            'DM' => ['CM', 'CB'],
            'CM' => ['DM', 'AM'],
            'AM' => ['CM', 'LW', 'RW'],
            'LM' => ['LW', 'LB'],
            'RM' => ['RW', 'RB'],
            'LW' => ['LM', 'AM', 'ST'],
            'RW' => ['RM', 'AM', 'ST'],
            'ST' => ['CF', 'F9'],
            'CF' => ['ST', 'F9', 'AM'],
            'F9' => ['CF', 'ST', 'AM'],
        ];

        $stretched = [
            'CB' => ['LB', 'RB', 'CM'],
            'LB' => ['CB', 'RB'],
            'RB' => ['CB', 'LB'],
            'DM' => ['AM', 'LM', 'RM'],
            'CM' => ['LM', 'RM', 'DM'],
            'AM' => ['ST', 'DM'],
            'LM' => ['CM', 'LW'],
            'RM' => ['CM', 'RW'],
            'LW' => ['RW', 'ST'],
            'RW' => ['LW', 'ST'],
            'ST' => ['AM', 'LW', 'RW'],
            'CF' => ['LW', 'RW'],
            'F9' => ['LW', 'RW'],
        ];

        // Determine tier
        if (in_array($assignedPos, $compatible[$naturalPos] ?? [], true)) {
            $basePenalty = 0.05; // 5% for compatible
        } elseif (in_array($assignedPos, $stretched[$naturalPos] ?? [], true)) {
            $basePenalty = 0.15; // 15% for stretched
        } elseif ($assignedPos === 'GK' || $naturalPos === 'GK') {
            $basePenalty = 0.50; // Catastrophic: outfield to GK or GK to outfield
        } else {
            $basePenalty = 0.30; // Major mismatch (everything else)
        }

        // Attribute type scaling: technical gets full penalty, mental 60%, physical 30%
        $technicalAttrs = ['finishing', 'first_touch', 'free_kick_taking', 'heading', 'long_shots', 'long_throws', 'marking', 'passing', 'penalty_taking', 'tackling', 'technique', 'corners', 'crossing', 'dribbling'];
        $physicalAttrs = ['acceleration', 'agility', 'balance', 'jumping_reach', 'natural_fitness', 'pace', 'stamina', 'strength'];
        // GK attrs get full penalty when out of position
        $gkAttrs = ['aerial_reach', 'command_of_area', 'communication', 'eccentricity', 'handling', 'kicking', 'one_on_ones', 'reflexes', 'rushing_out', 'throwing'];

        if (in_array($attribute, $physicalAttrs, true)) {
            return $basePenalty * 0.3;
        } elseif (in_array($attribute, $technicalAttrs, true) || in_array($attribute, $gkAttrs, true)) {
            return $basePenalty; // Full penalty
        } else {
            // Mental attributes
            return $basePenalty * 0.6;
        }
    }

    /**
     * Calculate tactic-based attribute modifier.
     *
     * Examines the team's tactic settings (mentality, pressing, tempo, width,
     * creative freedom, etc.) and returns a multiplier for the given attribute
     * and position. For example, an attacking mentality boosts finishing (+5-8%)
     * but reduces tackling (-5-10%).
     *
     * @return float Multiplier (e.g. 1.08 for +8%, 0.90 for -10%)
     */
    private function getTacticAttributeModifier(?Tactic $tactic, string $attribute, string $position): float
    {
        if (!$tactic) {
            return 1.0;
        }

        $mod = 1.0;

        // MENTALITY
        $mentality = $tactic->mentality ?? 'balanced';
        $attackingAttrs = ['finishing', 'long_shots', 'off_the_ball', 'dribbling', 'crossing'];
        $defensiveAttrs = ['tackling', 'marking', 'positioning', 'concentration', 'anticipation'];

        $mentalityMultipliers = [
            'very_attacking' => ['atk' => 1.08, 'def' => 0.90],
            'attacking'      => ['atk' => 1.05, 'def' => 0.95],
            'balanced'       => ['atk' => 1.0,  'def' => 1.0],
            'defensive'      => ['atk' => 0.95, 'def' => 1.05],
            'very_defensive' => ['atk' => 0.90, 'def' => 1.08],
        ];

        $mm = $mentalityMultipliers[$mentality] ?? $mentalityMultipliers['balanced'];
        if (in_array($attribute, $attackingAttrs, true)) {
            $mod *= $mm['atk'];
        } elseif (in_array($attribute, $defensiveAttrs, true)) {
            $mod *= $mm['def'];
        }

        // PRESSING affects stamina drain (handled elsewhere) and work-rate importance
        $pressing = $tactic->pressing ?? 'sometimes';
        if ((in_array($pressing, ['often', 'always'], true) || $tactic->close_down_more)
            && in_array($attribute, ['anticipation', 'work_rate', 'teamwork'], true)) {
            $mod *= 1.05;
        }

        // TEMPO affects decision-making
        $tempo = $tactic->tempo ?? 'standard';
        if (($tempo === 'very_fast' || $tempo === 'fast') && in_array($attribute, ['decisions', 'first_touch', 'technique'], true)) {
            $mod *= 1.04; // Slightly boost these as they become more important
        } elseif (($tempo === 'very_slow' || $tempo === 'slow') && in_array($attribute, ['composure', 'vision'], true)) {
            $mod *= 1.04;
        }

        // WIDTH affects wing positions
        $width = $tactic->width ?? 'standard';
        $wingPositions = ['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'WB'];
        if (($width === 'very_wide' || $width === 'wide') && in_array($position, $wingPositions, true)) {
            if (in_array($attribute, ['crossing', 'pace', 'stamina'], true)) {
                $mod *= 1.06;
            }
        } elseif (($width === 'narrow' || $width === 'very_narrow')) {
            if (in_array($attribute, ['passing', 'vision', 'dribbling'], true)) {
                $mod *= 1.04; // Central play emphasized
            }
        }

        // TACKLE HARDER / GET STUCK IN
        if ($tactic->tackle_harder || $tactic->get_stuck_in) {
            if ($attribute === 'tackling') {
                $mod *= 1.08;
            }
            if ($attribute === 'aggression') {
                $mod *= 1.10;
            }
        }

        // STAY ON FEET reduces aggression (cleaner tackles)
        if (($tactic->tackling ?? 'balanced') === 'stay_on_feet') {
            if ($attribute === 'aggression') {
                $mod *= 0.90;
            }
        }

        // PLAY OUT OF DEFENCE boosts passing for defenders
        if (($tactic->play_out_of_defence ?? false) && in_array($position, ['CB', 'GK', 'SW', 'DM'], true)) {
            if (in_array($attribute, ['passing', 'composure', 'first_touch'], true)) {
                $mod *= 1.05;
            }
        }

        // CREATIVE FREEDOM affects flair
        $cf = $tactic->creative_freedom ?? 'medium';
        if (($cf === 'high' || $cf === 'very_high') && $attribute === 'flair') {
            $mod *= 1.15;
        } elseif (($cf === 'low' || $cf === 'very_low') && $attribute === 'flair') {
            $mod *= 0.85;
        }

        return $mod;
    }

    /**
     * Update individual player morale after an event.
     */
    public function updatePlayerMorale(int $playerId, string $event): void
    {
        if (!isset($this->playerStates[$playerId])) {
            return;
        }

        $delta = match ($event) {
            'goal_scored' => 1.5,
            'assist' => 1.0,
            'goal_conceded' => -0.3,
            'yellow_card' => -0.8,
            'red_card' => -2.0,
            'missed_penalty' => -2.0,
            'penalty_saved_by_gk' => 2.0,
            'substituted_off' => -0.3,
            default => 0.0,
        };

        $current = $this->playerStates[$playerId]['morale'] ?? 7.0;
        $this->playerStates[$playerId]['morale'] = max(1.0, min(10.0, $current + $delta));
    }

    /**
     * Update morale for all players on a side.
     */
    public function updateTeamMorale(string $side, float $delta): void
    {
        $lineup = $this->getLineup($side);
        foreach ($lineup as $id => $player) {
            if (isset($this->playerStates[$id]) && !($this->playerStates[$id]['is_sent_off'] ?? false) && !($this->playerStates[$id]['is_subbed_off'] ?? false)) {
                // Leadership reduces negative morale impact
                if ($delta < 0) {
                    $leadership = (float) ($player->attributes->leadership ?? 10);
                    if ($leadership > 14) {
                        $delta *= 0.85; // High leaders reduce negative impact by 15%
                    }
                }
                $current = $this->playerStates[$id]['morale'] ?? 7.0;
                $this->playerStates[$id]['morale'] = max(1.0, min(10.0, $current + $delta));
            }
        }
    }

    /**
     * Natural morale recovery toward neutral (7.0) over time.
     * Called each minute to gradually normalize morale.
     */
    public function decayMorale(): void
    {
        foreach ($this->playerStates as $id => &$state) {
            if ($state['is_sent_off'] || $state['is_subbed_off']) {
                continue;
            }

            $morale = $state['morale'] ?? 7.0;
            if (abs($morale - 7.0) > 0.1) {
                // Decay 2% toward neutral each minute
                $state['morale'] = $morale + (7.0 - $morale) * 0.02;
            }
        }
    }

    /**
     * Recalculate possession percentages from accumulated minutes.
     */
    public function recalculatePossession(): void
    {
        $total = $this->homePossessionMinutes + $this->awayPossessionMinutes;
        if ($total > 0) {
            $this->stats['home']['possession_pct'] = round(($this->homePossessionMinutes / $total) * 100, 1);
            $this->stats['away']['possession_pct'] = round(($this->awayPossessionMinutes / $total) * 100, 1);
        }
    }

    /**
     * Build the tick output array for the current state.
     *
     * @param array $events Events that occurred this minute
     * @param string $commentary Text commentary for this minute
     */
    public function toTickArray(array $events, string $commentary): array
    {
        return [
            'minute' => $this->minute,
            'phase' => $this->phase,
            'possession' => $this->possession,
            'zone' => $this->zone,
            'ball' => $this->ball,
            'events' => $events,
            'score' => $this->score,
            'stats' => [
                'home' => $this->stats['home'],
                'away' => $this->stats['away'],
            ],
            'commentary' => $commentary,
        ];
    }
}
