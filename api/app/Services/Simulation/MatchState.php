<?php

declare(strict_types=1);

namespace App\Services\Simulation;

use App\Models\Formation;
use App\Models\GameMatch;
use App\Models\Player;
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
     * @var array<int, array{fatigue: float, yellow_cards: int, is_sent_off: bool, is_subbed_off: bool, goals: int, assists: int, position: string}>
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

    /** Injury time minutes to add at end of each half */
    public int $firstHalfInjuryTime = 0;
    public int $secondHalfInjuryTime = 0;

    /**
     * Current simulation phase.
     * One of: kickoff, open_play, attack_home, attack_away, set_piece, half_time, full_time
     */
    public string $phase = 'kickoff';

    // =========================================================================
    //  NARRATIVE TRACKING (used by CommentaryBuilder for richer commentary)
    // =========================================================================

    /** Consecutive minutes the same team has had possession */
    public int $consecutivePossessionMinutes = 0;

    /** Side that had possession last minute (for tracking streaks) */
    public string $lastPossessionSide = '';

    /** Minutes since the last notable event (goal, card, shot on target) */
    public int $minutesSinceLastEvent = 0;

    /** Track per-player in-match saves for "another save" commentary */
    public array $playerMatchSaves = [];

    /** Track per-player in-match shots for "another chance" commentary */
    public array $playerMatchShots = [];

    /** Last scorer player ID (for "scores again" commentary) */
    public ?int $lastScorerId = null;

    /** Minute of last goal (for "quick-fire double" commentary) */
    public ?int $lastGoalMinute = null;

    /** Side that scored last (for comeback tracking) */
    public ?string $lastGoalSide = null;

    /** Track score history for comeback detection: [[minute, home, away], ...] */
    public array $scoreHistory = [];

    /** Number of color commentary lines emitted (to avoid spamming) */
    public int $colorCommentaryCount = 0;

    /** Last minute a color commentary was emitted */
    public int $lastColorCommentaryMinute = 0;

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
     * Get a player's effective attribute value, reduced by fatigue after minute 60.
     */
    public function getEffectiveAttribute(int $playerId, string $attribute): float
    {
        $player = $this->homeLineup[$playerId] ?? $this->awayLineup[$playerId] ?? null;
        if (!$player || !$player->attributes) {
            return 10.0;
        }

        $baseValue = (float) ($player->attributes->{$attribute} ?? 10);
        $state = $this->playerStates[$playerId] ?? null;

        if (!$state) {
            return $baseValue;
        }

        $fatigue = $state['fatigue'];
        if ($this->minute > 60 && $fatigue > 0) {
            // Fatigue reduces effective attribute: up to 25% reduction at maximum fatigue
            $reduction = $fatigue * 0.25;
            return $baseValue * (1.0 - $reduction);
        }

        return $baseValue;
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

    // =========================================================================
    //  NARRATIVE HELPERS
    // =========================================================================

    /**
     * Update narrative tracking after each minute. Call from SimulationEngine.
     */
    public function updateNarrativeTracking(): void
    {
        // Consecutive possession
        if ($this->possession === $this->lastPossessionSide) {
            $this->consecutivePossessionMinutes++;
        } else {
            $this->consecutivePossessionMinutes = 1;
            $this->lastPossessionSide = $this->possession;
        }

        $this->minutesSinceLastEvent++;
    }

    /**
     * Record that a notable event happened (resets quiet-minute counter).
     */
    public function markNotableEvent(): void
    {
        $this->minutesSinceLastEvent = 0;
    }

    /**
     * Record a goal for narrative tracking.
     */
    public function recordGoal(int $playerId, string $side): void
    {
        $this->markNotableEvent();
        $this->scoreHistory[] = [$this->minute, $this->score['home'], $this->score['away']];
        $this->lastScorerId = $playerId;
        $this->lastGoalSide = $side;
        $this->lastGoalMinute = $this->minute;
    }

    /**
     * Record a save for narrative tracking.
     */
    public function recordSave(int $gkId): void
    {
        $this->playerMatchSaves[$gkId] = ($this->playerMatchSaves[$gkId] ?? 0) + 1;
        $this->markNotableEvent();
    }

    /**
     * Record a shot for narrative tracking.
     */
    public function recordShot(int $playerId): void
    {
        $this->playerMatchShots[$playerId] = ($this->playerMatchShots[$playerId] ?? 0) + 1;
    }

    /**
     * Get the goal context for a scoring event.
     * Returns: 'opener', 'equalizer', 'go_ahead', 'extending', 'consolation', 'comeback'
     */
    public function getGoalContext(string $scoringSide): string
    {
        $scorerGoals = $this->score[$scoringSide]; // score BEFORE this goal was added
        $opponentGoals = $this->score[$this->opponent($scoringSide)];

        // First goal of the match
        if ($scorerGoals === 0 && $opponentGoals === 0) {
            return 'opener';
        }

        // Equalizer
        if ($scorerGoals === $opponentGoals) {
            return 'equalizer';
        }

        // Going ahead (was level, now leading)
        if ($scorerGoals === $opponentGoals - 1) {
            // After this goal they'll be level — wait, score hasn't been updated yet
            // Actually: if scorer has N goals and opponent has N goals, after scoring it's N+1 vs N
            // But score is already updated before commentary is built in some paths
            // Let's check the actual state
        }

        // We need to reason about the score AFTER this goal
        $newScorerGoals = $scorerGoals + 1;

        if ($newScorerGoals === $opponentGoals) {
            return 'equalizer';
        }

        if ($newScorerGoals === $opponentGoals + 1 && $scorerGoals <= $opponentGoals) {
            return 'go_ahead';
        }

        if ($newScorerGoals > $opponentGoals + 1) {
            return 'extending';
        }

        if ($newScorerGoals < $opponentGoals) {
            return 'consolation';
        }

        return 'go_ahead';
    }

    /**
     * Get a time context label for the current minute.
     * Returns: 'early', 'first_half', 'second_half', 'late', 'stoppage'
     */
    public function getTimeContext(): string
    {
        if ($this->minute <= 10) return 'early';
        if ($this->minute <= 45) return 'first_half';
        if ($this->minute <= 75) return 'second_half';
        if ($this->minute <= 90) return 'late';
        return 'stoppage';
    }

    /**
     * Is the match currently tight (within 1 goal)?
     */
    public function isTightMatch(): bool
    {
        return abs($this->score['home'] - $this->score['away']) <= 1;
    }

    /**
     * Is this a high-scoring match (4+ total goals)?
     */
    public function isHighScoring(): bool
    {
        return ($this->score['home'] + $this->score['away']) >= 4;
    }

    /**
     * Which side is dominant in possession?
     * Returns 'home', 'away', or null if balanced (within 55/45).
     */
    public function getDominantSide(): ?string
    {
        $homePct = $this->stats['home']['possession_pct'];
        if ($homePct >= 58) return 'home';
        if ($homePct <= 42) return 'away';
        return null;
    }

    /**
     * Is this team currently losing?
     */
    public function isLosing(string $side): bool
    {
        $opp = $this->opponent($side);
        return $this->score[$side] < $this->score[$opp];
    }

    /**
     * Is this team currently winning?
     */
    public function isWinning(string $side): bool
    {
        $opp = $this->opponent($side);
        return $this->score[$side] > $this->score[$opp];
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
