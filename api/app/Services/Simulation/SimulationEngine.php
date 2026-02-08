<?php

declare(strict_types=1);

namespace App\Services\Simulation;

use App\Models\Formation;
use App\Models\GameMatch;
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
     */
    private function initializeMatch(GameMatch $match): void
    {
        // Load relations
        $match->loadMissing([
            'homeTeam.players.attributes',
            'homeTeam.players.primaryPosition',
            'awayTeam.players.attributes',
            'awayTeam.players.primaryPosition',
            'homeFormation',
            'awayFormation',
        ]);

        $this->state->homeTeam = $match->homeTeam;
        $this->state->awayTeam = $match->awayTeam;
        $this->state->homeFormation = $match->homeFormation;
        $this->state->awayFormation = $match->awayFormation;

        // Select starting XIs
        $this->selectLineup('home', $match->homeTeam, $match->homeFormation);
        $this->selectLineup('away', $match->awayTeam, $match->awayFormation);

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

            // Decide possession for this minute
            $this->resolvePossession();

            // Track possession minute
            if ($this->state->possession === 'home') {
                $this->state->homePossessionMinutes++;
            } else {
                $this->state->awayPossessionMinutes++;
            }
            $this->state->recalculatePossession();

            // Generate passes for quiet minutes too
            $passCount = random_int(3, 8);
            $this->state->stats[$this->state->possession]['passes'] += $passCount;

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
     * Simulate a single minute and return an array of events.
     *
     * @return array<int, array>
     */
    private function simulateMinute(): array
    {
        // Roll: does something notable happen? (35-45% chance)
        $actionChance = random_int(35, 45);
        if (random_int(1, 100) > $actionChance) {
            // Quiet minute
            return [];
        }

        $roll = random_int(1, 100);

        return match (true) {
            $roll <= 35  => $this->simulateAttack(),      // 35% attack
            $roll <= 65  => $this->simulateFoul(),         // 30% foul
            $roll <= 80  => $this->simulateSetPiece(),     // 15% set piece
            $roll <= 90  => $this->simulateDefensiveAction(), // 10% defensive
            default      => $this->simulateOffside(),      // 10% offside
        };
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
                $sequence[] = $this->buildSequenceAction('pass', $passer, $ballStart, $this->state->ball, random_int(800, 1500));
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
                $sequence[] = $this->buildSequenceAction('cross', $crosser, $ballStart, $this->state->ball, random_int(1000, 2000));
                $events[] = $this->buildEvent('cross', $side, $crosser, null, 'success', $sequence);
                $sequence = [];
            }
        } elseif ($creationType <= 70) {
            // Through ball
            if ($lastPasser) {
                $ballStart = $this->state->ball;
                $this->moveBallToAttackingThird($side);
                $sequence[] = $this->buildSequenceAction('pass', $lastPasser, $ballStart, $this->state->ball, random_int(600, 1200));
            }
        } else {
            // Dribble
            $dribbler = $this->pickWeightedPlayer($side, self::SHOOTING_POSITIONS, 'dribbling');
            if ($dribbler) {
                $creator = $dribbler;
                $defender = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'tackling');
                $ballStart = $this->state->ball;
                $this->moveBallToAttackingThird($side);
                $sequence[] = $this->buildSequenceAction('dribble', $dribbler, $ballStart, $this->state->ball, random_int(1500, 2500));
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

        $shooter = $this->pickWeightedPlayer($side, self::SHOOTING_POSITIONS, 'finishing');
        if (!$shooter) {
            return $events;
        }

        $gk = $this->state->getGoalkeeper($defSide);
        $defender = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'positioning');

        $finishing = $this->state->getEffectiveAttribute($shooter->id, 'finishing');
        $composure = $this->state->getEffectiveAttribute($shooter->id, 'composure');
        $longShots = $this->state->getEffectiveAttribute($shooter->id, 'long_shots');
        $gkReflexes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'reflexes') : 10.0;
        $gkHandling = $gk ? $this->state->getEffectiveAttribute($gk->id, 'handling') : 10.0;
        $defPositioning = $defender ? $this->state->getEffectiveAttribute($defender->id, 'positioning') : 10.0;
        $defMarking = $defender ? $this->state->getEffectiveAttribute($defender->id, 'marking') : 10.0;

        $this->state->stats[$side]['shots']++;

        // Decision: blocked before shot (25%)
        $blockChance = 25 + ($defPositioning + $defMarking - 20) * 0.5;
        $blockChance = max(10, min(40, $blockChance));

        if (random_int(1, 100) <= (int) $blockChance) {
            // Blocked by defender
            $ballStart = $this->state->ball;
            $sequence = array_merge($priorSequence, [
                $this->buildSequenceAction('shoot', $shooter, $ballStart, $this->goalPosition($side), random_int(400, 800)),
                $this->buildSequenceAction('clearance', $defender ?? $shooter, $this->goalPosition($side), $ballStart, random_int(200, 500)),
            ]);

            $events[] = $this->buildEvent('shot_on_target', $side, $shooter, $defender, 'blocked', $sequence);

            // Blocked shot: 50% corner, 50% loose ball
            if (random_int(1, 100) <= 50) {
                $events = array_merge($events, $this->awardCorner($side));
            }

            return $events;
        }

        // Shot goes off: 40% off target
        $missChance = 40 - ($finishing - 10) * 1.5 - ($composure - 10) * 0.5;
        $missChance = max(15, min(60, $missChance));

        if (random_int(1, 100) <= (int) $missChance) {
            // Off target
            $ballStart = $this->state->ball;
            $sequence = array_merge($priorSequence, [
                $this->buildSequenceAction('shoot', $shooter, $ballStart, $this->missedShotPosition($side), random_int(400, 800)),
            ]);

            $events[] = $this->buildEvent('shot_off_target', $side, $shooter, null, 'wide', $sequence);
            return $events;
        }

        // On target (remaining ~35%)
        $this->state->stats[$side]['shots_on_target']++;

        // Goal chance: ~25% of on-target shots = ~9% of total shots
        $goalChance = 25 + ($finishing - 10) * 1.0 + ($composure - 10) * 0.5 - ($gkReflexes - 10) * 0.8;
        $goalChance = max(10, min(45, $goalChance));

        $ballStart = $this->state->ball;
        $goalPos = $this->goalPosition($side);

        if (random_int(1, 100) <= (int) $goalChance) {
            // GOAL!
            $sequence = array_merge($priorSequence, [
                $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalPos, random_int(400, 700)),
            ]);

            $goalEvent = $this->buildEvent('goal', $side, $shooter, $assistProvider, 'goal', $sequence);
            $events[] = $goalEvent;

            // Update score
            $this->state->score[$side]++;
            $this->state->playerStates[$shooter->id]['goals']++;
            if ($assistProvider && $assistProvider->id !== $shooter->id) {
                $this->state->playerStates[$assistProvider->id]['assists']++;
            }

            // Possession goes to conceding team
            $this->state->possession = $defSide;
            $this->state->ball = ['x' => 50.0, 'y' => 50.0];

            return $events;
        }

        // Save: 50% of non-goal on-target shots
        $saveChance = 50 + ($gkReflexes + $gkHandling - 20) * 0.5;
        $saveChance = max(30, min(75, $saveChance));

        if (random_int(1, 100) <= (int) $saveChance) {
            // Save
            $this->state->stats[$defSide]['saves']++;

            $sequence = array_merge($priorSequence, [
                $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalPos, random_int(400, 700)),
                $this->buildSequenceAction('save', $gk ?? $shooter, $goalPos, $goalPos, random_int(300, 600)),
            ]);

            $events[] = $this->buildEvent('save', $defSide, $gk ?? $shooter, $shooter, 'saved', $sequence);

            // After save: 60% corner, 40% GK holds
            if (random_int(1, 100) <= 60) {
                $events = array_merge($events, $this->awardCorner($side));
            }

            return $events;
        }

        // Blocked by defender (remaining)
        $sequence = array_merge($priorSequence, [
            $this->buildSequenceAction('shoot', $shooter, $ballStart, $goalPos, random_int(400, 700)),
            $this->buildSequenceAction('clearance', $defender ?? $shooter, $goalPos, $ballStart, random_int(200, 500)),
        ]);

        $events[] = $this->buildEvent('shot_on_target', $side, $shooter, $defender, 'blocked', $sequence);

        if (random_int(1, 100) <= 50) {
            $events = array_merge($events, $this->awardCorner($side));
        }

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

        $sequence = [
            $this->buildSequenceAction('run', $fouled, ['x' => $ballPos['x'] - 5, 'y' => $ballPos['y']], $ballPos, random_int(800, 1500)),
            $this->buildSequenceAction('foul', $fouler, $ballPos, $ballPos, random_int(200, 500)),
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

        // Yellow card: ~15% base, modified by aggression
        $yellowChance = 15 + ($aggression - 10) * 1.0;
        $yellowChance = max(5, min(35, $yellowChance));

        // Red card: ~1% base
        $redChance = 1 + max(0, ($aggression - 15)) * 0.5;

        if (random_int(1, 100) <= (int) $redChance) {
            // Straight red
            $this->state->stats[$side]['red_cards']++;
            $this->state->playerStates[$fouler->id]['is_sent_off'] = true;

            $events[] = $this->buildEvent('red_card', $side, $fouler, null, 'sent_off', []);
            return $events;
        }

        if (random_int(1, 100) <= (int) $yellowChance) {
            $this->state->playerStates[$fouler->id]['yellow_cards']++;
            $this->state->stats[$side]['yellow_cards']++;

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
        $gkReflexes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'reflexes') : 10.0;

        $penSpot = $this->penaltySpotPosition($attSide);
        $goalPos = $this->goalPosition($attSide);
        $this->state->ball = $penSpot;
        $this->state->stats[$attSide]['shots']++;
        $this->state->stats[$attSide]['shots_on_target']++;

        // 75% goal base, modified by penalty_taking vs GK reflexes
        $goalChance = 75 + ($penTaking - 10) * 0.8 - ($gkReflexes - 10) * 0.6;
        $goalChance = max(55, min(90, $goalChance));

        $sequence = [
            $this->buildSequenceAction('shoot', $taker, $penSpot, $goalPos, random_int(600, 1000)),
        ];

        if (random_int(1, 100) <= (int) $goalChance) {
            // Penalty goal
            $events[] = $this->buildEvent('penalty', $attSide, $taker, null, 'goal', $sequence);
            $this->state->score[$attSide]++;
            $this->state->playerStates[$taker->id]['goals']++;
            $this->state->possession = $defSide;
            $this->state->ball = ['x' => 50.0, 'y' => 50.0];
        } else {
            // Penalty saved
            $sequence[] = $this->buildSequenceAction('save', $gk ?? $taker, $goalPos, $goalPos, random_int(300, 600));
            $events[] = $this->buildEvent('penalty', $attSide, $taker, $gk, 'saved', $sequence);
            $this->state->stats[$defSide]['saves']++;
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
            $this->buildSequenceAction('cross', $taker, $cornerPos, $targetPos, random_int(1200, 2000)),
        ];

        $events[] = $this->buildEvent('corner', $side, $taker, null, 'success', $sequence);

        // Header attempt (60% of corners lead to a header)
        if (random_int(1, 100) <= 60) {
            $header = $this->pickWeightedPlayer($side, ['CB', 'ST', 'CF', 'SW'], 'heading');
            if ($header) {
                $headingAttr = $this->state->getEffectiveAttribute($header->id, 'heading');
                $jumpingAttr = $this->state->getEffectiveAttribute($header->id, 'jumping_reach');
                $gk = $this->state->getGoalkeeper($this->state->opponent($side));

                $this->state->stats[$side]['shots']++;

                // Header on target: base 40%, modified by heading + jumping
                $onTargetChance = 40 + ($headingAttr + $jumpingAttr - 20) * 0.8;
                $onTargetChance = max(20, min(65, $onTargetChance));

                if (random_int(1, 100) <= (int) $onTargetChance) {
                    $this->state->stats[$side]['shots_on_target']++;
                    $gkReflexes = $gk ? $this->state->getEffectiveAttribute($gk->id, 'reflexes') : 10.0;

                    // Goal from header: 20% of on-target headers
                    $goalChance = 20 + ($headingAttr - 10) * 1.0 - ($gkReflexes - 10) * 0.8;
                    $goalChance = max(8, min(35, $goalChance));

                    $hdrSequence = [
                        $this->buildSequenceAction('header', $header, $targetPos, $this->goalPosition($side), random_int(300, 600)),
                    ];

                    if (random_int(1, 100) <= (int) $goalChance) {
                        // Header goal
                        $events[] = $this->buildEvent('header', $side, $header, $taker, 'goal', $hdrSequence);
                        $this->state->score[$side]++;
                        $this->state->playerStates[$header->id]['goals']++;
                        $this->state->playerStates[$taker->id]['assists']++;
                        $this->state->possession = $this->state->opponent($side);
                        $this->state->ball = ['x' => 50.0, 'y' => 50.0];
                    } else {
                        // Header saved
                        $hdrSequence[] = $this->buildSequenceAction('save', $gk ?? $header, $this->goalPosition($side), $this->goalPosition($side), random_int(200, 500));
                        $events[] = $this->buildEvent('header', $side, $header, null, 'saved', $hdrSequence);
                        $defSide = $this->state->opponent($side);
                        $this->state->stats[$defSide]['saves']++;
                    }
                } else {
                    // Header off target
                    $hdrSequence = [
                        $this->buildSequenceAction('header', $header, $targetPos, $this->missedShotPosition($side), random_int(300, 600)),
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
    private function awardCorner(string $side): array
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
            return [$this->buildEvent('corner', $side, $taker, null, 'success', [])];
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

        // Goal kick: 60% possession goes to kicking team, 40% opponent wins it
        if (random_int(1, 100) <= 60) {
            $this->state->possession = $defSide;
        }
        $this->state->ball = ['x' => 50.0, 'y' => 50.0];

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

        if ($roll <= 45) {
            // Tackle
            $tackler = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'tackling');
            $attacker = $this->pickWeightedPlayer($attSide, self::SHOOTING_POSITIONS, 'dribbling');
            if ($tackler) {
                $ballPos = $this->state->ball;
                $sequence = [
                    $this->buildSequenceAction('tackle', $tackler, $ballPos, $ballPos, random_int(300, 700)),
                ];
                $events[] = $this->buildEvent('tackle', $defSide, $tackler, $attacker, 'success', $sequence);
                $this->state->stats[$defSide]['tackles']++;
                $this->state->possession = $defSide;
            }
        } elseif ($roll <= 80) {
            // Interception
            $interceptor = $this->pickWeightedPlayer($defSide, self::DEFENSIVE_POSITIONS, 'anticipation');
            if ($interceptor) {
                $ballPos = $this->state->ball;
                $sequence = [
                    $this->buildSequenceAction('run', $interceptor, $ballPos, $ballPos, random_int(200, 500)),
                ];
                $events[] = $this->buildEvent('interception', $defSide, $interceptor, null, 'success', $sequence);
                $this->state->possession = $defSide;
            }
        } else {
            // Clearance
            $clearer = $this->pickWeightedPlayer($defSide, ['CB', 'SW', 'DM'], 'heading');
            if ($clearer) {
                $ballStart = $this->state->ball;
                $ballEnd = ['x' => 50.0, 'y' => 50.0];
                $sequence = [
                    $this->buildSequenceAction('clearance', $clearer, $ballStart, $ballEnd, random_int(300, 600)),
                ];
                $events[] = $this->buildEvent('clearance', $defSide, $clearer, null, 'success', $sequence);
                $this->state->ball = $ballEnd;
                $this->state->possession = $defSide;
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

        $this->state->stats[$side]['offsides']++;

        $ballPos = $this->state->ball;
        $sequence = [
            $this->buildSequenceAction('run', $player, $ballPos, ['x' => $ballPos['x'] + 10, 'y' => $ballPos['y']], random_int(500, 1000)),
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
        // Base: keep current possession 60% of the time
        if (random_int(1, 100) <= 60) {
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
            $total += $passing + $technique;
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
            // Base fatigue gain per minute: ~0.8-1.5% depending on stamina
            // Higher stamina = less fatigue gained
            $fatigueRate = 0.015 - ($stamina / 20.0) * 0.007; // range ~0.008 to 0.015
            $fatigueRate = max(0.005, $fatigueRate);

            // Work rate increases fatigue for outfield players
            $workRate = (float) ($player->attributes->work_rate ?? 10);
            if ($workRate > 14) {
                $fatigueRate *= 1.1; // hard workers tire slightly faster
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
     * Move ball forward toward the attacking goal.
     * Home attacks toward x=100, away attacks toward x=0.
     */
    private function moveBallForward(string $side): void
    {
        $dx = (float) random_int(10, 25);
        if ($side === 'away') {
            $dx = -$dx;
        }
        $this->state->ball['x'] = max(0.0, min(100.0, $this->state->ball['x'] + $dx));
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
        $this->state->ball['x'] = max(0.0, min(100.0, $this->state->ball['x'] + $dx));
        $this->state->ball['y'] = max(5.0, min(95.0, $this->state->ball['y'] + random_int(-5, 5)));
    }

    /**
     * Move ball into the attacking third.
     */
    private function moveBallToAttackingThird(string $side): void
    {
        if ($side === 'home') {
            $this->state->ball['x'] = (float) random_int(75, 95);
        } else {
            $this->state->ball['x'] = (float) random_int(5, 25);
        }
        $this->state->ball['y'] = (float) random_int(20, 80);
    }

    /**
     * Get the goal position for a side (the goal they are attacking).
     */
    private function goalPosition(string $side): array
    {
        // Home attacks toward x=100, away toward x=0
        return $side === 'home'
            ? ['x' => 99.0, 'y' => 50.0]
            : ['x' => 1.0, 'y' => 50.0];
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
        $goalSide = $side === 'home' ? 100.0 : 0.0;
        $cornerY = random_int(0, 1) === 0 ? 0.0 : 100.0;
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

        // 5% penalty area, 25% attacking third, 70% midfield/own half
        if ($roll <= 5) {
            return 'penalty_area';
        }
        if ($roll <= 30) {
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

        return $this->buildEvent('free_kick', $side, $taker, null, 'success', []);
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
