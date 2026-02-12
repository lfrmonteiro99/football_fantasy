<?php
/**
 * Simulation Animation Metadata Test Suite
 *
 * Validates that the simulation engine produces correct animation metadata:
 * - ball_height on sequence steps
 * - intensity on sequence steps
 * - player_fatigue in tick output
 * - Sequence step structure integrity
 *
 * Usage: php api/tests/SimulationAnimationTest.php
 */

require_once __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\GameMatch;
use App\Services\Simulation\SimulationEngine;
use App\Services\Simulation\MatchState;

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

function collectAllSequenceSteps(array $ticks): array
{
    $steps = [];
    foreach ($ticks as $tick) {
        foreach ($tick['events'] ?? [] as $event) {
            foreach ($event['sequence'] ?? [] as $step) {
                $steps[] = $step;
            }
        }
    }
    return $steps;
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

echo "==========================================================\n";
echo "  SIMULATION ANIMATION METADATA TEST SUITE\n";
echo "==========================================================\n\n";

// Find base match
$match = GameMatch::with([
    'homeTeam.players.attributes',
    'homeTeam.players.primaryPosition',
    'homeTeam.primaryTactic',
    'awayTeam.players.attributes',
    'awayTeam.players.primaryPosition',
    'awayTeam.primaryTactic',
])->first();

if (!$match) {
    echo "\033[31mNo match found in database. Run seeders first.\033[0m\n";
    exit(1);
}

// =========================================================================
//  TEST 1: SEQUENCE STEP STRUCTURE
// =========================================================================

echo "\n--- TEST 1: Sequence Step Structure ---\n";

$ticks = runSimulation($match);
$steps = collectAllSequenceSteps($ticks);

check(count($steps) > 0, 'Simulation produces sequence steps (count=' . count($steps) . ')');

// Check all steps have required fields
$requiredFields = ['action', 'actor_id', 'actor_name', 'ball_start', 'ball_end', 'duration_ms'];
$missingFields = [];
foreach ($steps as $idx => $step) {
    foreach ($requiredFields as $field) {
        if (!isset($step[$field])) {
            $missingFields[] = "Step {$idx} missing {$field}";
        }
    }
}
check(empty($missingFields), 'All steps have required fields (' . count($missingFields) . ' missing)');

// =========================================================================
//  TEST 2: ball_height METADATA
// =========================================================================

echo "\n--- TEST 2: ball_height Metadata ---\n";

$validHeights = ['ground', 'low', 'high', 'lofted'];
$stepsWithHeight = 0;
$invalidHeights = [];

foreach ($steps as $step) {
    if (isset($step['ball_height'])) {
        $stepsWithHeight++;
        if (!in_array($step['ball_height'], $validHeights)) {
            $invalidHeights[] = $step['ball_height'];
        }
    }
}

check($stepsWithHeight > 0, "Steps have ball_height metadata (count={$stepsWithHeight}/" . count($steps) . ')');
check(empty($invalidHeights), 'All ball_height values are valid (' . count($invalidHeights) . ' invalid)');

// Check that crosses/clearances are marked 'high'
$crossSteps = array_filter($steps, fn($s) => $s['action'] === 'cross');
$clearanceSteps = array_filter($steps, fn($s) => $s['action'] === 'clearance');
$highCrosses = array_filter($crossSteps, fn($s) => ($s['ball_height'] ?? '') === 'high');
$highClearances = array_filter($clearanceSteps, fn($s) => ($s['ball_height'] ?? '') === 'high');

if (count($crossSteps) > 0) {
    check(
        count($highCrosses) === count($crossSteps),
        'All crosses marked as high (' . count($highCrosses) . '/' . count($crossSteps) . ')'
    );
}

if (count($clearanceSteps) > 0) {
    check(
        count($highClearances) === count($clearanceSteps),
        'All clearances marked as high (' . count($highClearances) . '/' . count($clearanceSteps) . ')'
    );
}

// Check that short passes are ground
$passSteps = array_filter($steps, fn($s) => $s['action'] === 'pass');
$shortGroundPasses = 0;
$shortPasses = 0;
foreach ($passSteps as $step) {
    $d = sqrt(
        pow(($step['ball_end']['x'] ?? 0) - ($step['ball_start']['x'] ?? 0), 2) +
        pow(($step['ball_end']['y'] ?? 0) - ($step['ball_start']['y'] ?? 0), 2)
    );
    if ($d <= 25) {
        $shortPasses++;
        if (($step['ball_height'] ?? '') === 'ground') {
            $shortGroundPasses++;
        }
    }
}

if ($shortPasses > 0) {
    check(
        $shortGroundPasses === $shortPasses,
        "Short passes (d<=25) marked as ground ({$shortGroundPasses}/{$shortPasses})"
    );
}

// Shots should be 'low'
$shootSteps = array_filter($steps, fn($s) => $s['action'] === 'shoot');
$lowShots = array_filter($shootSteps, fn($s) => ($s['ball_height'] ?? '') === 'low');
if (count($shootSteps) > 0) {
    check(
        count($lowShots) === count($shootSteps),
        'All shots marked as low (' . count($lowShots) . '/' . count($shootSteps) . ')'
    );
}

// =========================================================================
//  TEST 3: intensity METADATA
// =========================================================================

echo "\n--- TEST 3: intensity Metadata ---\n";

$validIntensities = ['soft', 'normal', 'hard'];
$stepsWithIntensity = 0;
$invalidIntensities = [];

foreach ($steps as $step) {
    if (isset($step['intensity'])) {
        $stepsWithIntensity++;
        if (!in_array($step['intensity'], $validIntensities)) {
            $invalidIntensities[] = $step['intensity'];
        }
    }
}

check($stepsWithIntensity > 0, "Steps have intensity metadata (count={$stepsWithIntensity}/" . count($steps) . ')');
check(empty($invalidIntensities), 'All intensity values are valid (' . count($invalidIntensities) . ' invalid)');

// Shots should be 'hard'
$hardShots = array_filter($shootSteps, fn($s) => ($s['intensity'] ?? '') === 'hard');
if (count($shootSteps) > 0) {
    check(
        count($hardShots) === count($shootSteps),
        'All shots have hard intensity (' . count($hardShots) . '/' . count($shootSteps) . ')'
    );
}

// Dribbles should be 'soft'
$dribbleSteps = array_filter($steps, fn($s) => $s['action'] === 'dribble');
$softDribbles = array_filter($dribbleSteps, fn($s) => ($s['intensity'] ?? '') === 'soft');
if (count($dribbleSteps) > 0) {
    check(
        count($softDribbles) === count($dribbleSteps),
        'All dribbles have soft intensity (' . count($softDribbles) . '/' . count($dribbleSteps) . ')'
    );
}

// =========================================================================
//  TEST 4: player_fatigue IN TICK OUTPUT
// =========================================================================

echo "\n--- TEST 4: player_fatigue in Tick Output ---\n";

$ticksWithFatigue = array_filter($ticks, fn($t) => isset($t['player_fatigue']) && !empty($t['player_fatigue']));

check(count($ticksWithFatigue) > 0, 'Ticks include player_fatigue data (count=' . count($ticksWithFatigue) . '/' . count($ticks) . ')');

// Check fatigue increases over the match
if (count($ticks) > 2) {
    $firstTick = $ticks[1]; // minute 1
    $lastTick = end($ticks);

    $firstFatigue = $firstTick['player_fatigue'] ?? [];
    $lastFatigue = $lastTick['player_fatigue'] ?? [];

    if (!empty($firstFatigue) && !empty($lastFatigue)) {
        $firstPlayerId = array_key_first($firstFatigue);
        $firstVal = $firstFatigue[$firstPlayerId] ?? 0;
        $lastVal = $lastFatigue[$firstPlayerId] ?? 0;

        check(
            $lastVal > $firstVal,
            "Fatigue increases over match (minute 1: {$firstVal}, final: {$lastVal})"
        );
    }

    // Fatigue values should be 0-100 range
    $validFatigueRange = true;
    foreach ($lastFatigue as $playerId => $fatigue) {
        if ($fatigue < 0 || $fatigue > 100) {
            $validFatigueRange = false;
            break;
        }
    }
    check($validFatigueRange, 'All fatigue values in 0-100 range');
}

// =========================================================================
//  TEST 5: SEQUENCE STEP COORDINATE BOUNDS
// =========================================================================

echo "\n--- TEST 5: Sequence Step Coordinate Bounds ---\n";

$outOfBounds = 0;
foreach ($steps as $step) {
    foreach (['ball_start', 'ball_end'] as $field) {
        if (isset($step[$field])) {
            $x = $step[$field]['x'] ?? 0;
            $y = $step[$field]['y'] ?? 0;
            if ($x < 0 || $x > 100 || $y < 0 || $y > 100) {
                $outOfBounds++;
            }
        }
    }
}

check($outOfBounds === 0, "All ball coordinates within 0-100 bounds (out-of-bounds: {$outOfBounds})");

// =========================================================================
//  TEST 6: ACTION TYPE VARIETY
// =========================================================================

echo "\n--- TEST 6: Action Type Variety ---\n";

$actionTypes = [];
foreach ($steps as $step) {
    $action = $step['action'] ?? 'unknown';
    $actionTypes[$action] = ($actionTypes[$action] ?? 0) + 1;
}

echo "  Action distribution:\n";
foreach ($actionTypes as $action => $count) {
    echo "    {$action}: {$count}\n";
}

$expectedActions = ['pass', 'shoot', 'dribble', 'tackle'];
foreach ($expectedActions as $action) {
    check(
        isset($actionTypes[$action]) && $actionTypes[$action] > 0,
        "Action type '{$action}' appears in simulation ({$actionTypes[$action]} times)"
    );
}

// =========================================================================
//  TEST 7: TICK STRUCTURE COMPLETENESS
// =========================================================================

echo "\n--- TEST 7: Tick Structure Completeness ---\n";

$requiredTickFields = ['minute', 'phase', 'possession', 'zone', 'ball', 'events', 'score', 'stats', 'commentary', 'player_fatigue'];
$missingTickFields = [];

foreach ($ticks as $idx => $tick) {
    foreach ($requiredTickFields as $field) {
        if (!array_key_exists($field, $tick)) {
            $missingTickFields[] = "Tick {$idx} (minute {$tick['minute']}) missing '{$field}'";
        }
    }
}

check(
    empty($missingTickFields),
    'All ticks have required fields including player_fatigue (' . count($missingTickFields) . ' missing)'
);

// =========================================================================
//  SUMMARY
// =========================================================================

echo "\n==========================================================\n";
echo "  RESULTS: {$passCount} passed, {$failCount} failed out of {$totalChecks} checks\n";
echo "==========================================================\n\n";

if ($failCount > 0) {
    echo "\033[31mSOME TESTS FAILED\033[0m\n";
    exit(1);
} else {
    echo "\033[32mALL TESTS PASSED\033[0m\n";
    exit(0);
}
