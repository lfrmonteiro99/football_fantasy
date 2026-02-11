<?php

declare(strict_types=1);

namespace App\Services\Simulation;

use App\Models\Formation;
use App\Models\GameMatch;
use App\Models\MatchLineup;
use App\Models\Player;
use App\Models\Position;
use App\Models\Team;

/**
 * Tick-based football match simulation engine.
 *
 * Produces a Generator that yields one array per simulated minute (1-90 + injury time).
 * Each tick contains events, score, statistics, and commentary. The engine is fully
 * deterministic/probabilistic -- it does NOT call any external AI service.
 *
 * Usage:
 *   $engine = new SimulationEngine();
 *   foreach ($engine->simulate($match) as $tick) {
 *       // stream $tick to SSE / store in DB
 *   }
 */
class SimulationEngine
{
    private MatchState $state;
    private CommentaryBuilder $commentary;

    /** Position abbreviation compatibility map for lineup selection. */
    private const POSITION_COMPAT = [
        'GK' => ['GK'],
        'CB' => ['CB', 'SW'],
        'LB' => ['LB', 'WB'],
        'RB' => ['RB', 'WB'],
        'WB' => ['WB', 'LB', 'RB'],
        'SW' => ['SW', 'CB'],
        'DM' => ['DM', 'CM'],
        'CM' => ['CM', 'DM', 'AM'],
        'AM' => ['AM', 'CM'],
        'LM' => ['LM', 'LW', 'AM'],
        'RM' => ['RM', 'RW', 'AM'],
        'LW' => ['LW', 'LM', 'AM'],
        'RW' => ['RW', 'RM', 'AM'],
        'ST' => ['ST', 'CF', 'F9'],
        'CF' => ['CF', 'ST', 'F9'],
        'F9' => ['F9', 'CF', 'ST', 'AM'],
    ];

    /** Positions that can take shots */
    private const SHOOTING_POSITIONS = ['ST', 'CF', 'F9', 'LW', 'RW', 'AM', 'LM', 'RM', 'CM'];

    /** Positions that create chances / deliver set pieces */
    private const CREATIVE_POSITIONS = ['CM', 'AM', 'LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'WB'];

    /** Positions that defend */
    private const DEFENSIVE_POSITIONS = ['CB', 'SW', 'LB', 'RB', 'WB', 'DM', 'CM'];

    /** Positions likely to commit fouls */
    private const FOULING_POSITIONS = ['CB', 'DM', 'CM', 'LB', 'RB', 'WB', 'SW'];

    /** Positions that cross the ball */
    private const CROSSING_POSITIONS = ['LB', 'RB', 'WB', 'LW', 'RW', 'LM', 'RM'];

    /** Maximum substitutions per team */
    private const MAX_SUBSTITUTIONS = 5;

    /**
     * Run the full match simulation as a Generator.
     *
     * Each yield produces one minute's tick data in the documented structure.
     *
     * @param GameMatch $match  The match model (must have home/away teams and formations loaded)
     * @return \Generator<int, array>
     */
    public function simulate(GameMatch $match): \Generator
    {
        $this->commentary = new CommentaryBuilder();
        $this->state = new MatchState();

        $this->initializeMatch($match);

        // --- First half: minutes 1-45 + injury time ---
        yield from $this->simulateHalf(1, 45);

        // Half-time
        $this->state->minute = 45;
        $this->state->phase = 'half_time';
        $htEvents = [$this->buildStructuralEvent('half_time', 'home')];
        $htCommentary = $this->commentary->buildMinuteCommentary($htEvents, $this->state);
        yield $this->state->toTickArray($htEvents, $htCommentary);

        // --- Second half: minutes 46-90 + injury time ---
        $this->state->possession = $this->state->score['home'] >= $this->state->score['away'] ? 'away' : 'home';
        yield from $this->simulateHalf(46, 90);

        // Full-time
        $this->state->minute = 90;
        $this->state->phase = 'full_time';
        $ftEvents = [$this->buildStructuralEvent('full_time', 'home')];
        $ftCommentary = $this->commentary->buildMinuteCommentary($ftEvents, $this->state);
        yield $this->state->toTickArray($ftEvents, $ftCommentary);
    }

    // =========================================================================
    //  INITIALIZATION
    // =========================================================================

    /**
     * Load teams, formations, select starting XIs, and set up initial state.
     *
     * If stored MatchLineup records exist for a team, those are used instead
     * of auto-selecting. This allows the user to pick their own Starting XI.
     */
    private function initializeMatch(GameMatch $match): void
    {
        // Load relations
        $match->loadMissing([
            'homeTeam.players.attributes',
            'homeTeam.players.primaryPosition',
            'homeTeam.primaryTactic',
            'awayTeam.players.attributes',
            'awayTeam.players.primaryPosition',
            'awayTeam.primaryTactic',
            'homeFormation',
            'awayFormation',
        ]);

        $this->state->homeTeam = $match->homeTeam;
        $this->state->awayTeam = $match->awayTeam;
        $this->state->homeFormation = $match->homeFormation;
        $this->state->awayFormation = $match->awayFormation;
        $this->state->homeTactic = $match->homeTeam->primaryTactic;
        $this->state->awayTactic = $match->awayTeam->primaryTactic;

        // --- Home team: try stored lineup first ---
        if (!$this->loadStoredLineup($match, 'home')) {
            $this->selectLineup('home', $match->homeTeam, $match->homeFormation);
        }

        // --- Away team: try stored lineup first ---
        if (!$this->loadStoredLineup($match, 'away')) {
            $this->selectLineup('away', $match->awayTeam, $match->awayFormation);
        }

        // Designate set-piece takers
        $this->designateSetPieceTakers('home');
        $this->designateSetPieceTakers('away');

        // Determine initial possession based on team quality
        $this->state->possession = 'home';
        $this->state->zone = 'mid';
        $this->state->ball = ['x' => 50.0, 'y' => 50.0];

        // Determine injury time
        $this->state->firstHalfInjuryTime = random_int(1, 4);
        $this->state->secondHalfInjuryTime = random_int(1, 5);
    }

    /**
     * Attempt to load a stored lineup from the match_lineups table.
     *
     * If at least 11 starting entries exist, populates the lineup and bench
     * from the stored data rather than auto-selecting.
     *
     * @param GameMatch $match
     * @param string $side 'home'|'away'
     * @return bool true if stored lineup was loaded, false to fall back to auto-select
     */
    private function loadStoredLineup(GameMatch $match, string $side): bool
    {
        $teamId = $side === 'home' ? $match->home_team_id : $match->away_team_id;

        $storedLineup = MatchLineup::where('match_id', $match->id)
            ->where('team_id', $teamId)
            ->where('is_starting', true)
            ->with('player.attributes', 'player.primaryPosition')
            ->get();

        if ($storedLineup->isEmpty() || $storedLineup->count() < 11) {
            return false;
        }

        $lineup = [];
        foreach ($storedLineup as $entry) {
            if (!$entry->player) {
                continue;
            }
            $lineup[$entry->player->id] = $entry->player;
            $this->state->playerStates[$entry->player->id] = [
                'fatigue' => 0.0,
                'yellow_cards' => 0,
                'is_sent_off' => false,
                'is_subbed_off' => false,
                'goals' => 0,
                'assists' => 0,
                'morale' => 7.0,
                'position' => $entry->position,
            ];
        }

        // Remaining squad players go to bench
        $team = $side === 'home' ? $match->homeTeam : $match->awayTeam;
        $allPlayers = $team->players;
        $startingIds = $storedLineup->pluck('player_id')->toArray();
        $bench = [];

        foreach ($allPlayers as $player) {
            if (!in_array($player->id, $startingIds, true)) {
                $bench[$player->id] = $player;
                $primaryAbbr = $player->primaryPosition->short_name ?? 'CM';
                $this->state->playerStates[$player->id] = [
                    'fatigue' => 0.0,
                    'yellow_cards' => 0,
                    'is_sent_off' => false,
                    'is_subbed_off' => false,
                    'goals' => 0,
                    'assists' => 0,
                    'morale' => 7.0,
                    'position' => $primaryAbbr,
                ];
            }
        }

        if ($side === 'home') {
            $this->state->homeLineup = $lineup;
            $this->state->homeBench = $bench;
        } else {
            $this->state->awayLineup = $lineup;
            $this->state->awayBench = $bench;
        }

        return true;
    }

    /**
     * Select 11 starters from a 28-player squad based on formation positions.
     */
    private function selectLineup(string $side, Team $team, Formation $formation): void
    {
        $players = $team->players->all();
        $positions = $formation->positions; // array of {position, x, y}
        $assigned = [];
        $lineup = [];

        // Sort formation positions: GK first, then by y-coordinate (defenders before forwards)
        usort($positions, function ($a, $b) {
            if ($a['position'] === 'GK') return -1;
            if ($b['position'] === 'GK') return 1;
            return ($a['y'] ?? 0) <=> ($b['y'] ?? 0);
        });

        foreach ($positions as $slot) {
            $posAbbr = $slot['position'];
            $compatibles = self::POSITION_COMPAT[$posAbbr] ?? [$posAbbr];

            // Find the best unassigned player compatible with this position
            $candidates = array_filter($players, function (Player $p) use ($compatibles, $assigned) {
                if (in_array($p->id, $assigned, true)) {
                    return false;
                }
                if ($p->is_injured) {
                    return false;
                }
                $primaryAbbr = $p->primaryPosition->short_name ?? '';
                return in_array($primaryAbbr, $compatibles, true);
            });

            // Sort by current_ability descending
            usort($candidates, function (Player $a, Player $b) {
                $abilityA = $a->attributes->current_ability ?? 0;
                $abilityB = $b->attributes->current_ability ?? 0;
                return $abilityB <=> $abilityA;
            });

            if (!empty($candidates)) {
                $chosen = $candidates[0];
            } else {
                // Fallback: pick best unassigned outfield player (or any player)
                $remaining = array_filter($players, fn(Player $p) =>
                    !in_array($p->id, $assigned, true) && !$p->is_injured
                );
                usort($remaining, function (Player $a, Player $b) {
                    return ($b->attributes->current_ability ?? 0) <=> ($a->attributes->current_ability ?? 0);
                });
                $chosen = $remaining[0] ?? $players[0];
            }

            $assigned[] = $chosen->id;
            $lineup[$chosen->id] = $chosen;

            // Initialize player state
            $this->state->playerStates[$chosen->id] = [
                'fatigue' => 0.0,
                'yellow_cards' => 0,
                'is_sent_off' => false,
                'is_subbed_off' => false,
                'goals' => 0,
                'assists' => 0,
                'morale' => 7.0,
                'position' => $posAbbr,
            ];
        }

        // Remaining players go to bench
        $bench = [];
        foreach ($players as $player) {
            if (!in_array($player->id, $assigned, true)) {
                $bench[$player->id] = $player;
                $primaryAbbr = $player->primaryPosition->short_name ?? 'CM';
                $this->state->playerStates[$player->id] = [
                    'fatigue' => 0.0,
                    'yellow_cards' => 0,
                    'is_sent_off' => false,
                    'is_subbed_off' => false,
                    'goals' => 0,
                    'assists' => 0,
                    'morale' => 7.0,
                    'position' => $primaryAbbr,
                ];
            }
        }

        if ($side === 'home') {
            $this->state->homeLineup = $lineup;
            $this->state->homeBench = $bench;
        } else {
            $this->state->awayLineup = $lineup;
            $this->state->awayBench = $bench;
        }
    }

    /**
     * Designate set-piece takers for a side (best at corners, free_kick_taking, penalty_taking).
     */
    private function designateSetPieceTakers(string $side): void
    {
        $lineup = $this->state->getLineup($side);

        $bestCorner = $this->pickBestPlayerByAttribute($lineup, 'corners');
        $bestFK = $this->pickBestPlayerByAttribute($lineup, 'free_kick_taking');
        $bestPen = $this->pickBestPlayerByAttribute($lineup, 'penalty_taking');

        $takers = [
            'corner' => $bestCorner?->id,
            'free_kick' => $bestFK?->id,
            'penalty' => $bestPen?->id,
        ];

        if ($side === 'home') {
            $this->state->homeSetPieceTakers = $takers;
        } else {
            $this->state->awaySetPieceTakers = $takers;
        }
    }

    // =========================================================================
    //  HALF SIMULATION
    // =========================================================================

    /**
     * Simulate one half of the match (inclusive minute range).
     *
     * @return \Generator<int, array>
     */
    private function simulateHalf(int $startMinute, int $endMinute): \Generator
    {
        $injuryTime = $startMinute <= 45
            ? $this->state->firstHalfInjuryTime
            : $this->state->secondHalfInjuryTime;

        $lastMinute = $endMinute + $injuryTime;

        for ($min = $startMinute; $min <= $lastMinute; $min++) {
            $this->state->minute = $min;

            // Kickoff on first minute of each half
            if ($min === $startMinute) {
                $this->state->phase = 'kickoff';
                $events = [$this->buildStructuralEvent('kickoff', $this->state->possession)];
                $commentaryText = $this->commentary->buildMinuteCommentary($events, $this->state);
                yield $this->state->toTickArray($events, $commentaryText);
                continue;
            }

            // Update fatigue for all active players
            $this->updateFatigue();

            // Decay morale toward neutral each minute
            $this->state->decayMorale();

            // Decide possession for this minute
            $this->resolvePossession();

            // Track possession minute
            if ($this->state->possession === 'home') {
                $this->state->homePossessionMinutes++;
            } else {
                $this->state->awayPossessionMinutes++;
            }
            $this->state->recalculatePossession();

            // Decide what happens
            $events = $this->simulateMinute();

            // Auto-substitution logic (after minute 60)
            if ($min >= 60) {
                $subEvents = $this->maybeSubstitute();
                $events = array_merge($events, $subEvents);
            }

            // Update zone from ball position
            $this->updateZoneFromBall();

            // Determine phase
            $this->state->phase = $this->resolvePhase($events);

            // Build commentary
            $commentaryText = $this->commentary->buildMinuteCommentary($events, $this->state);

            yield $this->state->toTickArray($events, $commentaryText);
        }
    }

    // =========================================================================
    //  MINUTE SIMULATION (Event Decision Tree)
    // =========================================================================

    /**
     * Simulate a single minute as a passage of play with multiple micro-actions.
     *
     * Instead of a single dice roll, each minute generates 3-8 actions representing
     * continuous play: passes, carries, tackles, shots, fouls, etc.
     *
     * @return array<int, array>
     */
    private function simulateMinute(): array
    {
        // Ensure ball is within playable bounds at the start of each minute
        $this->clampBall();

        $events = [];
        $sequence = []; // accumulate a continuous sequence across the whole minute

        // Each minute = a passage of play with 3-8 actions
        $actionCount = random_int(3, 8);

        // Background passing: every minute has 6-12 passes regardless of what happens
        // (represents the continuous ball circulation not shown as events)
        $backgroundPasses = random_int(6, 12);
        $this->state->stats[$this->state->possession]['passes'] += $backgroundPasses;
        // Non-possessing team also circulates 1-3 passes during brief spells
        $this->state->stats[$this->state->opponent($this->state->possession)]['passes'] += random_int(1, 3);

        $lastActionWasPass = false;

        for ($i = 0; $i < $actionCount; $i++) {
            // What happens depends on context:
            // - If we have possession, likely: pass, dribble, or shoot (if in attacking third)
            // - Random chance of losing possession via tackle/interception
            // - Occasional foul

            $side = $this->state->possession;
            $roll = random_int(1, 100);
            $inAttackingThird = $this->isInAttackingThird($side);

            // Get tactical context for probability modifiers
            $tactic = $side === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
            $mentality = $tactic->mentality ?? 'balanced';

            // Modify shot threshold based on mentality
            $shotThreshold = 15; // base
            if ($mentality === 'very_attacking') {
                $shotThreshold = 22;
            } elseif ($mentality === 'attacking') {
                $shotThreshold = 18;
            } elseif ($mentality === 'defensive') {
                $shotThreshold = 10;
            } elseif ($mentality === 'very_defensive') {
                $shotThreshold = 7;
            }

            // Modify foul rate based on opponent's tackle_harder
            $oppSide = $this->state->opponent($side);
            $oppTactic = $oppSide === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
            $foulBase = 8;
            if ($oppTactic && ($oppTactic->tackle_harder || $oppTactic->get_stuck_in)) {
                $foulBase = 14;
            }
            if ($oppTactic && (($oppTactic->tackling ?? 'balanced') === 'stay_on_feet')) {
                $foulBase = 5;
            }

            // Modify defensive action threshold based on opponent's pressing
            $defActionBase = 20;
            if ($oppTactic) {
                $oppPressing = $oppTactic->pressing ?? 'sometimes';
                if (in_array($oppPressing, ['often', 'always'], true)) {
                    $defActionBase = 22;
                } elseif (in_array($oppPressing, ['rarely', 'never'], true)) {
                    $defActionBase = 10;
                }
            }

            // Probability ranges: shot (in attacking third only), foul, defensive action, offside
            // Each range is independent, not cumulative from shot threshold
            $cursor = 0;

            if ($inAttackingThird && $roll <= $shotThreshold) {
                // Shot attempt (only in attacking third)
                $shotEvents = $this->resolveShot($side, null, $sequence);
                $events = array_merge($events, $shotEvents);
                $sequence = [];
                break;
            }
            // Outside attacking third, shot range becomes available for passes (default)
            $cursor = $inAttackingThird ? $shotThreshold : 0;

            if ($roll > $cursor && $roll <= $cursor + $foulBase) {
                // Foul interrupts play
                $foulEvents = $this->simulateFoul();
                $events = array_merge($events, $foulEvents);
                $sequence = [];
                break;
            }
            $cursor += $foulBase;

            if ($roll > $cursor && $roll <= $cursor + $defActionBase) {
                // Turnover (tackle or interception)
                $defEvents = $this->simulateDefensiveAction();
                $events = array_merge($events, $defEvents);
                $sequence = [];
                break;
            }
            $cursor += $defActionBase;

            if ($roll > $cursor && $roll <= $cursor + 6 && $inAttackingThird) {
                // 6% offside in attacking third (regardless of last action)
                $offEvents = $this->simulateOffside();
                $events = array_merge($events, $offEvents);
                $sequence = [];
                break;
            }

            // Default: pass or carry (the bread-and-butter of football)
            $passOrCarry = random_int(1, 100);
            if ($passOrCarry <= 75) {
                // Pass to teammate
                $passerReceiver = $this->simulatePass($side, $sequence);
                if ($passerReceiver) {
                    $sequence = $passerReceiver['sequence'];
                    $lastActionWasPass = true;
                }
            } else {
                // Dribble/carry forward
                $dribble = $this->simulateCarry($side, $sequence);
                if ($dribble) {
                    $sequence = $dribble['sequence'];
                    $lastActionWasPass = false;
                }
            }
        }

        // If we accumulated passes without an ending event, emit a possession event
        if (!empty($sequence) && empty($events)) {
            $fallbackPlayer = $this->pickRandomAvailablePlayer($this->state->possession);
            if ($fallbackPlayer) {
                $events[] = $this->buildEvent(
                    'possession',
                    $this->state->possession,
                    $fallbackPlayer,
                    null,
                    'success',
                    $sequence
                );
            }
        }

        return $events;
    }

    // =========================================================================
    //  ATTACK SIMULATION
    // =========================================================================

    /**
     * Simulate an attack sequence: build-up passes -> chance creation -> shot attempt.
     *
     * @return array<int, array>
     */
    private function simulateAttack(): array
    {
        $side = $this->state->possession;
        $defSide = $this->state->opponent($side);
        $events = [];
        $sequence = [];

        // Move ball forward
        $this->moveBallForward($side);

        // Build-up: 2-4 passes
        $passCount = random_int(2, 4);
        $lastPasser = null;
        for ($i = 0; $i < $passCount; $i++) {
            $passer = $this->pickWeightedPlayer($side, self::CREATIVE_POSITIONS, 'passing');
            if ($passer) {
                $lastPasser = $passer;
                $ballStart = $this->state->ball;
                $this->advanceBall($side, 5.0, 15.0);
                $sequence[] = $this->buildSequenceAction('pass', $passer, $ballStart, $this->state->ball, random_int(300, 600));
                $this->state->stats[$side]['passes']++;
            }
        }

        // Chance creation: cross, through-ball, or dribble
        $creationType = random_int(1, 100);
        $creator = $lastPasser;

        if ($creationType <= 40) {
            // Cross
            $crosser = $this->pickWeightedPlayer($side, self::CROSSING_POSITIONS, 'crossing');
            if ($crosser) {
                $creator = $crosser;
                $ballStart = $this->state->ball;
                $this->moveBallToAttackingThird($side);
                $sequence[] = $this->buildSequenceAction('cross', $crosser, $ballStart, $this->state->ball, random_int(400, 800));
                $events[] = $this->buildEvent('cross', $side, $crosser, null, 'success', $sequence);
                $sequence = [];
            }
        } elseif ($creationType <= 70) {
            // Through ball
            if ($lastPasser) {
                $ballStart = $this->state->ball;
                $this->moveBallToAttackingThird($side);
                $sequence[] = $this->buildSequenceAction('pass', $lastPasser, $ballStart, $this->state->ball, random_int(300, 600));
            }
        } else {
            // Dribble
            $dribbler = $this->pickWeightedPlayer($side, self::SHOOTING_POSITIONS, 'dribbling');
            if ($dribbler) {
                $creator = $dribbler;
                $defender = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'tackling');
                $ballStart = $this->state->ball;
                $this->moveBallToAttackingThird($side);
                $sequence[] = $this->buildSequenceAction('dribble', $dribbler, $ballStart, $this->state->ball, random_int(400, 800));
                $events[] = $this->buildEvent('dribble', $side, $dribbler, $defender, 'success', $sequence);
                $sequence = [];
            }
        }

        // Shot attempt
        $shotEvents = $this->resolveShot($side, $creator, $sequence);
        $events = array_merge($events, $shotEvents);

        return $events;
    }

    /**
     * Resolve a shot attempt through the decision tree.
     *
     * @return array<int, array>
     */
    private function resolveShot(string $side, ?Player $assistProvider, array $priorSequence): array
    {
        $defSide = $this->state->opponent($side);
        $events = [];

        // Ensure minimum shooting distance from the goal line (at least 10 units)
        $goalLineX = $side === 'home' ? 99.0 : 1.0;
        $distToGoal = abs($this->state->ball['x'] - $goalLineX);
        if ($distToGoal < 10.0) {
            // Push ball back to at least 10 units from goal
            $this->state->ball['x'] = $side === 'home'
                ? min(89.0, $this->state->ball['x'])
                : max(11.0, $this->state->ball['x']);
        }

        $shooter = $this->pickWeightedPlayer($side, self::SHOOTING_POSITIONS, 'finishing');
        if (!$shooter) {
            return $events;
        }

        $gk = $this->state->getGoalkeeper($defSide);
        $defender = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'positioning');

        // Shooter attributes
        $finishing = $this->state->getEffectiveAttribute($shooter->id, 'finishing');
        $composure = $this->state->getEffectiveAttribute($shooter->id, 'composure');
        $longShots = $this->state->getEffectiveAttribute($shooter->id, 'long_shots');
        $technique = $this->state->getEffectiveAttribute($shooter->id, 'technique');
        $decisions = $this->state->getEffectiveAttribute($shooter->id, 'decisions');
        $firstTouch = $this->state->getEffectiveAttribute($shooter->id, 'first_touch');

        // GK attributes
        $gkReflexes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'reflexes') : 10.0;
        $gkHandling = $gk ? $this->state->getEffectiveAttribute($gk->id, 'handling') : 10.0;
        $gkOneOnOnes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'one_on_ones') : 10.0;
        $gkPositioning = $gk ? $this->state->getEffectiveAttribute($gk->id, 'positioning') : 10.0;

        // Defender attributes
        $defPositioning = $defender ? $this->state->getEffectiveAttribute($defender->id, 'positioning') : 10.0;
        $defMarking = $defender ? $this->state->getEffectiveAttribute($defender->id, 'marking') : 10.0;
        $defConcentration = $defender ? $this->state->getEffectiveAttribute($defender->id, 'concentration') : 10.0;
        $defStrength = $defender ? $this->state->getEffectiveAttribute($defender->id, 'strength') : 10.0;

        $this->state->stats[$side]['shots']++;

        // Structural penalty: fewer defenders = easier to score
        $defenderCount = count(array_filter(
            $this->state->getAvailablePlayers($defSide),
            fn(Player $p) => in_array($this->state->playerStates[$p->id]['position'] ?? '', ['CB', 'SW', 'LB', 'RB', 'WB'], true)
        ));
        $structuralPenalty = max(0, (3 - $defenderCount) * 8); // 0 if >=3 defenders, 8 per missing defender

        // Decision: blocked before shot (25%)
        $blockChance = 25 + ($defPositioning + $defMarking - 20) * 0.4 + ($defConcentration - 10) * 0.3 + ($defStrength - 10) * 0.2;
        $blockChance -= $structuralPenalty;
        $blockChance = max(5, min(45, $blockChance));

        if (random_int(1, 100) <= (int) $blockChance) {
            // Blocked by defender — store goal position once for continuity
            $ballStart = $this->state->ball;
            $goalTarget = $this->goalPosition($side);
            $sequence = array_merge($priorSequence, [
                $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalTarget, random_int(200, 500)),
                $this->buildSequenceAction('clearance', $defender ?? $shooter, $goalTarget, $ballStart, random_int(200, 400)),
            ]);

            $events[] = $this->buildEvent('shot_blocked', $side, $shooter, $defender, 'blocked', $sequence);

            // Blocked shot: 50% corner, 50% loose ball
            if (random_int(1, 100) <= 50) {
                $events = array_merge($events, $this->awardCorner($side, $goalTarget));
            }

            // Scatter ball after block so repeat shots don't share exact position
            $this->jitterBall();

            return $events;
        }

        // Shot goes off: 40% off target
        $inAttackingThird = $this->isInAttackingThird($side);
        $missChance = 40 - ($finishing - 10) * 1.2 - ($composure - 10) * 0.4 - ($technique - 10) * 0.3 - ($decisions - 10) * 0.2;
        if (!$inAttackingThird) {
            $missChance += 5; // long-range shots are harder, but use longShots to offset
            $missChance -= ($longShots - 10) * 0.5;
        }
        $missChance = max(15, min(60, $missChance));

        if (random_int(1, 100) <= (int) $missChance) {
            // Off target
            $ballStart = $this->state->ball;
            $sequence = array_merge($priorSequence, [
                $this->buildSequenceAction('shoot', $shooter, $ballStart, $this->missedShotPosition($side), random_int(200, 500)),
            ]);

            $events[] = $this->buildEvent('shot_off_target', $side, $shooter, null, 'wide', $sequence);
            return $events;
        }

        // On target (remaining ~35%)
        $this->state->stats[$side]['shots_on_target']++;

        // Goal chance: ~25% of on-target shots = ~9% of total shots
        $goalChance = 25 + ($finishing - 10) * 0.8 + ($composure - 10) * 0.4 + ($firstTouch - 10) * 0.2
            - ($gkReflexes - 10) * 0.6 - ($gkOneOnOnes - 10) * 0.2 - ($gkPositioning - 10) * 0.2;
        $goalChance = max(10, min(45, $goalChance));

        $ballStart = $this->state->ball;
        $goalPos = $this->goalPosition($side);

        if (random_int(1, 100) <= (int) $goalChance) {
            // GOAL!
            $sequence = array_merge($priorSequence, [
                $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalPos, random_int(200, 500)),
            ]);

            $goalEvent = $this->buildEvent('goal', $side, $shooter, $assistProvider, 'goal', $sequence);
            $events[] = $goalEvent;

            // Update score
            $this->state->score[$side]++;
            $this->state->playerStates[$shooter->id]['goals']++;
            $this->state->updatePlayerMorale($shooter->id, 'goal_scored');
            $this->state->updateTeamMorale($side, 0.5);
            $this->state->updateTeamMorale($defSide, -0.3);
            if ($assistProvider && $assistProvider->id !== $shooter->id) {
                $this->state->playerStates[$assistProvider->id]['assists']++;
                $this->state->updatePlayerMorale($assistProvider->id, 'assist');
            }

            // Possession goes to conceding team
            $this->state->possession = $defSide;
            $this->state->ball = ['x' => 50.0, 'y' => 50.0];

            return $events;
        }

        // Save: 50% of non-goal on-target shots
        $saveChance = 50 + ($gkReflexes + $gkHandling - 20) * 0.4 + ($gkPositioning - 10) * 0.3;
        $saveChance = max(30, min(75, $saveChance));

        if (random_int(1, 100) <= (int) $saveChance) {
            // Save
            $this->state->stats[$defSide]['saves']++;

            // Determine if save results in corner (35%) or GK holds (65%)
            $isCorner = random_int(1, 100) <= 35;

            if ($isCorner) {
                // GK parries/tips the ball behind the goal line
                $deflectPos = $this->saveDeflectionPosition($side, $goalPos);
                $sequence = array_merge($priorSequence, [
                    $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalPos, random_int(200, 500)),
                    $this->buildSequenceAction('save', $gk ?? $shooter, $goalPos, $deflectPos, random_int(150, 350)),
                ]);
            } else {
                // GK catches or holds the ball — small displacement to show collecting
                $holdPos = $goalPos;
                $holdPos['x'] += ($side === 'home' ? -3 : 3); // GK steps out slightly
                $holdPos['x'] = max(2.0, min(98.0, $holdPos['x']));
                $sequence = array_merge($priorSequence, [
                    $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalPos, random_int(200, 500)),
                    $this->buildSequenceAction('save', $gk ?? $shooter, $goalPos, $holdPos, random_int(150, 350)),
                ]);
            }

            $events[] = $this->buildEvent('save', $defSide, $gk ?? $shooter, $shooter, 'saved', $sequence);

            if ($isCorner) {
                $events = array_merge($events, $this->awardCorner($side, $deflectPos));
            }

            return $events;
        }

        // Blocked by defender (remaining)
        $sequence = array_merge($priorSequence, [
            $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalPos, random_int(200, 500)),
            $this->buildSequenceAction('clearance', $defender ?? $shooter, $goalPos, $ballStart, random_int(200, 400)),
        ]);

        $events[] = $this->buildEvent('shot_blocked', $side, $shooter, $defender, 'blocked', $sequence);

        if (random_int(1, 100) <= 50) {
            $events = array_merge($events, $this->awardCorner($side, $goalPos));
        }

        // Scatter ball after block so repeat shots don't share exact position
        $this->jitterBall();

        return $events;
    }

    // =========================================================================
    //  FOUL SIMULATION
    // =========================================================================

    /**
     * Simulate a foul event with possible card and set-piece chain.
     *
     * @return array<int, array>
     */
    private function simulateFoul(): array
    {
        $defSide = $this->state->opponent($this->state->possession);
        $attSide = $this->state->possession;
        $events = [];

        // Pick fouler: defenders/midfielders with low tackling foul more
        $fouler = $this->pickWeightedPlayer($defSide, self::FOULING_POSITIONS, 'tackling', true);
        if (!$fouler) {
            return $events;
        }

        // Pick fouled player
        $fouled = $this->pickWeightedPlayer($attSide, self::SHOOTING_POSITIONS, 'pace');
        if (!$fouled) {
            $fouled = $this->pickRandomAvailablePlayer($attSide);
        }
        if (!$fouled) {
            return $events;
        }

        $this->state->stats[$defSide]['fouls']++;

        // Determine where the foul occurs
        $foulZone = $this->determineFoulZone($attSide);
        $isPenaltyArea = $foulZone === 'penalty_area';
        $isDangerous = $foulZone === 'attacking_third';

        $ballPos = $this->foulCoordinates($attSide, $foulZone);
        $this->state->ball = $ballPos;

        // Fouled player was running toward the attacking goal before being fouled
        $runStartX = $attSide === 'home'
            ? max(2.0, $ballPos['x'] - 5)   // home attacks right: ran from left
            : min(98.0, $ballPos['x'] + 5);  // away attacks left: ran from right
        $sequence = [
            $this->buildSequenceAction('run', $fouled, ['x' => $runStartX, 'y' => $ballPos['y']], $ballPos, random_int(200, 500)),
            $this->buildSequenceAction('foul', $fouler, $ballPos, $ballPos, random_int(150, 300)),
        ];

        $foulEvent = $this->buildEvent('foul', $defSide, $fouler, $fouled, 'success', $sequence);
        if ($isDangerous) {
            $foulEvent['_dangerous'] = true;
        }
        $events[] = $foulEvent;

        // Card logic
        $cardEvents = $this->resolveCard($defSide, $fouler);
        $events = array_merge($events, $cardEvents);

        // Set-piece chain
        if ($isPenaltyArea) {
            // PENALTY
            $events = array_merge($events, $this->resolvePenalty($attSide));
        } elseif ($isDangerous) {
            // Free kick in dangerous position: 20% chance of shot from FK
            if (random_int(1, 100) <= 20) {
                $events = array_merge($events, $this->resolveFreeKickShot($attSide));
            } else {
                $events[] = $this->buildFreeKickEvent($attSide);
            }
        } else {
            $events[] = $this->buildFreeKickEvent($attSide);
        }

        return $events;
    }

    /**
     * Resolve whether a card is shown for a foul.
     *
     * @return array<int, array>
     */
    private function resolveCard(string $side, Player $fouler): array
    {
        $events = [];
        $aggression = $this->state->getEffectiveAttribute($fouler->id, 'aggression');
        $bravery = $this->state->getEffectiveAttribute($fouler->id, 'bravery');

        // Yellow card: ~13% base per foul, modified by aggression
        $yellowChance = 13 + ($aggression - 10) * 0.5;

        // Tactic: tackle_harder increases card chance
        $tactic = $side === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
        if ($tactic && ($tactic->tackle_harder || $tactic->get_stuck_in)) {
            $yellowChance += 4;
        }
        // Stay on feet reduces card chance
        if ($tactic && (($tactic->tackling ?? 'balanced') === 'stay_on_feet')) {
            $yellowChance -= 3;
        }
        // Brave players with good decisions less likely to get carded
        if ($bravery > 14) {
            $yellowChance -= 2;
        }

        $yellowChance = max(3, min(30, $yellowChance));

        // Red card: ~0.15% base (very rare — ~1 per 5-7 matches)
        $redChance = 0.15 + max(0, ($aggression - 15)) * 0.1;

        if (random_int(1, 100) <= (int) $redChance) {
            // Straight red
            $this->state->stats[$side]['red_cards']++;
            $this->state->playerStates[$fouler->id]['is_sent_off'] = true;
            $this->state->updatePlayerMorale($fouler->id, 'red_card');
            $this->state->updateTeamMorale($side, -0.8);

            $events[] = $this->buildEvent('red_card', $side, $fouler, null, 'sent_off', []);
            return $events;
        }

        if (random_int(1, 100) <= (int) $yellowChance) {
            $this->state->playerStates[$fouler->id]['yellow_cards']++;
            $this->state->stats[$side]['yellow_cards']++;
            $this->state->updatePlayerMorale($fouler->id, 'yellow_card');

            if ($this->state->playerStates[$fouler->id]['yellow_cards'] >= 2) {
                // Second yellow = red
                $this->state->stats[$side]['red_cards']++;
                $this->state->playerStates[$fouler->id]['is_sent_off'] = true;

                $yellowEvent = $this->buildEvent('yellow_card', $side, $fouler, null, 'booked', []);
                $events[] = $yellowEvent;

                $redEvent = $this->buildEvent('red_card', $side, $fouler, null, 'sent_off', []);
                $redEvent['_second_yellow'] = true;
                $events[] = $redEvent;
            } else {
                $events[] = $this->buildEvent('yellow_card', $side, $fouler, null, 'booked', []);
            }
        }

        return $events;
    }

    /**
     * Resolve a penalty kick.
     *
     * @return array<int, array>
     */
    private function resolvePenalty(string $attSide): array
    {
        $defSide = $this->state->opponent($attSide);
        $events = [];

        // Award penalty event
        $takers = $attSide === 'home' ? $this->state->homeSetPieceTakers : $this->state->awaySetPieceTakers;
        $takerId = $takers['penalty'];
        $taker = $this->findPlayer($attSide, $takerId);
        if (!$taker) {
            $taker = $this->pickWeightedPlayer($attSide, self::SHOOTING_POSITIONS, 'penalty_taking');
        }
        if (!$taker) {
            return $events;
        }

        $gk = $this->state->getGoalkeeper($defSide);

        $penTaking = $this->state->getEffectiveAttribute($taker->id, 'penalty_taking');
        $composure = $this->state->getEffectiveAttribute($taker->id, 'composure');
        $gkReflexes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'reflexes') : 10.0;
        $gkOneOnOnes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'one_on_ones') : 10.0;

        $penSpot = $this->penaltySpotPosition($attSide);
        $goalPos = $this->goalPosition($attSide);
        $this->state->ball = $penSpot;
        $this->state->stats[$attSide]['shots']++;
        $this->state->stats[$attSide]['shots_on_target']++;

        // 75% goal base, modified by penalty_taking + composure vs GK reflexes + one_on_ones
        $goalChance = 75 + ($penTaking - 10) * 0.6 + ($composure - 10) * 0.3 - ($gkReflexes - 10) * 0.4 - ($gkOneOnOnes - 10) * 0.3;
        $goalChance = max(55, min(90, $goalChance));

        $sequence = [
            $this->buildSequenceAction('shoot', $taker, $penSpot, $goalPos, random_int(200, 500)),
        ];

        if (random_int(1, 100) <= (int) $goalChance) {
            // Penalty goal
            $events[] = $this->buildEvent('penalty', $attSide, $taker, null, 'goal', $sequence);
            $this->state->score[$attSide]++;
            $this->state->playerStates[$taker->id]['goals']++;
            $this->state->updatePlayerMorale($taker->id, 'goal_scored');
            $this->state->updateTeamMorale($attSide, 0.5);
            $this->state->updateTeamMorale($defSide, -0.3);
            $this->state->possession = $defSide;
            $this->state->ball = ['x' => 50.0, 'y' => 50.0];
        } else {
            // Penalty saved
            $sequence[] = $this->buildSequenceAction('save', $gk ?? $taker, $goalPos, $goalPos, random_int(150, 350));
            $events[] = $this->buildEvent('penalty', $attSide, $taker, $gk, 'saved', $sequence);
            $this->state->stats[$defSide]['saves']++;
            $this->state->updatePlayerMorale($taker->id, 'missed_penalty');
            $this->state->updateTeamMorale($attSide, -0.5);
            if ($gk) {
                $this->state->updatePlayerMorale($gk->id, 'penalty_saved_by_gk');
            }
            $this->state->updateTeamMorale($defSide, 0.3);
        }

        return $events;
    }

    /**
     * Resolve a direct free kick shot.
     *
     * @return array<int, array>
     */
    private function resolveFreeKickShot(string $attSide): array
    {
        $events = [];
        $takers = $attSide === 'home' ? $this->state->homeSetPieceTakers : $this->state->awaySetPieceTakers;
        $takerId = $takers['free_kick'];
        $taker = $this->findPlayer($attSide, $takerId);
        if (!$taker) {
            $taker = $this->pickWeightedPlayer($attSide, self::CREATIVE_POSITIONS, 'free_kick_taking');
        }
        if (!$taker) {
            return $events;
        }

        $events[] = $this->buildEvent('free_kick', $attSide, $taker, null, 'success', []);

        // Free kick shot goes through shot resolution with lower accuracy
        $shotEvents = $this->resolveShot($attSide, $taker, []);
        $events = array_merge($events, $shotEvents);

        return $events;
    }

    // =========================================================================
    //  SET PIECE SIMULATION
    // =========================================================================

    /**
     * Simulate a standalone set piece (corner, throw-in, goal kick).
     *
     * @return array<int, array>
     */
    private function simulateSetPiece(): array
    {
        $roll = random_int(1, 100);

        if ($roll <= 40) {
            return $this->simulateCorner($this->state->possession);
        } elseif ($roll <= 70) {
            return $this->simulateThrowIn();
        } else {
            return $this->simulateGoalKick();
        }
    }

    /**
     * Simulate a corner kick with header/shot opportunity.
     *
     * @return array<int, array>
     */
    private function simulateCorner(string $side): array
    {
        $events = [];

        $takers = $side === 'home' ? $this->state->homeSetPieceTakers : $this->state->awaySetPieceTakers;
        $takerId = $takers['corner'];
        $taker = $this->findPlayer($side, $takerId);
        if (!$taker) {
            $taker = $this->pickWeightedPlayer($side, self::CROSSING_POSITIONS, 'corners');
        }
        if (!$taker) {
            return $events;
        }

        $this->state->stats[$side]['corners']++;
        $cornerPos = $this->cornerPosition($side);
        $this->state->ball = $cornerPos;

        $targetPos = $this->goalPosition($side);
        $targetPos['y'] += random_int(-15, 15); // slight variation

        $sequence = [
            $this->buildSequenceAction('cross', $taker, $cornerPos, $targetPos, random_int(400, 800)),
        ];

        $events[] = $this->buildEvent('corner', $side, $taker, null, 'success', $sequence);

        // GK claim attempt before header
        $gk = $this->state->getGoalkeeper($this->state->opponent($side));
        $gkAerialReach = $gk ? $this->state->getEffectiveAttribute($gk->id, 'aerial_reach') : 10.0;
        $gkCommandArea = $gk ? $this->state->getEffectiveAttribute($gk->id, 'command_of_area') : 10.0;

        // GK claims cross: 20% base, +3% per aerial_reach above 10, +2% per command
        $claimChance = 20 + ($gkAerialReach - 10) * 3.0 + ($gkCommandArea - 10) * 2.0;
        $claimChance = max(5, min(50, $claimChance));

        if (random_int(1, 100) <= (int) $claimChance) {
            // GK claims cross, no header
            if ($gk) {
                $claimSequence = [
                    $this->buildSequenceAction('save', $gk, $targetPos, $targetPos, random_int(200, 400)),
                ];
                $events[] = $this->buildEvent('save', $this->state->opponent($side), $gk, null, 'claimed', $claimSequence);
            }
            return $events;
        }

        // Header attempt (60% of corners lead to a header, after GK doesn't claim)
        if (random_int(1, 100) <= 60) {
            $header = $this->pickWeightedPlayer($side, ['CB', 'ST', 'CF', 'SW'], 'heading');
            if ($header) {
                $headingAttr = $this->state->getEffectiveAttribute($header->id, 'heading');
                $jumpingAttr = $this->state->getEffectiveAttribute($header->id, 'jumping_reach');
                $headerStrength = $this->state->getEffectiveAttribute($header->id, 'strength');
                $headerBravery = $this->state->getEffectiveAttribute($header->id, 'bravery');

                $this->state->stats[$side]['shots']++;

                // Header on target: base 40%, modified by heading + jumping + strength + bravery
                $onTargetChance = 40 + ($headingAttr + $jumpingAttr - 20) * 0.6 + ($headerStrength - 10) * 0.3 + ($headerBravery - 10) * 0.2;
                $onTargetChance = max(20, min(65, $onTargetChance));

                if (random_int(1, 100) <= (int) $onTargetChance) {
                    $this->state->stats[$side]['shots_on_target']++;
                    $gkReflexes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'reflexes') : 10.0;

                    // Goal from header: 20% of on-target headers
                    $goalChance = 20 + ($headingAttr - 10) * 1.0 - ($gkReflexes - 10) * 0.8;
                    $goalChance = max(8, min(35, $goalChance));

                    $hdrSequence = [
                        $this->buildSequenceAction('header', $header, $targetPos, $this->goalPosition($side), random_int(200, 400)),
                    ];

                    if (random_int(1, 100) <= (int) $goalChance) {
                        // Header goal
                        $events[] = $this->buildEvent('header', $side, $header, $taker, 'goal', $hdrSequence);
                        $this->state->score[$side]++;
                        $this->state->playerStates[$header->id]['goals']++;
                        $this->state->playerStates[$taker->id]['assists']++;
                        $this->state->updatePlayerMorale($header->id, 'goal_scored');
                        $this->state->updatePlayerMorale($taker->id, 'assist');
                        $this->state->updateTeamMorale($side, 0.5);
                        $this->state->updateTeamMorale($this->state->opponent($side), -0.3);
                        $this->state->possession = $this->state->opponent($side);
                        $this->state->ball = ['x' => 50.0, 'y' => 50.0];
                    } else {
                        // Header saved
                        $hdrSequence[] = $this->buildSequenceAction('save', $gk ?? $header, $this->goalPosition($side), $this->goalPosition($side), random_int(150, 350));
                        $events[] = $this->buildEvent('header', $side, $header, null, 'saved', $hdrSequence);
                        $defSide = $this->state->opponent($side);
                        $this->state->stats[$defSide]['saves']++;
                    }
                } else {
                    // Header off target
                    $hdrSequence = [
                        $this->buildSequenceAction('header', $header, $targetPos, $this->missedShotPosition($side), random_int(200, 400)),
                    ];
                    $events[] = $this->buildEvent('header', $side, $header, null, 'wide', $hdrSequence);
                }
            }
        }

        return $events;
    }

    /**
     * Award a corner kick after a save/block.
     *
     * @return array<int, array>
     */
    private function awardCorner(string $side, ?array $ballOutPos = null): array
    {
        // The corner itself as a simple event (not a full corner simulation to avoid deep recursion)
        $takers = $side === 'home' ? $this->state->homeSetPieceTakers : $this->state->awaySetPieceTakers;
        $takerId = $takers['corner'];
        $taker = $this->findPlayer($side, $takerId);
        if (!$taker) {
            $taker = $this->pickWeightedPlayer($side, self::CROSSING_POSITIONS, 'corners');
        }

        $this->state->stats[$side]['corners']++;

        if ($taker) {
            $cornerPos = $this->cornerPosition($side);

            // If we know where the ball went out, show it traveling to the corner flag
            $sequence = [];
            if ($ballOutPos) {
                // Choose corner flag on the same side the ball went out
                $cornerPos['y'] = $ballOutPos['y'] < 50 ? 2.0 : 98.0;
                $sequence[] = $this->buildSequenceAction('run', $taker, $ballOutPos, $cornerPos, random_int(300, 600));
            }

            $this->state->ball = $cornerPos;
            return [$this->buildEvent('corner', $side, $taker, null, 'success', $sequence)];
        }
        return [];
    }

    /**
     * Simulate a throw-in (simple possession restart).
     *
     * @return array<int, array>
     */
    private function simulateThrowIn(): array
    {
        $side = $this->state->possession;
        $player = $this->pickRandomAvailablePlayer($side);
        if (!$player) {
            return [];
        }

        // Throw-in happens on the sideline (y near 0 or 100)
        $sidelineY = random_int(0, 1) === 0 ? 2.0 : 98.0;
        $this->state->ball = ['x' => (float) random_int(15, 85), 'y' => $sidelineY];

        return [$this->buildEvent('throw_in', $side, $player, null, 'success', [])];
    }

    /**
     * Simulate a goal kick (GK restart, often changes possession).
     *
     * @return array<int, array>
     */
    private function simulateGoalKick(): array
    {
        $defSide = $this->state->opponent($this->state->possession);
        $gk = $this->state->getGoalkeeper($defSide);
        if (!$gk) {
            return [];
        }

        $kicking = $this->state->getEffectiveAttribute($gk->id, 'kicking');
        $throwing = $this->state->getEffectiveAttribute($gk->id, 'throwing');

        // Goal kick starts from the 6-yard box
        $gkX = $defSide === 'home' ? 6.0 : 94.0;
        $this->state->ball = ['x' => $gkX, 'y' => (float) random_int(35, 65)];

        // GK distribution based on tactic
        $tactic = $defSide === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
        $useShort = false;
        if ($tactic && ($tactic->take_short_kicks || $tactic->roll_out || $tactic->play_out_of_defence)) {
            $useShort = true;
        }

        // Goal kick retention based on kicking/throwing quality
        $retainBase = 60 + ($kicking - 10) * 1.5;
        if ($useShort) {
            $retainBase += 10; // Short distribution retains better
        }
        $retainBase = max(40, min(85, $retainBase));

        if (random_int(1, 100) <= (int) $retainBase) {
            $this->state->possession = $defSide;
        }

        // Ball lands based on distribution type
        if ($useShort) {
            $landX = $defSide === 'home' ? (float) random_int(15, 30) : (float) random_int(70, 85);
        } else {
            $landX = $defSide === 'home' ? (float) random_int(35, 55) : (float) random_int(45, 65);
        }
        $this->state->ball = ['x' => $landX, 'y' => (float) random_int(25, 75)];

        return [$this->buildEvent('goal_kick', $defSide, $gk, null, 'success', [])];
    }

    // =========================================================================
    //  DEFENSIVE ACTION SIMULATION
    // =========================================================================

    /**
     * Simulate a defensive action (tackle, interception, clearance).
     *
     * @return array<int, array>
     */
    private function simulateDefensiveAction(): array
    {
        $defSide = $this->state->opponent($this->state->possession);
        $attSide = $this->state->possession;
        $events = [];

        $roll = random_int(1, 100);

        if ($roll <= 40) {
            // Tackle - use strength + tackling + anticipation
            $tackler = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'tackling');
            $attacker = $this->pickWeightedPlayer($attSide, self::SHOOTING_POSITIONS, 'dribbling');
            if ($tackler && $attacker) {
                // Tackle success influenced by both players
                $tackleSkill = $this->state->getEffectiveAttribute($tackler->id, 'tackling');
                $tacklerStrength = $this->state->getEffectiveAttribute($tackler->id, 'strength');
                $dribbleSkill = $this->state->getEffectiveAttribute($attacker->id, 'dribbling');
                $attackerAgility = $this->state->getEffectiveAttribute($attacker->id, 'agility');

                // Tackle succeeds based on tackling+strength vs dribbling+agility
                $tackleChance = 60 + ($tackleSkill + $tacklerStrength - $dribbleSkill - $attackerAgility) * 0.5;
                $tackleChance = max(30, min(85, $tackleChance));

                if (random_int(1, 100) <= (int) $tackleChance) {
                    // Successful tackle — ball moves a few units in defender's direction
                    $this->clampBall();
                    $this->jitterBall();
                    $ballPos = $this->state->ball;
                    $tackleDisplace = random_int(3, 6);
                    $tackleEndX = $defSide === 'home'
                        ? min(98.0, $ballPos['x'] + $tackleDisplace)
                        : max(2.0, $ballPos['x'] - $tackleDisplace);
                    $tackleEndY = max(5.0, min(95.0, $ballPos['y'] + random_int(-3, 3)));
                    $tackleEnd = ['x' => $tackleEndX, 'y' => $tackleEndY];
                    $sequence = [
                        $this->buildSequenceAction('tackle', $tackler, $ballPos, $tackleEnd, random_int(200, 400)),
                    ];
                    $events[] = $this->buildEvent('tackle', $defSide, $tackler, $attacker, 'success', $sequence);
                    $this->state->stats[$defSide]['tackles']++;
                    $this->state->ball = $tackleEnd;
                    $this->state->possession = $defSide;
                }
                // Failed tackle: attacker keeps possession, no event emitted
            } elseif ($tackler) {
                // No attacker found, simple tackle
                $this->clampBall();
                $this->jitterBall();
                $ballPos = $this->state->ball;
                $tackleDisplace = random_int(3, 6);
                $tackleEndX = $defSide === 'home'
                    ? min(98.0, $ballPos['x'] + $tackleDisplace)
                    : max(2.0, $ballPos['x'] - $tackleDisplace);
                $tackleEndY = max(5.0, min(95.0, $ballPos['y'] + random_int(-3, 3)));
                $tackleEnd = ['x' => $tackleEndX, 'y' => $tackleEndY];
                $sequence = [
                    $this->buildSequenceAction('tackle', $tackler, $ballPos, $tackleEnd, random_int(200, 400)),
                ];
                $events[] = $this->buildEvent('tackle', $defSide, $tackler, null, 'success', $sequence);
                $this->state->stats[$defSide]['tackles']++;
                $this->state->ball = $tackleEnd;
                $this->state->possession = $defSide;
            }
        } elseif ($roll <= 70) {
            // Interception - use anticipation + concentration + vision
            $interceptor = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'anticipation');
            if ($interceptor) {
                $anticipation = $this->state->getEffectiveAttribute($interceptor->id, 'anticipation');
                $concentration = $this->state->getEffectiveAttribute($interceptor->id, 'concentration');
                $teamwork = $this->state->getEffectiveAttribute($interceptor->id, 'teamwork');

                // Success chance based on anticipation + concentration
                $interceptChance = 70 + ($anticipation + $concentration - 20) * 0.5 + ($teamwork - 10) * 0.3;
                $interceptChance = max(50, min(90, $interceptChance));

                if (random_int(1, 100) <= (int) $interceptChance) {
                    $ballPos = $this->state->ball;
                    $newX = max(2.0, min(98.0, $ballPos['x'] + random_int(-8, 8)));
                    $newY = max(5.0, min(95.0, $ballPos['y'] + random_int(-8, 8)));
                    $newPos = ['x' => $newX, 'y' => $newY];
                    $sequence = [
                        $this->buildSequenceAction('run', $interceptor, $ballPos, $newPos, random_int(200, 500)),
                    ];
                    $events[] = $this->buildEvent('interception', $defSide, $interceptor, null, 'success', $sequence);
                    $this->state->stats[$defSide]['interceptions']++;
                    $this->state->ball = $newPos;
                    $this->state->possession = $defSide;
                }
            }
        } else {
            // Clearance - use heading + strength + bravery
            $clearer = $this->pickWeightedPlayer($defSide, ['CB', 'SW', 'DM'], 'heading');
            if ($clearer) {
                $heading = $this->state->getEffectiveAttribute($clearer->id, 'heading');
                $strength = $this->state->getEffectiveAttribute($clearer->id, 'strength');
                $bravery = $this->state->getEffectiveAttribute($clearer->id, 'bravery');

                $ballStart = $this->state->ball;
                $clearDistance = max(20.0, 15 + ($heading - 10) * 1.0 + ($strength - 10) * 0.5);
                $clearX = $defSide === 'home'
                    ? min(75.0, $ballStart['x'] + $clearDistance)
                    : max(2.0, $ballStart['x'] - $clearDistance);
                // Constrain Y relative to start position (±20) rather than fully random
                $clearY = max(5.0, min(95.0, $ballStart['y'] + random_int(-20, 20)));
                $ballEnd = ['x' => max(2.0, min(98.0, $clearX)), 'y' => $clearY];
                $sequence = [
                    $this->buildSequenceAction('clearance', $clearer, $ballStart, $ballEnd, random_int(200, 400)),
                ];
                $events[] = $this->buildEvent('clearance', $defSide, $clearer, null, 'success', $sequence);
                $this->state->stats[$defSide]['clearances']++;
                $this->state->ball = $ballEnd;
                $this->state->possession = $defSide;

                // 10% chance clearance goes behind for a corner
                if (random_int(1, 100) <= 10) {
                    $attSide = $this->state->opponent($defSide);
                    $events = array_merge($events, $this->awardCorner($attSide));
                }
            }
        }

        return $events;
    }

    // =========================================================================
    //  OFFSIDE SIMULATION
    // =========================================================================

    /**
     * Simulate an offside call.
     *
     * @return array<int, array>
     */
    private function simulateOffside(): array
    {
        $side = $this->state->possession;
        // Forwards with high pace are more likely to be caught offside
        $player = $this->pickWeightedPlayer($side, ['ST', 'CF', 'F9', 'LW', 'RW'], 'pace');
        if (!$player) {
            return [];
        }

        // Offside check: off_the_ball and decisions reduce offside likelihood
        $offTheBall = $this->state->getEffectiveAttribute($player->id, 'off_the_ball');
        $playerDecisions = $this->state->getEffectiveAttribute($player->id, 'decisions');
        $anticipation = $this->state->getEffectiveAttribute($player->id, 'anticipation');

        // Smart players avoid offside more often
        $avoidChance = ($offTheBall + $playerDecisions + $anticipation - 30) * 1.5;
        $avoidChance = max(0, min(40, $avoidChance));

        if (random_int(1, 100) <= (int) $avoidChance) {
            // Player was smart enough to time the run - no offside
            return [];
        }

        // Check defending team's offside trap
        $defSide = $this->state->opponent($side);
        $defTactic = $defSide === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
        if ($defTactic && ($defTactic->use_offside_trap || $defTactic->offside_trap)) {
            // Offside trap increases offside catch rate - GK communication helps execute it
            $gk = $this->state->getGoalkeeper($defSide);
            if ($gk) {
                $communication = $this->state->getEffectiveAttribute($gk->id, 'communication');
                // Better communication = trap works more often (already past the check, so we continue)
            }
        }

        $this->state->stats[$side]['offsides']++;

        $ballPos = $this->state->ball;
        $runEndX = $side === 'home'
            ? min(98.0, $ballPos['x'] + 10)
            : max(2.0, $ballPos['x'] - 10);
        $sequence = [
            $this->buildSequenceAction('run', $player, $ballPos, ['x' => $runEndX, 'y' => $ballPos['y']], random_int(200, 500)),
        ];

        return [$this->buildEvent('offside', $side, $player, null, 'fail', $sequence)];
    }

    // =========================================================================
    //  SUBSTITUTION LOGIC
    // =========================================================================

    /**
     * Check if a substitution should happen and execute it.
     *
     * @return array<int, array>
     */
    private function maybeSubstitute(): array
    {
        $events = [];

        foreach (['home', 'away'] as $side) {
            if ($this->state->getSubstitutionCount($side) >= self::MAX_SUBSTITUTIONS) {
                continue;
            }

            // ~8% chance per minute after min 60 that a substitution happens
            if (random_int(1, 100) > 8) {
                continue;
            }

            $events = array_merge($events, $this->executeSubstitution($side));
        }

        return $events;
    }

    /**
     * Execute a substitution: replace the most fatigued outfield player with a bench player.
     *
     * @return array<int, array>
     */
    private function executeSubstitution(string $side): array
    {
        $lineup = $side === 'home' ? $this->state->homeLineup : $this->state->awayLineup;
        $bench = $side === 'home' ? $this->state->homeBench : $this->state->awayBench;

        if (empty($bench)) {
            return [];
        }

        // Find most fatigued outfield player
        $mostFatigued = null;
        $maxFatigue = -1.0;

        foreach ($lineup as $id => $player) {
            $pState = $this->state->playerStates[$id] ?? null;
            if (!$pState || $pState['is_sent_off'] || $pState['is_subbed_off'] || $pState['position'] === 'GK') {
                continue;
            }
            if ($pState['fatigue'] > $maxFatigue) {
                $maxFatigue = $pState['fatigue'];
                $mostFatigued = $player;
            }
        }

        if (!$mostFatigued) {
            return [];
        }

        // Find best bench player for the same position
        $outPosition = $this->state->playerStates[$mostFatigued->id]['position'];
        $compatibles = self::POSITION_COMPAT[$outPosition] ?? [$outPosition];

        $bestSub = null;
        $bestAbility = -1.0;

        foreach ($bench as $id => $benchPlayer) {
            $bState = $this->state->playerStates[$id] ?? null;
            if ($bState && ($bState['is_sent_off'] || $bState['is_subbed_off'])) {
                continue;
            }
            $primaryAbbr = $benchPlayer->primaryPosition->short_name ?? '';
            if (in_array($primaryAbbr, $compatibles, true)) {
                $ability = (float) ($benchPlayer->attributes->current_ability ?? 0);
                if ($ability > $bestAbility) {
                    $bestAbility = $ability;
                    $bestSub = $benchPlayer;
                }
            }
        }

        // Fallback: any bench player
        if (!$bestSub) {
            foreach ($bench as $id => $benchPlayer) {
                $bState = $this->state->playerStates[$id] ?? null;
                if ($bState && ($bState['is_sent_off'] || $bState['is_subbed_off'])) {
                    continue;
                }
                $ability = (float) ($benchPlayer->attributes->current_ability ?? 0);
                if ($ability > $bestAbility) {
                    $bestAbility = $ability;
                    $bestSub = $benchPlayer;
                }
            }
        }

        if (!$bestSub) {
            return [];
        }

        // Execute substitution
        $this->state->updatePlayerMorale($mostFatigued->id, 'substituted_off');
        $this->state->playerStates[$mostFatigued->id]['is_subbed_off'] = true;
        $this->state->playerStates[$bestSub->id]['position'] = $outPosition;
        $this->state->playerStates[$bestSub->id]['fatigue'] = 0.0;

        // Move sub into lineup and out of bench
        if ($side === 'home') {
            $this->state->homeLineup[$bestSub->id] = $bestSub;
            unset($this->state->homeBench[$bestSub->id]);
            $this->state->homeSubstitutions[] = [
                'minute' => $this->state->minute,
                'player_in_id' => $bestSub->id,
                'player_out_id' => $mostFatigued->id,
            ];
        } else {
            $this->state->awayLineup[$bestSub->id] = $bestSub;
            unset($this->state->awayBench[$bestSub->id]);
            $this->state->awaySubstitutions[] = [
                'minute' => $this->state->minute,
                'player_in_id' => $bestSub->id,
                'player_out_id' => $mostFatigued->id,
            ];
        }

        // Re-designate set-piece takers if the subbed player was a taker
        $this->reDesignateIfNeeded($side, $mostFatigued->id);

        $sequence = [];
        return [$this->buildEvent('substitution', $side, $bestSub, $mostFatigued, 'success', $sequence)];
    }

    /**
     * If a subbed-off player was a set-piece taker, re-designate.
     */
    private function reDesignateIfNeeded(string $side, int $removedPlayerId): void
    {
        $takers = $side === 'home' ? $this->state->homeSetPieceTakers : $this->state->awaySetPieceTakers;
        $needsRefresh = false;

        foreach ($takers as $role => $id) {
            if ($id === $removedPlayerId) {
                $needsRefresh = true;
                break;
            }
        }

        if ($needsRefresh) {
            $this->designateSetPieceTakers($side);
        }
    }

    // =========================================================================
    //  POSSESSION MODEL
    // =========================================================================

    /**
     * Resolve which team has possession this minute.
     */
    private function resolvePossession(): void
    {
        // Base keep rate, modified by tempo, directness, and mentality
        $keepRate = 80;
        $tactic = $this->state->possession === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
        $oppSide = $this->state->opponent($this->state->possession);
        $oppTactic = $oppSide === 'home' ? $this->state->homeTactic : $this->state->awayTactic;

        if ($tactic) {
            $tempo = $tactic->tempo ?? 'standard';
            if ($tempo === 'very_slow' || $tempo === 'slow') {
                $keepRate = 85; // Slow play keeps ball better
            }
            if ($tempo === 'very_fast' || $tempo === 'fast') {
                $keepRate = 75; // Fast play loses ball more
            }

            $directness = $tactic->passing_directness ?? 'mixed';
            if ($directness === 'short') {
                $keepRate += 3;
            }
            if ($directness === 'direct' || $directness === 'very_direct') {
                $keepRate -= 5;
            }

            // Mentality affects possession: attacking teams keep the ball more
            $mentality = $tactic->mentality ?? 'balanced';
            if ($mentality === 'very_attacking') {
                $keepRate += 6;
            } elseif ($mentality === 'attacking') {
                $keepRate += 3;
            } elseif ($mentality === 'defensive') {
                $keepRate -= 4;
            } elseif ($mentality === 'very_defensive') {
                $keepRate -= 8;
            }
        }

        // Opponent's pressing also challenges possession
        if ($oppTactic) {
            $oppPressing = $oppTactic->pressing ?? 'sometimes';
            if (in_array($oppPressing, ['often', 'always'], true)) {
                $keepRate -= 5; // High pressing disrupts possession
            } elseif (in_array($oppPressing, ['rarely', 'never'], true)) {
                $keepRate += 3; // Low pressing allows easy retention
            }
        }

        // Home advantage: home team retains possession slightly better
        if ($this->state->possession === 'home') {
            $keepRate += 3;
        }

        if (random_int(1, 100) <= $keepRate) {
            return;
        }

        // Compare team quality: average passing + technique of available players
        $homeQuality = $this->teamPossessionQuality('home');
        $awayQuality = $this->teamPossessionQuality('away');

        $total = $homeQuality + $awayQuality;
        if ($total <= 0) {
            $total = 1;
        }

        $homeChance = ($homeQuality / $total) * 100;

        $this->state->possession = random_int(1, 100) <= (int) $homeChance ? 'home' : 'away';
    }

    /**
     * Calculate a team's possession quality metric.
     */
    private function teamPossessionQuality(string $side): float
    {
        $players = $this->state->getAvailablePlayers($side);
        if (empty($players)) {
            return 1.0;
        }

        $total = 0.0;
        $count = 0;
        foreach ($players as $id => $player) {
            $passing = $this->state->getEffectiveAttribute($id, 'passing');
            $technique = $this->state->getEffectiveAttribute($id, 'technique');
            $vision = $this->state->getEffectiveAttribute($id, 'vision');
            $firstTouch = $this->state->getEffectiveAttribute($id, 'first_touch');
            $composure = $this->state->getEffectiveAttribute($id, 'composure');
            $decisions = $this->state->getEffectiveAttribute($id, 'decisions');

            // Weighted: passing and technique most important, then vision, composure, first_touch, decisions
            $total += $passing * 0.25 + $technique * 0.20 + $vision * 0.20 + $firstTouch * 0.15 + $composure * 0.10 + $decisions * 0.10;
            $count++;
        }

        return $count > 0 ? $total / $count : 1.0;
    }

    // =========================================================================
    //  FATIGUE
    // =========================================================================

    /**
     * Update fatigue for all active players.
     * Players with lower stamina accumulate fatigue faster.
     */
    private function updateFatigue(): void
    {
        foreach ($this->state->playerStates as $id => &$pState) {
            if ($pState['is_sent_off'] || $pState['is_subbed_off']) {
                continue;
            }

            $player = $this->state->homeLineup[$id] ?? $this->state->awayLineup[$id] ?? null;
            if (!$player) {
                continue;
            }

            $stamina = (float) ($player->attributes->stamina ?? 10);
            $naturalFitness = (float) ($player->attributes->natural_fitness ?? 10);
            // Combine stamina with natural_fitness for effective stamina
            $effectiveStamina = $stamina * (1.0 + ($naturalFitness - 10) / 40.0);

            // Base fatigue gain per minute: ~0.8-1.5% depending on stamina
            // Higher stamina = less fatigue gained
            $fatigueRate = 0.015 - ($effectiveStamina / 20.0) * 0.007;
            $fatigueRate = max(0.005, $fatigueRate);

            // Work rate + determination affect fatigue
            $workRate = (float) ($player->attributes->work_rate ?? 10);
            $determination = (float) ($player->attributes->determination ?? 10);
            if ($workRate > 14) {
                $fatigueRate *= 1.1; // hard workers tire slightly faster
            }
            // High determination provides slight fatigue resistance
            if ($determination > 15) {
                $fatigueRate *= 0.95;
            }

            // Tactic: high pressing and fast tempo increase fatigue
            $side = isset($this->state->homeLineup[$id]) ? 'home' : (isset($this->state->awayLineup[$id]) ? 'away' : null);
            if ($side) {
                $tactic = $side === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
                if ($tactic) {
                    $pressing = $tactic->pressing ?? 'sometimes';
                    if (in_array($pressing, ['often', 'always'], true)) {
                        $fatigueRate *= 1.15;
                    }
                    $tempo = $tactic->tempo ?? 'standard';
                    if ($tempo === 'very_fast' || $tempo === 'fast') {
                        $fatigueRate *= 1.10;
                    }
                }
            }

            $pState['fatigue'] = min(1.0, $pState['fatigue'] + $fatigueRate);
        }
    }

    // =========================================================================
    //  PLAYER SELECTION
    // =========================================================================

    /**
     * Pick a player from a side using weighted random selection based on an attribute.
     *
     * @param string $side 'home'|'away'
     * @param string[] $preferredPositions Position abbreviations to prefer
     * @param string $attribute Attribute name used for weighting
     * @param bool $inverse If true, lower attribute = higher weight (for fouls by bad tacklers)
     */
    private function pickWeightedPlayer(string $side, array $preferredPositions, string $attribute, bool $inverse = false): ?Player
    {
        $available = $this->state->getAvailablePlayers($side);
        if (empty($available)) {
            return null;
        }

        // Filter to preferred positions if possible
        $candidates = [];
        foreach ($available as $id => $player) {
            $pos = $this->state->playerStates[$id]['position'] ?? '';
            if (in_array($pos, $preferredPositions, true)) {
                $candidates[$id] = $player;
            }
        }

        // Fallback to all outfield players if no position match
        if (empty($candidates)) {
            $candidates = $this->state->getAvailableOutfieldPlayers($side);
        }
        if (empty($candidates)) {
            $candidates = $available;
        }

        // Build weighted pool
        $weights = [];
        foreach ($candidates as $id => $player) {
            $attrValue = $this->state->getEffectiveAttribute($id, $attribute);
            if ($inverse) {
                // Invert: lower attribute = higher weight (21 - value)
                $weight = max(1, 21 - $attrValue);
            } else {
                $weight = max(1, $attrValue);
            }
            $weights[$id] = $weight;
        }

        return $this->weightedRandomPick($candidates, $weights);
    }

    /**
     * Pick a random available outfield player from a side.
     */
    private function pickRandomAvailablePlayer(string $side): ?Player
    {
        $players = $this->state->getAvailableOutfieldPlayers($side);
        if (empty($players)) {
            $players = $this->state->getAvailablePlayers($side);
        }
        if (empty($players)) {
            return null;
        }
        $keys = array_keys($players);
        return $players[$keys[array_rand($keys)]];
    }

    /**
     * Simulate a pass: pick a passer and a DIFFERENT receiver, advance ball, track stats.
     *
     * @param string $side 'home'|'away'
     * @param array $currentSequence The running sequence of sub-actions
     * @return array|null Returns ['sequence' => ..., 'receiver' => ...] or null if no players
     */
    private function simulatePass(string $side, array $currentSequence): ?array
    {
        // Use BOTH passing and vision for passer selection (creative players)
        $passer = $this->pickWeightedPlayer($side, self::CREATIVE_POSITIONS, 'passing');
        if (!$passer) {
            return null;
        }

        // Pick a DIFFERENT player as receiver
        $receiver = $this->pickReceiverExcluding($side, $passer->id);
        if (!$receiver) {
            return null;
        }

        $passingAttr = $this->state->getEffectiveAttribute($passer->id, 'passing');
        $vision = $this->state->getEffectiveAttribute($passer->id, 'vision');
        $receiverFirstTouch = $this->state->getEffectiveAttribute($receiver->id, 'first_touch');
        $receiverOffTheBall = $this->state->getEffectiveAttribute($receiver->id, 'off_the_ball');

        // Pass completion check: based on passing + vision vs opponent pressing
        $passQuality = ($passingAttr + $vision) / 2.0;
        $receiveQuality = ($receiverFirstTouch + $receiverOffTheBall) / 2.0;
        $completionChance = 75 + ($passQuality - 10) * 1.0 + ($receiveQuality - 10) * 0.5;

        // Tactic: direct passing reduces completion
        $tactic = $side === 'home' ? $this->state->homeTactic : $this->state->awayTactic;
        if ($tactic) {
            $directness = $tactic->passing_directness ?? 'mixed';
            if ($directness === 'direct' || $directness === 'very_direct') {
                $completionChance -= 8;
            } elseif ($directness === 'short') {
                $completionChance += 5;
            }
        }
        $completionChance = max(50, min(95, $completionChance));

        if (random_int(1, 100) > (int) $completionChance) {
            // Pass intercepted! Turnover
            $this->state->possession = $this->state->opponent($side);
            return null; // Failed pass, no sequence added
        }

        $ballStart = $this->state->ball;
        $this->advanceBall($side, 3.0, 12.0);

        $step = $this->buildSequenceAction('pass', $passer, $ballStart, $this->state->ball, random_int(300, 600));
        $step['target_id'] = $receiver->id;
        $step['target_name'] = $receiver->first_name . ' ' . $receiver->last_name;

        $currentSequence[] = $step;
        $this->state->stats[$side]['passes']++;

        return ['sequence' => $currentSequence, 'receiver' => $receiver];
    }

    /**
     * Simulate a player carrying/dribbling the ball forward.
     *
     * @param string $side 'home'|'away'
     * @param array $currentSequence The running sequence of sub-actions
     * @return array|null Returns ['sequence' => ...] or null if no player available
     */
    private function simulateCarry(string $side, array $currentSequence): ?array
    {
        $carrier = $this->pickWeightedPlayer($side, self::SHOOTING_POSITIONS, 'dribbling');
        if (!$carrier) {
            return null;
        }

        $dribbling = $this->state->getEffectiveAttribute($carrier->id, 'dribbling');
        $agility = $this->state->getEffectiveAttribute($carrier->id, 'agility');
        $acceleration = $this->state->getEffectiveAttribute($carrier->id, 'acceleration');
        $balance = $this->state->getEffectiveAttribute($carrier->id, 'balance');
        $flair = $this->state->getEffectiveAttribute($carrier->id, 'flair');

        // Dribble distance influenced by pace/acceleration
        $minDx = 5.0 + ($acceleration - 10) * 0.3;
        $maxDx = 15.0 + ($agility - 10) * 0.5;

        $ballStart = $this->state->ball;
        $this->advanceBall($side, $minDx, $maxDx);

        // Flair chance: high flair = skill move (adds visual flair to sequence)
        $actionType = 'dribble';
        if ($flair > 15 && random_int(1, 100) <= 20) {
            $actionType = 'skill_move'; // Special animation cue
        }

        $step = $this->buildSequenceAction($actionType, $carrier, $ballStart, $this->state->ball, random_int(400, 800));
        $currentSequence[] = $step;

        return ['sequence' => $currentSequence];
    }

    /**
     * Pick a receiver from a side's available outfield players, excluding a specific player.
     *
     * @param string $side 'home'|'away'
     * @param int $excludeId Player ID to exclude (the passer)
     */
    private function pickReceiverExcluding(string $side, int $excludeId): ?Player
    {
        $available = $this->state->getAvailableOutfieldPlayers($side);
        unset($available[$excludeId]);
        if (empty($available)) {
            return null;
        }
        $keys = array_keys($available);
        return $available[$keys[array_rand($keys)]];
    }

    /**
     * Check if the ball is in the attacking third for the given side.
     *
     * Home attacks toward x=100 (attacking third: x > 65).
     * Away attacks toward x=0 (attacking third: x < 35).
     */
    private function isInAttackingThird(string $side): bool
    {
        $x = $this->state->ball['x'];
        return $side === 'home' ? $x > 65 : $x < 35;
    }

    /**
     * Find a specific player in a side's lineup.
     */
    private function findPlayer(string $side, ?int $playerId): ?Player
    {
        if ($playerId === null) {
            return null;
        }

        $lineup = $this->state->getLineup($side);
        if (isset($lineup[$playerId])) {
            $state = $this->state->playerStates[$playerId] ?? null;
            if ($state && !$state['is_sent_off'] && !$state['is_subbed_off']) {
                return $lineup[$playerId];
            }
        }
        return null;
    }

    /**
     * Pick the best player by a single attribute from a collection.
     */
    private function pickBestPlayerByAttribute(array $players, string $attribute): ?Player
    {
        $best = null;
        $bestVal = -1.0;

        foreach ($players as $player) {
            $val = (float) ($player->attributes->{$attribute} ?? 0);
            if ($val > $bestVal) {
                $bestVal = $val;
                $best = $player;
            }
        }

        return $best;
    }

    /**
     * Weighted random selection from a keyed array.
     *
     * @param array<int, Player> $items
     * @param array<int, float> $weights
     */
    private function weightedRandomPick(array $items, array $weights): ?Player
    {
        if (empty($weights)) {
            return null;
        }

        $totalWeight = array_sum($weights);
        if ($totalWeight <= 0) {
            $keys = array_keys($items);
            return $items[$keys[array_rand($keys)]] ?? null;
        }

        $rand = mt_rand() / mt_getrandmax() * $totalWeight;
        $cumulative = 0.0;

        foreach ($weights as $id => $weight) {
            $cumulative += $weight;
            if ($rand <= $cumulative) {
                return $items[$id] ?? null;
            }
        }

        // Fallback
        $keys = array_keys($items);
        return $items[end($keys)] ?? null;
    }

    // =========================================================================
    //  BALL & PITCH COORDINATES
    // =========================================================================

    /**
     * Clamp ball position within playable pitch bounds (2-98 x, 2-98 y).
     * Prevents events from occurring exactly on or beyond the boundary lines.
     */
    private function clampBall(): void
    {
        $this->state->ball['x'] = max(2.0, min(98.0, (float) $this->state->ball['x']));
        $this->state->ball['y'] = max(2.0, min(98.0, (float) $this->state->ball['y']));
    }

    /**
     * Add small random jitter to the current ball position to avoid
     * identical coordinates on consecutive events.
     */
    private function jitterBall(): void
    {
        $this->state->ball['x'] = max(2.0, min(98.0, $this->state->ball['x'] + (mt_rand(-200, 200) / 100.0)));
        $this->state->ball['y'] = max(2.0, min(98.0, $this->state->ball['y'] + (mt_rand(-200, 200) / 100.0)));
    }

    /**
     * Move ball forward toward the attacking goal.
     * Home attacks toward x=100, away attacks toward x=0.
     */
    private function moveBallForward(string $side): void
    {
        $dx = (float) random_int(10, 25);
        if ($side === 'away') {
            $dx = -$dx;
        }
        $this->state->ball['x'] = max(2.0, min(98.0, $this->state->ball['x'] + $dx));
        $this->state->ball['y'] = max(5.0, min(95.0, $this->state->ball['y'] + random_int(-10, 10)));
    }

    /**
     * Advance ball by a small amount during build-up.
     */
    private function advanceBall(string $side, float $minDx, float $maxDx): void
    {
        $dx = $minDx + (mt_rand() / mt_getrandmax()) * ($maxDx - $minDx);
        if ($side === 'away') {
            $dx = -$dx;
        }
        $this->state->ball['x'] = max(2.0, min(98.0, $this->state->ball['x'] + $dx));
        $this->state->ball['y'] = max(5.0, min(95.0, $this->state->ball['y'] + random_int(-5, 5)));
    }

    /**
     * Move ball progressively toward the attacking third (not teleporting).
     *
     * Advances 60-80% of the remaining distance toward the goal area.
     */
    private function moveBallToAttackingThird(string $side): void
    {
        $target = $side === 'home' ? 85.0 : 15.0;
        $current = $this->state->ball['x'];
        // Move 60-80% of the way toward the attacking third
        $progress = 0.6 + (mt_rand() / mt_getrandmax()) * 0.2;
        $this->state->ball['x'] = max(2.0, min(98.0, $current + ($target - $current) * $progress));
        $this->state->ball['y'] = max(5.0, min(95.0, $this->state->ball['y'] + random_int(-15, 15)));
    }

    /**
     * Get the goal position for a side (the goal they are attacking).
     */
    private function goalPosition(string $side): array
    {
        // Home attacks toward x=100, away toward x=0
        // Y varies within goal width (roughly 35-65 maps to inside the posts)
        $goalY = 50.0 + random_int(-12, 12);
        return $side === 'home'
            ? ['x' => 99.0, 'y' => $goalY]
            : ['x' => 1.0, 'y' => $goalY];
    }

    /**
     * Position where the ball ends after a GK deflection that goes behind the goal.
     * Tipped over bar (~65%) or parried past the post (~35%).
     */
    private function saveDeflectionPosition(string $side, array $goalPos): array
    {
        $tippedOverBar = random_int(1, 100) <= 65;

        if ($tippedOverBar) {
            // Ball tipped over the bar — goes straight back behind the goal
            return $side === 'home'
                ? ['x' => 99.0, 'y' => $goalPos['y'] + random_int(-3, 3)]
                : ['x' => 1.0, 'y' => $goalPos['y'] + random_int(-3, 3)];
        }

        // Ball parried wide past the post — deflects to one side
        $wideDelta = random_int(10, 20) * (random_int(0, 1) === 0 ? -1 : 1);
        $deflectedY = max(2.0, min(98.0, $goalPos['y'] + $wideDelta));
        return $side === 'home'
            ? ['x' => 99.0, 'y' => $deflectedY]
            : ['x' => 1.0, 'y' => $deflectedY];
    }

    /**
     * Get a "missed shot" end position (past the goal line but off target).
     */
    private function missedShotPosition(string $side): array
    {
        $goal = $this->goalPosition($side);
        $goal['y'] += random_int(-30, 30);
        $goal['y'] = max(0.0, min(100.0, $goal['y']));
        return $goal;
    }

    /**
     * Get the penalty spot position.
     */
    private function penaltySpotPosition(string $side): array
    {
        return $side === 'home'
            ? ['x' => 88.0, 'y' => 50.0]
            : ['x' => 12.0, 'y' => 50.0];
    }

    /**
     * Get corner kick position.
     */
    private function cornerPosition(string $side): array
    {
        $goalSide = $side === 'home' ? 99.0 : 1.0;
        $cornerY = random_int(0, 1) === 0 ? 1.0 : 99.0;
        return ['x' => $goalSide, 'y' => $cornerY];
    }

    /**
     * Determine zone from current ball position relative to possessing team.
     */
    private function updateZoneFromBall(): void
    {
        $x = $this->state->ball['x'];

        if ($this->state->possession === 'home') {
            // Home attacks toward x=100
            if ($x < 35) {
                $this->state->zone = 'def_home';
            } elseif ($x > 65) {
                $this->state->zone = 'att_home';
            } else {
                $this->state->zone = 'mid';
            }
        } else {
            // Away attacks toward x=0
            if ($x > 65) {
                $this->state->zone = 'def_home';
            } elseif ($x < 35) {
                $this->state->zone = 'att_home';
            } else {
                $this->state->zone = 'mid';
            }
        }
    }

    /**
     * Determine the zone where a foul occurs for set-piece chain logic.
     */
    private function determineFoulZone(string $attackingSide): string
    {
        $roll = random_int(1, 100);

        // 1% penalty area, 25% attacking third, 74% midfield/own half
        if ($roll <= 1) {
            return 'penalty_area';
        }
        if ($roll <= 26) {
            return 'attacking_third';
        }
        return 'midfield';
    }

    /**
     * Get coordinates for where a foul occurs.
     */
    private function foulCoordinates(string $attackingSide, string $zone): array
    {
        return match ($zone) {
            'penalty_area' => $attackingSide === 'home'
                ? ['x' => (float) random_int(85, 95), 'y' => (float) random_int(30, 70)]
                : ['x' => (float) random_int(5, 15), 'y' => (float) random_int(30, 70)],
            'attacking_third' => $attackingSide === 'home'
                ? ['x' => (float) random_int(70, 85), 'y' => (float) random_int(15, 85)]
                : ['x' => (float) random_int(15, 30), 'y' => (float) random_int(15, 85)],
            default => ['x' => (float) random_int(35, 65), 'y' => (float) random_int(15, 85)],
        };
    }

    // =========================================================================
    //  EVENT BUILDERS
    // =========================================================================

    /**
     * Build a structured event array.
     *
     * @param array<int, array> $sequence Animation sub-actions
     */
    private function buildEvent(
        string $type,
        string $team,
        Player $primaryPlayer,
        ?Player $secondaryPlayer,
        string $outcome,
        array $sequence
    ): array {
        return [
            'type' => $type,
            'team' => $team,
            'primary_player_id' => $primaryPlayer->id,
            'primary_player_name' => $primaryPlayer->first_name . ' ' . $primaryPlayer->last_name,
            'secondary_player_id' => $secondaryPlayer?->id,
            'secondary_player_name' => $secondaryPlayer
                ? ($secondaryPlayer->first_name . ' ' . $secondaryPlayer->last_name)
                : null,
            'outcome' => $outcome,
            'coordinates' => $this->state->ball,
            'description' => '', // filled by commentary builder
            'sequence' => $sequence,
        ];
    }

    /**
     * Build a structural event (kickoff, half_time, full_time) with no specific player.
     */
    private function buildStructuralEvent(string $type, string $team): array
    {
        // Pick a generic player for kickoff, or use first available
        $player = $this->pickRandomAvailablePlayer($team);

        return [
            'type' => $type,
            'team' => $team,
            'primary_player_id' => $player?->id ?? 0,
            'primary_player_name' => $player ? ($player->first_name . ' ' . $player->last_name) : '',
            'secondary_player_id' => null,
            'secondary_player_name' => null,
            'outcome' => 'success',
            'coordinates' => ['x' => 50.0, 'y' => 50.0],
            'description' => '',
            'sequence' => [],
        ];
    }

    /**
     * Build a free kick event.
     */
    private function buildFreeKickEvent(string $side): array
    {
        $takers = $side === 'home' ? $this->state->homeSetPieceTakers : $this->state->awaySetPieceTakers;
        $takerId = $takers['free_kick'];
        $taker = $this->findPlayer($side, $takerId);
        if (!$taker) {
            $taker = $this->pickWeightedPlayer($side, self::CREATIVE_POSITIONS, 'free_kick_taking');
        }
        if (!$taker) {
            $taker = $this->pickRandomAvailablePlayer($side);
        }

        // Pick a receiver for the free kick pass
        $receiver = $this->pickWeightedPlayer($side, self::CREATIVE_POSITIONS, 'off_the_ball');
        if (!$receiver || $receiver->id === $taker->id) {
            $receiver = $this->pickRandomAvailablePlayer($side);
        }

        // Animate free kick: taker runs to ball, then plays a short pass forward
        $ballPos = $this->state->ball;
        $approachPos = ['x' => max(2.0, min(98.0, $ballPos['x'] + ($side === 'home' ? -3 : 3))), 'y' => $ballPos['y']];
        $dx = $side === 'home' ? random_int(5, 15) : -random_int(5, 15);
        $passEnd = ['x' => max(2.0, min(98.0, $ballPos['x'] + $dx)), 'y' => max(5.0, min(95.0, $ballPos['y'] + random_int(-8, 8)))];

        $passStep = $this->buildSequenceAction('pass', $taker, $ballPos, $passEnd, random_int(300, 600));
        if ($receiver) {
            $passStep['target_id'] = $receiver->id;
            $passStep['target_name'] = $receiver->first_name . ' ' . $receiver->last_name;
        }

        $sequence = [
            $this->buildSequenceAction('run', $taker, $approachPos, $ballPos, random_int(200, 400)),
            $passStep,
        ];

        $this->state->ball = $passEnd;

        return $this->buildEvent('free_kick', $side, $taker, null, 'success', $sequence);
    }

    /**
     * Build a sequence sub-action for animation.
     */
    private function buildSequenceAction(
        string $action,
        Player $actor,
        array $ballStart,
        array $ballEnd,
        int $durationMs
    ): array {
        return [
            'action' => $action,
            'actor_id' => $actor->id,
            'actor_name' => $actor->first_name . ' ' . $actor->last_name,
            'ball_start' => $ballStart,
            'ball_end' => $ballEnd,
            'duration_ms' => $durationMs,
        ];
    }

    // =========================================================================
    //  PHASE RESOLUTION
    // =========================================================================

    /**
     * Determine the current phase based on events that occurred.
     */
    private function resolvePhase(array $events): string
    {
        if (empty($events)) {
            return 'open_play';
        }

        foreach ($events as $event) {
            $type = $event['type'] ?? '';
            if (in_array($type, ['corner', 'free_kick', 'penalty', 'throw_in', 'goal_kick'])) {
                return 'set_piece';
            }
            if (in_array($type, ['goal', 'shot_on_target', 'shot_off_target', 'header', 'cross', 'dribble'])) {
                $team = $event['team'] ?? '';
                return $team === 'home' ? 'attack_home' : 'attack_away';
            }
        }

        return 'open_play';
    }
}
