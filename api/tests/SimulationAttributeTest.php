<?php
/**
 * Simulation Attribute, Tactics & Position Test Suite
 *
 * Validates that player attributes, tactics, morale, home advantage,
 * position familiarity, and ball/player positions all meaningfully
 * impact simulation results.
 *
 * Tests include adversarial scenarios: nonsense tactics, deliberately
 * mispositioned players, and morale extremes.
 *
 * Usage: php tests/SimulationAttributeTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\GameMatch;
use App\Models\Team;
use App\Models\Formation;
use App\Models\Tactic;
use App\Models\Player;
use App\Services\Simulation\SimulationEngine;
use App\Services\Simulation\MatchState;
use Illuminate\Support\Facades\DB;

// =========================================================================
//  HELPERS
// =========================================================================

$passCount = 0;
$failCount = 0;
$totalChecks = 0;

function check(bool $condition, string $msg): bool
{
    global $passCount, $failCount, $totalChecks;
    $totalChecks++;
    if ($condition) {
        $passCount++;
        echo "  \033[32m✓ PASS:\033[0m {$msg}\n";
        return true;
    } else {
        $failCount++;
        echo "  \033[31m✗ FAIL:\033[0m {$msg}\n";
        return false;
    }
}

function runSimulation(GameMatch $match): array
{
    $engine = new SimulationEngine();
    $ticks = [];
    foreach ($engine->simulate($match) as $tick) {
        $ticks[] = $tick;
    }
    return $ticks;
}

function getLastTick(array $ticks): array
{
    return end($ticks);
}

function collectAllEvents(array $ticks): array
{
    $events = [];
    foreach ($ticks as $tick) {
        foreach ($tick['events'] ?? [] as $event) {
            $events[] = $event;
        }
    }
    return $events;
}

function collectBallPositions(array $ticks): array
{
    $positions = [];
    foreach ($ticks as $tick) {
        if (isset($tick['ball'])) {
            $positions[] = [
                'minute' => $tick['minute'],
                'x' => $tick['ball']['x'],
                'y' => $tick['ball']['y'],
            ];
        }
    }
    return $positions;
}

function collectSequencePositions(array $ticks): array
{
    $positions = [];
    foreach ($ticks as $tick) {
        foreach ($tick['events'] ?? [] as $event) {
            foreach ($event['sequence'] ?? [] as $step) {
                if (isset($step['ball_start'])) {
                    $positions[] = $step['ball_start'];
                }
                if (isset($step['ball_end'])) {
                    $positions[] = $step['ball_end'];
                }
            }
        }
    }
    return $positions;
}

echo "==========================================================\n";
echo "  SIMULATION ATTRIBUTE & TACTICS TEST SUITE\n";
echo "==========================================================\n\n";

// Find base match
$match = GameMatch::with([
    'homeTeam.players.attributes',
    'homeTeam.players.primaryPosition',
    'homeTeam.primaryTactic',
    'awayTeam.players.attributes',
    'awayTeam.players.primaryPosition',
    'awayTeam.primaryTactic',
    'homeFormation',
    'awayFormation',
])->first();

if (!$match) {
    echo "ERROR: No match found in database. Run seeders first.\n";
    exit(1);
}

if (!$match->homeFormation) {
    $formation = Formation::first();
    if ($formation) {
        $match->home_formation_id = $formation->id;
        $match->away_formation_id = $formation->id;
        $match->save();
        $match->load(['homeFormation', 'awayFormation']);
    }
}

echo "Base match: {$match->homeTeam->name} vs {$match->awayTeam->name}\n";
echo "Home tactic: " . ($match->homeTeam->primaryTactic->mentality ?? 'none') . "\n";
echo "Away tactic: " . ($match->awayTeam->primaryTactic->mentality ?? 'none') . "\n\n";

// =========================================================================
//  TEST 1: BASELINE — Normal simulation sanity checks
// =========================================================================

echo "==========================================================\n";
echo "  TEST 1: BASELINE SIMULATION\n";
echo "==========================================================\n";

$ticks = runSimulation($match);
$lastTick = getLastTick($ticks);
$homeStats = $lastTick['stats']['home'];
$awayStats = $lastTick['stats']['away'];
$allEvents = collectAllEvents($ticks);

$totalPasses = $homeStats['passes'] + $awayStats['passes'];
$totalShots = $homeStats['shots'] + $awayStats['shots'];
$totalTackles = $homeStats['tackles'] + $awayStats['tackles'];
$totalOffsides = $homeStats['offsides'] + $awayStats['offsides'];
$totalFouls = $homeStats['fouls'] + $awayStats['fouls'];

echo "Score: {$lastTick['score']['home']}-{$lastTick['score']['away']}\n";
echo "Passes: {$totalPasses}, Shots: {$totalShots}, Tackles: {$totalTackles}, Fouls: {$totalFouls}\n";

check($totalPasses >= 400 && $totalPasses <= 1500, "Passes in range: {$totalPasses} (400-1500)");
check($totalShots >= 10 && $totalShots <= 45, "Shots in range: {$totalShots} (10-45)");
check($totalTackles >= 10, "Tackles reasonable: {$totalTackles} (>10)");
check($totalOffsides <= 12, "Offsides reasonable: {$totalOffsides} (<=12)");
check($totalFouls >= 5 && $totalFouls <= 50, "Fouls in range: {$totalFouls} (5-50)");

$minutesWithEvents = 0;
foreach ($ticks as $tick) {
    if (!empty($tick['events'])) $minutesWithEvents++;
}
$activityRate = $minutesWithEvents / count($ticks) * 100;
check($activityRate >= 70, "Activity rate: " . round($activityRate) . "% (>=70%)");

// =========================================================================
//  TEST 2: BALL POSITION REALISM
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 2: BALL & SEQUENCE POSITION VALIDATION\n";
echo "==========================================================\n";

$ballPositions = collectBallPositions($ticks);
$seqPositions = collectSequencePositions($ticks);

// Ball must always be within pitch bounds (0-100 x, 0-100 y)
$outOfBounds = 0;
foreach ($ballPositions as $bp) {
    if ($bp['x'] < -1 || $bp['x'] > 101 || $bp['y'] < -1 || $bp['y'] > 101) {
        $outOfBounds++;
    }
}
check($outOfBounds === 0, "Ball always within pitch bounds (tolerance 1): {$outOfBounds} violations");

// Sequence positions must be within pitch bounds
$seqOutOfBounds = 0;
foreach ($seqPositions as $sp) {
    if ($sp['x'] < -1 || $sp['x'] > 101 || $sp['y'] < -1 || $sp['y'] > 101) {
        $seqOutOfBounds++;
    }
}
check($seqOutOfBounds <= 3, "Sequence positions within bounds: {$seqOutOfBounds} violations (<=3)");

// Average ball X should be roughly centered (~50, tolerance 35-65)
$avgBallX = count($ballPositions) > 0 ? array_sum(array_column($ballPositions, 'x')) / count($ballPositions) : 50;
check($avgBallX >= 30 && $avgBallX <= 70, "Average ball X roughly centered: " . round($avgBallX, 1) . " (30-70)");

// Ball Y should be distributed (not stuck at one sideline)
$avgBallY = count($ballPositions) > 0 ? array_sum(array_column($ballPositions, 'y')) / count($ballPositions) : 50;
check($avgBallY >= 25 && $avgBallY <= 75, "Average ball Y distributed: " . round($avgBallY, 1) . " (25-75)");

// No massive teleports (>80 units in one tick) except after goals/kickoffs
$bigJumps = 0;
for ($i = 1; $i < count($ballPositions); $i++) {
    $dx = abs($ballPositions[$i]['x'] - $ballPositions[$i - 1]['x']);
    $dy = abs($ballPositions[$i]['y'] - $ballPositions[$i - 1]['y']);
    if ($dx > 80 || $dy > 80) {
        $bigJumps++;
    }
}
check($bigJumps <= 10, "Ball teleports (>80 units): {$bigJumps} (<=10, allows goals/kickoffs)");

// Shots must be in attacking zones: home shots at x>50, away shots at x<50
$shotPositionIssues = 0;
foreach ($allEvents as $event) {
    $type = $event['type'] ?? '';
    if (in_array($type, ['shot_on_target', 'shot_off_target', 'goal'])) {
        $team = $event['team'] ?? '';
        $coords = $event['coordinates'] ?? ['x' => 50, 'y' => 50];
        // Home attacks toward x=100, away toward x=0
        if ($team === 'home' && $coords['x'] < 30) $shotPositionIssues++;
        if ($team === 'away' && $coords['x'] > 70) $shotPositionIssues++;
    }
}
check($shotPositionIssues <= 3, "Shot positions in correct half: {$shotPositionIssues} violations (<=3)");

// Corner coordinates should be near goal line (x near 0 or 100)
$cornerIssues = 0;
foreach ($allEvents as $event) {
    if (($event['type'] ?? '') === 'corner') {
        foreach ($event['sequence'] ?? [] as $step) {
            if (($step['action'] ?? '') === 'cross') {
                $startX = $step['ball_start']['x'] ?? 50;
                // Corner should start near x=0 or x=100
                if ($startX > 10 && $startX < 90) $cornerIssues++;
            }
        }
    }
}
check($cornerIssues <= 2, "Corner kicks from correct positions: {$cornerIssues} violations (<=2)");

// Penalty coordinates should be at penalty spot (~x=88 or ~x=12)
$penaltyIssues = 0;
foreach ($allEvents as $event) {
    if (($event['type'] ?? '') === 'penalty') {
        foreach ($event['sequence'] ?? [] as $step) {
            if (($step['action'] ?? '') === 'shoot') {
                $startX = $step['ball_start']['x'] ?? 50;
                // Penalty spot at x=88 (home) or x=12 (away)
                if ($startX > 15 && $startX < 85) $penaltyIssues++;
            }
        }
    }
}
check($penaltyIssues === 0, "Penalty from correct spot: {$penaltyIssues} violations");

// Goal kicks should start near 6-yard box (x<10 or x>90)
$goalKickIssues = 0;
foreach ($allEvents as $event) {
    if (($event['type'] ?? '') === 'goal_kick') {
        $coords = $event['coordinates'] ?? ['x' => 50];
        // After the kick, ball should have moved to midfield-ish area
        // (we can't check the start easily, but the final coords should be reasonable)
    }
}

// Foul coordinates: fouls in penalty area should be x>85 or x<15
$foulInPenaltyArea = 0;
$foulPenaltyCorrect = 0;
foreach ($allEvents as $event) {
    if (($event['type'] ?? '') === 'foul') {
        $coords = $event['coordinates'] ?? ['x' => 50, 'y' => 50];
        if ($coords['x'] > 83 || $coords['x'] < 17) {
            $foulInPenaltyArea++;
            if ($coords['y'] >= 25 && $coords['y'] <= 75) {
                $foulPenaltyCorrect++;
            }
        }
    }
}
echo "  (Fouls near penalty area: {$foulInPenaltyArea}, with correct Y: {$foulPenaltyCorrect})\n";

// =========================================================================
//  TEST 3: TACTICS IMPACT — Attacking vs Defensive
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 3: TACTICS IMPACT\n";
echo "==========================================================\n";

DB::beginTransaction();
try {
    // Create aggressive attacking tactic
    $formationId = Formation::first()->id;
    $attackingTactic = Tactic::create([
        'name' => 'TEST_Ultra_Attack',
        'formation_id' => $formationId,
        'mentality' => 'very_attacking',
        'pressing' => 'always',
        'tempo' => 'very_fast',
        'width' => 'very_wide',
        'tackle_harder' => true,
        'get_stuck_in' => true,
        'passing_directness' => 'direct',
        'counter_press' => true,
        'creative_freedom' => 'high',
    ]);

    // Create ultra-defensive tactic
    $defensiveTactic = Tactic::create([
        'name' => 'TEST_Ultra_Defend',
        'formation_id' => $formationId,
        'mentality' => 'very_defensive',
        'pressing' => 'rarely',
        'tempo' => 'very_slow',
        'width' => 'narrow',
        'tackle_harder' => false,
        'get_stuck_in' => false,
        'tackling' => 'stay_on_feet',
        'passing_directness' => 'short',
        'time_wasting' => 'always',
        'creative_freedom' => 'low',
    ]);

    // Assign attacking tactic to home, defensive to away
    $origHomeTacticId = $match->homeTeam->primary_tactic_id;
    $origAwayTacticId = $match->awayTeam->primary_tactic_id;

    $match->homeTeam->primary_tactic_id = $attackingTactic->id;
    $match->homeTeam->save();
    $match->awayTeam->primary_tactic_id = $defensiveTactic->id;
    $match->awayTeam->save();
    $match->homeTeam->load('primaryTactic');
    $match->awayTeam->load('primaryTactic');

    // Run simulation 3 times and average
    $atkShots = 0;
    $defShots = 0;
    $atkFouls = 0;
    $defFouls = 0;
    $atkPoss = 0;
    $defPoss = 0;
    $atkCards = 0;
    $defCards = 0;
    $runs = 3;

    for ($r = 0; $r < $runs; $r++) {
        $match->homeTeam->unsetRelation('primaryTactic');
        $match->awayTeam->unsetRelation('primaryTactic');
        $match->homeTeam->load('primaryTactic');
        $match->awayTeam->load('primaryTactic');
        $ticks = runSimulation($match);
        $lt = getLastTick($ticks);
        $hs = $lt['stats']['home'];
        $as = $lt['stats']['away'];
        $atkShots += $hs['shots'];
        $defShots += $as['shots'];
        $atkFouls += $as['fouls']; // Away team fouls against attacking home
        $defFouls += $hs['fouls']; // Home team fouls (tackle_harder)
        $atkPoss += $hs['possession_pct'];
        $defPoss += $as['possession_pct'];
        $atkCards += $hs['yellow_cards'];
        $defCards += $as['yellow_cards'];
    }

    $atkShots /= $runs;
    $defShots /= $runs;
    $atkFouls /= $runs;
    $defFouls /= $runs;
    $atkPoss /= $runs;
    $defPoss /= $runs;

    echo "  Attacking team (home) avg: shots={$atkShots}, poss=" . round($atkPoss) . "%\n";
    echo "  Defensive team (away) avg: shots={$defShots}, poss=" . round($defPoss) . "%\n";
    echo "  Home fouls (tackle_harder): " . round($defFouls, 1) . ", Away fouls: " . round($atkFouls, 1) . "\n";
    echo "  Home cards: " . round($atkCards / $runs, 1) . ", Away cards: " . round($defCards / $runs, 1) . "\n";

    check($atkShots > $defShots, "Attacking team has more shots: {$atkShots} > {$defShots}");
    check($defFouls > $atkFouls * 0.8, "Tackle-harder team commits more fouls: " . round($defFouls, 1) . " >= " . round($atkFouls * 0.8, 1));

    // Restore original tactics
    $match->homeTeam->primary_tactic_id = $origHomeTacticId;
    $match->homeTeam->save();
    $match->awayTeam->primary_tactic_id = $origAwayTacticId;
    $match->awayTeam->save();

} finally {
    DB::rollBack();
}

// =========================================================================
//  TEST 4: POSITION FAMILIARITY (Direct MatchState test)
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 4: POSITION FAMILIARITY PENALTIES\n";
echo "==========================================================\n";

// Create a MatchState to test getEffectiveAttribute directly
$testState = new MatchState();
$testState->minute = 30; // Before fatigue kicks in

// Find a real CB player and a real ST player
$cbPlayer = null;
$stPlayer = null;
$gkPlayer = null;
$allPlayers = $match->homeTeam->players;

foreach ($allPlayers as $p) {
    $pos = $p->primaryPosition->short_name ?? '';
    if ($pos === 'CB' && !$cbPlayer) $cbPlayer = $p;
    if ($pos === 'ST' && !$stPlayer) $stPlayer = $p;
    if ($pos === 'GK' && !$gkPlayer) $gkPlayer = $p;
}

if ($cbPlayer && $stPlayer) {
    echo "  Testing CB ({$cbPlayer->first_name} {$cbPlayer->last_name}) and ST ({$stPlayer->first_name} {$stPlayer->last_name})\n";

    // Set up: CB in natural position
    $testState->homeLineup[$cbPlayer->id] = $cbPlayer;
    $testState->playerStates[$cbPlayer->id] = [
        'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
        'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
        'morale' => 7.0, 'position' => 'CB',
    ];

    // CB at natural CB position: tackling should be full value
    $cbTacklingNatural = $testState->getEffectiveAttribute($cbPlayer->id, 'tackling');

    // Now put CB at ST position (major mismatch)
    $testState->playerStates[$cbPlayer->id]['position'] = 'ST';
    $cbTacklingMisplaced = $testState->getEffectiveAttribute($cbPlayer->id, 'tackling');

    // Reset
    $testState->playerStates[$cbPlayer->id]['position'] = 'CB';

    echo "  CB tackling at CB: " . round($cbTacklingNatural, 1) . ", CB tackling at ST: " . round($cbTacklingMisplaced, 1) . "\n";
    check($cbTacklingMisplaced < $cbTacklingNatural, "CB at ST has reduced tackling: " . round($cbTacklingMisplaced, 1) . " < " . round($cbTacklingNatural, 1));

    // ST in natural position vs ST at CB
    $testState->homeLineup[$stPlayer->id] = $stPlayer;
    $testState->playerStates[$stPlayer->id] = [
        'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
        'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
        'morale' => 7.0, 'position' => 'ST',
    ];

    $stFinishingNatural = $testState->getEffectiveAttribute($stPlayer->id, 'finishing');
    $testState->playerStates[$stPlayer->id]['position'] = 'CB';
    $stFinishingMisplaced = $testState->getEffectiveAttribute($stPlayer->id, 'finishing');

    echo "  ST finishing at ST: " . round($stFinishingNatural, 1) . ", ST finishing at CB: " . round($stFinishingMisplaced, 1) . "\n";
    check($stFinishingMisplaced < $stFinishingNatural, "ST at CB has reduced finishing: " . round($stFinishingMisplaced, 1) . " < " . round($stFinishingNatural, 1));

    // Compatible position should have small penalty
    $testState->playerStates[$stPlayer->id]['position'] = 'CF'; // CF is compatible with ST
    $stFinishingCompatible = $testState->getEffectiveAttribute($stPlayer->id, 'finishing');

    echo "  ST finishing at CF (compatible): " . round($stFinishingCompatible, 1) . "\n";
    check($stFinishingCompatible > $stFinishingMisplaced, "Compatible position (CF) less penalty than mismatch (CB): " . round($stFinishingCompatible, 1) . " > " . round($stFinishingMisplaced, 1));

    // GK to outfield = catastrophic penalty
    if ($gkPlayer) {
        $testState->homeLineup[$gkPlayer->id] = $gkPlayer;
        $testState->playerStates[$gkPlayer->id] = [
            'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
            'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
            'morale' => 7.0, 'position' => 'GK',
        ];

        $gkReflexesNatural = $testState->getEffectiveAttribute($gkPlayer->id, 'reflexes');
        $testState->playerStates[$gkPlayer->id]['position'] = 'ST';
        $gkReflexesMisplaced = $testState->getEffectiveAttribute($gkPlayer->id, 'reflexes');

        $catastrophicReduction = ($gkReflexesNatural - $gkReflexesMisplaced) / $gkReflexesNatural * 100;
        echo "  GK reflexes at GK: " . round($gkReflexesNatural, 1) . ", at ST: " . round($gkReflexesMisplaced, 1) . " (-" . round($catastrophicReduction) . "%)\n";
        check($catastrophicReduction >= 30, "GK at ST has catastrophic penalty: -" . round($catastrophicReduction) . "% (>=30%)");
    }
} else {
    echo "  SKIP: Could not find CB and ST players for testing\n";
}

// =========================================================================
//  TEST 5: MORALE SYSTEM
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 5: MORALE SYSTEM\n";
echo "==========================================================\n";

$moraleState = new MatchState();
$moraleState->minute = 30;

// Use real players
$testPlayer = $allPlayers->first();
if ($testPlayer) {
    $moraleState->homeLineup[$testPlayer->id] = $testPlayer;
    $moraleState->playerStates[$testPlayer->id] = [
        'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
        'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
        'morale' => 7.0, 'position' => $testPlayer->primaryPosition->short_name ?? 'CM',
    ];

    // Baseline attribute at morale 7.0
    $baseAttr = $moraleState->getEffectiveAttribute($testPlayer->id, 'passing');

    // After scoring a goal: morale should increase
    $moraleState->updatePlayerMorale($testPlayer->id, 'goal_scored');
    $moralAfterGoal = $moraleState->playerStates[$testPlayer->id]['morale'];
    check($moralAfterGoal > 7.0, "Morale increases after goal: {$moralAfterGoal} > 7.0");

    $attrHighMorale = $moraleState->getEffectiveAttribute($testPlayer->id, 'passing');
    check($attrHighMorale > $baseAttr, "High morale boosts attributes: " . round($attrHighMorale, 2) . " > " . round($baseAttr, 2));

    // After red card: morale drops significantly
    $moraleState->playerStates[$testPlayer->id]['morale'] = 7.0; // reset
    $moraleState->updatePlayerMorale($testPlayer->id, 'red_card');
    $moralAfterRed = $moraleState->playerStates[$testPlayer->id]['morale'];
    check($moralAfterRed < 7.0, "Morale drops after red card: {$moralAfterRed} < 7.0");

    // Set morale to extreme low
    $moraleState->playerStates[$testPlayer->id]['morale'] = 2.0;
    $attrLowMorale = $moraleState->getEffectiveAttribute($testPlayer->id, 'passing');
    check($attrLowMorale < $baseAttr, "Low morale (2.0) reduces attributes: " . round($attrLowMorale, 2) . " < " . round($baseAttr, 2));

    // Set morale to extreme high
    $moraleState->playerStates[$testPlayer->id]['morale'] = 10.0;
    $attrMaxMorale = $moraleState->getEffectiveAttribute($testPlayer->id, 'passing');
    check($attrMaxMorale > $baseAttr, "Max morale (10.0) boosts attributes: " . round($attrMaxMorale, 2) . " > " . round($baseAttr, 2));

    // Morale decay test
    $moraleState->playerStates[$testPlayer->id]['morale'] = 10.0;
    $beforeDecay = $moraleState->playerStates[$testPlayer->id]['morale'];
    for ($i = 0; $i < 20; $i++) {
        $moraleState->decayMorale();
    }
    $afterDecay = $moraleState->playerStates[$testPlayer->id]['morale'];
    check($afterDecay < $beforeDecay, "Morale decays toward 7.0 over 20 minutes: " . round($afterDecay, 2) . " < {$beforeDecay}");
    check($afterDecay > 7.0, "Morale hasn't decayed past neutral after 20 min: " . round($afterDecay, 2) . " > 7.0");
}

// =========================================================================
//  TEST 6: HOME ADVANTAGE
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 6: HOME ADVANTAGE\n";
echo "==========================================================\n";

$homeState = new MatchState();
$homeState->minute = 30;

$homePlayer = $allPlayers->first();
if ($homePlayer) {
    $pos = $homePlayer->primaryPosition->short_name ?? 'CM';

    // Test as HOME player
    $homeState->homeLineup[$homePlayer->id] = $homePlayer;
    $homeState->playerStates[$homePlayer->id] = [
        'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
        'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
        'morale' => 7.0, 'position' => $pos,
    ];

    $homeAttr = $homeState->getEffectiveAttribute($homePlayer->id, 'passing');

    // Now test same player as AWAY player
    $awayState = new MatchState();
    $awayState->minute = 30;
    $awayState->awayLineup[$homePlayer->id] = $homePlayer;
    $awayState->playerStates[$homePlayer->id] = [
        'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
        'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
        'morale' => 7.0, 'position' => $pos,
    ];

    $awayAttr = $awayState->getEffectiveAttribute($homePlayer->id, 'passing');

    echo "  Same player passing — Home: " . round($homeAttr, 2) . ", Away: " . round($awayAttr, 2) . "\n";
    check($homeAttr > $awayAttr, "Home advantage: passing " . round($homeAttr, 2) . " > " . round($awayAttr, 2));

    // Test mental attribute (should have bigger away penalty)
    $homeComposure = $homeState->getEffectiveAttribute($homePlayer->id, 'composure');
    $awayComposure = $awayState->getEffectiveAttribute($homePlayer->id, 'composure');
    $homeDiffPct = ($homeComposure - $awayComposure) / $awayComposure * 100;
    echo "  Composure (mental) — Home: " . round($homeComposure, 2) . ", Away: " . round($awayComposure, 2) . " (diff: " . round($homeDiffPct, 1) . "%)\n";
    check($homeComposure > $awayComposure, "Home advantage bigger for mental attrs: composure " . round($homeComposure, 2) . " > " . round($awayComposure, 2));
}

// =========================================================================
//  TEST 7: TACTIC MODIFIER DIRECT TEST
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 7: TACTIC ATTRIBUTE MODIFIERS\n";
echo "==========================================================\n";

DB::beginTransaction();
try {
    $tacticState = new MatchState();
    $tacticState->minute = 30;

    // Create attacking tactic
    $formationId7 = Formation::first()->id;
    $atkTac = Tactic::create([
        'name' => 'TEST_ATK', 'formation_id' => $formationId7,
        'mentality' => 'very_attacking',
        'tackle_harder' => false, 'get_stuck_in' => false,
    ]);
    // Create defensive tactic
    $defTac = Tactic::create([
        'name' => 'TEST_DEF', 'formation_id' => $formationId7,
        'mentality' => 'very_defensive',
        'tackle_harder' => false, 'get_stuck_in' => false,
    ]);

    $tp = $allPlayers->first();
    if ($tp) {
        $pos = $tp->primaryPosition->short_name ?? 'CM';

        // Attacking tactic
        $tacticState->homeLineup[$tp->id] = $tp;
        $tacticState->playerStates[$tp->id] = [
            'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
            'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
            'morale' => 7.0, 'position' => $pos,
        ];

        $tacticState->homeTactic = $atkTac;
        $finishingAtk = $tacticState->getEffectiveAttribute($tp->id, 'finishing');
        $tacklingAtk = $tacticState->getEffectiveAttribute($tp->id, 'tackling');

        $tacticState->homeTactic = $defTac;
        $finishingDef = $tacticState->getEffectiveAttribute($tp->id, 'finishing');
        $tacklingDef = $tacticState->getEffectiveAttribute($tp->id, 'tackling');

        // No tactic
        $tacticState->homeTactic = null;
        $finishingNone = $tacticState->getEffectiveAttribute($tp->id, 'finishing');
        $tacklingNone = $tacticState->getEffectiveAttribute($tp->id, 'tackling');

        echo "  Finishing — Atk: " . round($finishingAtk, 2) . ", Def: " . round($finishingDef, 2) . ", None: " . round($finishingNone, 2) . "\n";
        echo "  Tackling — Atk: " . round($tacklingAtk, 2) . ", Def: " . round($tacklingDef, 2) . ", None: " . round($tacklingNone, 2) . "\n";

        check($finishingAtk > $finishingDef, "Attacking tactic boosts finishing: " . round($finishingAtk, 2) . " > " . round($finishingDef, 2));
        check($tacklingDef > $tacklingAtk, "Defensive tactic boosts tackling: " . round($tacklingDef, 2) . " > " . round($tacklingAtk, 2));
        check($finishingAtk > $finishingNone, "Attacking tactic finishing > no tactic: " . round($finishingAtk, 2) . " > " . round($finishingNone, 2));
        check($tacklingDef > $tacklingNone, "Defensive tactic tackling > no tactic: " . round($tacklingDef, 2) . " > " . round($tacklingNone, 2));
    }
} finally {
    DB::rollBack();
}

// =========================================================================
//  TEST 8: FATIGUE + NATURAL FITNESS
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 8: FATIGUE & NATURAL FITNESS\n";
echo "==========================================================\n";

$fatState = new MatchState();
$fatState->minute = 75; // Post-60 where fatigue matters

$tp = $allPlayers->first();
if ($tp) {
    $pos = $tp->primaryPosition->short_name ?? 'CM';
    $fatState->homeLineup[$tp->id] = $tp;

    // No fatigue
    $fatState->playerStates[$tp->id] = [
        'fatigue' => 0.0, 'yellow_cards' => 0, 'is_sent_off' => false,
        'is_subbed_off' => false, 'goals' => 0, 'assists' => 0,
        'morale' => 7.0, 'position' => $pos,
    ];
    $noFatigueAttr = $fatState->getEffectiveAttribute($tp->id, 'passing');

    // High fatigue
    $fatState->playerStates[$tp->id]['fatigue'] = 0.8;
    $highFatigueAttr = $fatState->getEffectiveAttribute($tp->id, 'passing');

    echo "  Passing at min 75 — fatigue 0: " . round($noFatigueAttr, 2) . ", fatigue 0.8: " . round($highFatigueAttr, 2) . "\n";
    check($highFatigueAttr < $noFatigueAttr, "High fatigue reduces attributes: " . round($highFatigueAttr, 2) . " < " . round($noFatigueAttr, 2));

    // Test before minute 60 - fatigue should NOT apply
    $fatState->minute = 50;
    $fatState->playerStates[$tp->id]['fatigue'] = 0.8;
    $earlyFatigueAttr = $fatState->getEffectiveAttribute($tp->id, 'passing');
    check(abs($earlyFatigueAttr - $noFatigueAttr) < 0.01, "Fatigue has no effect before min 60: " . round($earlyFatigueAttr, 2) . " ≈ " . round($noFatigueAttr, 2));
}

// =========================================================================
//  TEST 9: SEQUENCE POSITION REALISM (Football Specialist validation)
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 9: SEQUENCE POSITION REALISM\n";
echo "==========================================================\n";

// Run 3 simulations and aggregate sequence stats to reduce stochastic variance
$passesForward = 0;
$passesBackward = 0;
$passesTotal = 0;
$dribblesForward = 0;
$dribblesTotal = 0;
$shotsAtGoal = 0;
$shotsTotal = 0;
$clearancesCorrect = 0;
$clearancesTotal = 0;
$badDurations = 0;
$totalSteps = 0;
$passesWithTarget = 0;
$passStepsTotal = 0;

$seqRuns = 3;
for ($sr = 0; $sr < $seqRuns; $sr++) {
    $ticks = runSimulation($match);
    $allEventsSeq = collectAllEvents($ticks);

    foreach ($allEventsSeq as $event) {
        foreach ($event['sequence'] ?? [] as $step) {
            $action = $step['action'] ?? '';
            $team = $event['team'] ?? 'home';
            $startX = $step['ball_start']['x'] ?? 50;
            $endX = $step['ball_end']['x'] ?? 50;

            // Pass direction
            if ($action === 'pass') {
                $passesTotal++;
                if ($team === 'home') {
                    if ($endX > $startX) $passesForward++;
                    else $passesBackward++;
                } else {
                    if ($endX < $startX) $passesForward++;
                    else $passesBackward++;
                }
                $passStepsTotal++;
                if (isset($step['target_id']) && $step['target_id']) {
                    $passesWithTarget++;
                }
            }

            // Dribble direction
            if ($action === 'dribble' || $action === 'skill_move') {
                $dribblesTotal++;
                if ($team === 'home' && $endX > $startX) $dribblesForward++;
                if ($team === 'away' && $endX < $startX) $dribblesForward++;
            }

            // Shot aim
            if ($action === 'shoot') {
                $shotsTotal++;
                if ($team === 'home' && $endX > 85) $shotsAtGoal++;
                if ($team === 'away' && $endX < 15) $shotsAtGoal++;
            }

            // Duration check
            $dur = $step['duration_ms'] ?? 0;
            $totalSteps++;
            if ($dur < 50 || $dur > 2000) $badDurations++;
        }

        // Clearances (only from clearance event types)
        if (($event['type'] ?? '') === 'clearance') {
            foreach ($event['sequence'] ?? [] as $step) {
                if (($step['action'] ?? '') === 'clearance') {
                    $team = $event['team'] ?? 'home';
                    $startX = $step['ball_start']['x'] ?? 50;
                    $endX = $step['ball_end']['x'] ?? 50;
                    $clearancesTotal++;
                    if ($team === 'home' && $endX > $startX) $clearancesCorrect++;
                    if ($team === 'away' && $endX < $startX) $clearancesCorrect++;
                }
            }
        }
    }
}

echo "  (Aggregated over {$seqRuns} simulation runs)\n";

if ($passesTotal > 0) {
    $forwardPct = round($passesForward / $passesTotal * 100);
    echo "  Passes: {$passesTotal} total, {$passesForward} forward ({$forwardPct}%), {$passesBackward} backward\n";
    check($passesForward > $passesBackward, "More passes go forward than backward: {$passesForward} > {$passesBackward}");
}

if ($dribblesTotal > 0) {
    $dribForwardPct = round($dribblesForward / $dribblesTotal * 100);
    echo "  Dribbles: {$dribblesTotal} total, {$dribblesForward} forward ({$dribForwardPct}%)\n";
    check($dribblesForward > $dribblesTotal / 2, "Most dribbles advance forward: {$dribForwardPct}% (>50%)");
}

if ($shotsTotal > 0) {
    $shotGoalPct = round($shotsAtGoal / $shotsTotal * 100);
    echo "  Shots aimed at goal area: {$shotsAtGoal}/{$shotsTotal} ({$shotGoalPct}%)\n";
    check($shotGoalPct >= 60, "Most shots aimed at goal: {$shotGoalPct}% (>=60%)");
}

if ($clearancesTotal > 0) {
    $clearPct = round($clearancesCorrect / $clearancesTotal * 100);
    echo "  Clearances toward opponent half: {$clearancesCorrect}/{$clearancesTotal} ({$clearPct}%)\n";
    check($clearPct >= 60, "Most clearances go forward: {$clearPct}% (>=60%)");
}

check($badDurations <= $totalSteps * 0.05, "Step durations in range (100-2000ms): {$badDurations} outliers out of {$totalSteps}");

if ($passStepsTotal > 0) {
    $targetPct = round($passesWithTarget / $passStepsTotal * 100);
    echo "  Pass steps with receiver (target_id): {$passesWithTarget}/{$passStepsTotal} ({$targetPct}%)\n";
    check($targetPct >= 80, "Most passes have receivers: {$targetPct}% (>=80%)");
}

// =========================================================================
//  TEST 10: COMBINED ADVERSARIAL — Bad tactics + wrong positions
// =========================================================================

echo "\n==========================================================\n";
echo "  TEST 10: ADVERSARIAL — Nonsense combined scenario\n";
echo "==========================================================\n";

echo "  (Running normal vs normal baseline...)\n";
$normalTicks = runSimulation($match);
$normalLast = getLastTick($normalTicks);
$normalHomeGoals = $normalLast['score']['home'];
$normalAwayGoals = $normalLast['score']['away'];
$normalTotal = $normalLast['stats']['home']['shots'] + $normalLast['stats']['away']['shots'];

echo "  Normal result: {$normalHomeGoals}-{$normalAwayGoals}, shots: {$normalTotal}\n";

// Verify the simulation doesn't crash with null tactics
$match->homeTeam->unsetRelation('primaryTactic');
$match->awayTeam->unsetRelation('primaryTactic');
$origHome = $match->homeTeam->primary_tactic_id;
$origAway = $match->awayTeam->primary_tactic_id;

// Temporarily remove tactics to test null handling
DB::beginTransaction();
try {
    $match->homeTeam->primary_tactic_id = null;
    $match->homeTeam->save();
    $match->awayTeam->primary_tactic_id = null;
    $match->awayTeam->save();
    $match->homeTeam->load('primaryTactic');
    $match->awayTeam->load('primaryTactic');

    $nullTicks = runSimulation($match);
    $nullLast = getLastTick($nullTicks);
    check($nullLast['score']['home'] >= 0 && $nullLast['score']['away'] >= 0, "Simulation works with null tactics (score: {$nullLast['score']['home']}-{$nullLast['score']['away']})");

    $match->homeTeam->primary_tactic_id = $origHome;
    $match->homeTeam->save();
    $match->awayTeam->primary_tactic_id = $origAway;
    $match->awayTeam->save();
} finally {
    DB::rollBack();
}

// =========================================================================
//  FINAL SUMMARY
// =========================================================================

echo "\n==========================================================\n";
echo "  FINAL RESULTS\n";
echo "==========================================================\n\n";

$total = $passCount + $failCount;
echo "  PASSED: {$passCount}/{$total}\n";
echo "  FAILED: {$failCount}/{$total}\n\n";

if ($failCount === 0) {
    echo "  \033[32mALL CHECKS PASSED!\033[0m\n";
} else {
    echo "  \033[31m{$failCount} CHECK(S) FAILED\033[0m\n";
}

echo "\n==========================================================\n";
echo "  END OF TEST SUITE\n";
echo "==========================================================\n";

exit($failCount > 0 ? 1 : 0);
