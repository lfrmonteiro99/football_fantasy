<?php
/**
 * Simulation Analysis Script
 *
 * Runs the SimulationEngine against a real match from the database,
 * collects all ticks, and produces a detailed analysis report covering:
 * - Event frequency and distribution
 * - Possession flow and continuity
 * - Ball position realism
 * - Sequence data completeness
 * - Player involvement
 * - Match stat totals vs real-world expectations
 *
 * Usage: php tests/SimulationAnalysis.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

// Boot Laravel
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\GameMatch;
use App\Models\Team;
use App\Models\Formation;
use App\Services\Simulation\SimulationEngine;

echo "==========================================================\n";
echo "  SIMULATION ENGINE ANALYSIS REPORT\n";
echo "==========================================================\n\n";

// Find a match to simulate
$match = GameMatch::with([
    'homeTeam.players.attributes',
    'homeTeam.players.primaryPosition',
    'awayTeam.players.attributes',
    'awayTeam.players.primaryPosition',
    'homeFormation',
    'awayFormation',
])->first();

if (!$match) {
    echo "ERROR: No match found in database. Run seeders first.\n";
    exit(1);
}

// Ensure formations exist
if (!$match->homeFormation) {
    $formation = Formation::first();
    if ($formation) {
        $match->home_formation_id = $formation->id;
        $match->away_formation_id = $formation->id;
        $match->save();
        $match->load(['homeFormation', 'awayFormation']);
    }
}

echo "Match: {$match->homeTeam->name} vs {$match->awayTeam->name}\n";
echo "Formation: " . ($match->homeFormation->name ?? 'N/A') . " vs " . ($match->awayFormation->name ?? 'N/A') . "\n\n";

// Run simulation
$engine = new SimulationEngine();
$ticks = [];
$allEvents = [];
$allSequenceSteps = [];
$eventsByType = [];
$minutesWithEvents = 0;
$minutesWithoutEvents = 0;
$possessionChanges = 0;
$lastPossession = null;
$consecutivePossession = ['home' => 0, 'away' => 0, 'max_home' => 0, 'max_away' => 0];
$ballPositions = [];
$playerInvolvement = [];

echo "Running simulation...\n";
$startTime = microtime(true);

foreach ($engine->simulate($match) as $tick) {
    $ticks[] = $tick;
    $minute = $tick['minute'];
    $events = $tick['events'] ?? [];

    // Track ball position
    if (isset($tick['ball'])) {
        $ballPositions[] = ['minute' => $minute, 'x' => $tick['ball']['x'], 'y' => $tick['ball']['y']];
    }

    // Track possession changes
    $poss = $tick['possession'] ?? null;
    if ($poss && $poss !== $lastPossession) {
        $possessionChanges++;
        if ($lastPossession) {
            $consecutivePossession[$lastPossession] = 0;
        }
    }
    if ($poss) {
        $consecutivePossession[$poss]++;
        $consecutivePossession["max_{$poss}"] = max(
            $consecutivePossession["max_{$poss}"],
            $consecutivePossession[$poss]
        );
    }
    $lastPossession = $poss;

    // Track events
    if (!empty($events)) {
        $minutesWithEvents++;
        foreach ($events as $event) {
            $type = $event['type'] ?? 'unknown';
            $allEvents[] = $event;
            $eventsByType[$type] = ($eventsByType[$type] ?? 0) + 1;

            // Track player involvement
            if (isset($event['primary_player_id'])) {
                $pid = $event['primary_player_id'];
                $playerInvolvement[$pid] = ($playerInvolvement[$pid] ?? 0) + 1;
            }
            if (isset($event['secondary_player_id']) && $event['secondary_player_id']) {
                $sid = $event['secondary_player_id'];
                $playerInvolvement[$sid] = ($playerInvolvement[$sid] ?? 0) + 1;
            }

            // Track sequence steps
            $seq = $event['sequence'] ?? [];
            foreach ($seq as $step) {
                $allSequenceSteps[] = $step;
            }
        }
    } else {
        $minutesWithoutEvents++;
    }
}

$elapsed = round((microtime(true) - $startTime) * 1000);
$lastTick = end($ticks);

echo "Simulation completed in {$elapsed}ms\n";
echo "Total ticks: " . count($ticks) . "\n\n";

// ===================== SCORE & FINAL STATS =====================
echo "==========================================================\n";
echo "  1. FINAL SCORE & STATS\n";
echo "==========================================================\n";
echo "Score: {$lastTick['score']['home']} - {$lastTick['score']['away']}\n";
echo "\n";

$homeStats = $lastTick['stats']['home'];
$awayStats = $lastTick['stats']['away'];

$statLabels = [
    'possession_pct' => 'Possession %',
    'shots' => 'Shots',
    'shots_on_target' => 'Shots on Target',
    'corners' => 'Corners',
    'fouls' => 'Fouls',
    'yellow_cards' => 'Yellow Cards',
    'red_cards' => 'Red Cards',
    'saves' => 'Saves',
    'passes' => 'Passes',
    'tackles' => 'Tackles',
    'offsides' => 'Offsides',
];

printf("%-20s %8s %8s   %s\n", 'Stat', 'Home', 'Away', 'Real Range');
echo str_repeat('-', 70) . "\n";

$realRanges = [
    'possession_pct' => '40-60%',
    'shots' => '10-18',
    'shots_on_target' => '3-8',
    'corners' => '3-8',
    'fouls' => '8-15',
    'yellow_cards' => '0-4',
    'red_cards' => '0-1',
    'saves' => '2-6',
    'passes' => '300-600',
    'tackles' => '15-30',
    'offsides' => '1-4',
];

foreach ($statLabels as $key => $label) {
    $home = $homeStats[$key] ?? 0;
    $away = $awayStats[$key] ?? 0;
    $range = $realRanges[$key] ?? '?';
    $total = $home + $away;

    // Flag if way outside range
    $flag = '';
    if ($key === 'passes' && $total < 400) $flag = ' ⚠ LOW';
    if ($key === 'passes' && $total > 1200) $flag = ' ⚠ HIGH';
    if ($key === 'shots' && $total < 15) $flag = ' ⚠ LOW';
    if ($key === 'shots' && $total > 40) $flag = ' ⚠ HIGH';
    if ($key === 'fouls' && $total < 10) $flag = ' ⚠ LOW';
    if ($key === 'fouls' && $total > 35) $flag = ' ⚠ HIGH';
    if ($key === 'tackles' && $total < 20) $flag = ' ⚠ LOW';
    if ($key === 'offsides' && $total > 10) $flag = ' ⚠ HIGH';
    if ($key === 'corners' && $total > 20) $flag = ' ⚠ HIGH';
    if ($key === 'yellow_cards' && $total > 8) $flag = ' ⚠ HIGH';

    printf("%-20s %8s %8s   (%s per team)%s\n", $label, $home, $away, $range, $flag);
}

// ===================== EVENT DISTRIBUTION =====================
echo "\n==========================================================\n";
echo "  2. EVENT TYPE DISTRIBUTION\n";
echo "==========================================================\n";

$totalEvents = count($allEvents);
arsort($eventsByType);

printf("%-25s %6s %8s\n", 'Event Type', 'Count', '% of Total');
echo str_repeat('-', 45) . "\n";
foreach ($eventsByType as $type => $count) {
    $pct = round($count / $totalEvents * 100, 1);
    printf("%-25s %6d   %5.1f%%\n", $type, $count, $pct);
}
echo str_repeat('-', 45) . "\n";
printf("%-25s %6d   %5.1f%%\n", 'TOTAL', $totalEvents, 100.0);

// ===================== MINUTE ACTIVITY =====================
echo "\n==========================================================\n";
echo "  3. MINUTE ACTIVITY\n";
echo "==========================================================\n";
$totalMinutes = $minutesWithEvents + $minutesWithoutEvents;
echo "Minutes with events:    {$minutesWithEvents}/{$totalMinutes} (" . round($minutesWithEvents/$totalMinutes*100) . "%)\n";
echo "Minutes without events: {$minutesWithoutEvents}/{$totalMinutes} (" . round($minutesWithoutEvents/$totalMinutes*100) . "%)\n";
echo "Events per active minute: " . round($totalEvents / max(1, $minutesWithEvents), 1) . "\n";
echo "\nExpected: 85-95% of minutes should have some activity\n";

// ===================== POSSESSION FLOW =====================
echo "\n==========================================================\n";
echo "  4. POSSESSION FLOW\n";
echo "==========================================================\n";
echo "Possession changes: {$possessionChanges}\n";
echo "Max consecutive home possession: {$consecutivePossession['max_home']} minutes\n";
echo "Max consecutive away possession: {$consecutivePossession['max_away']} minutes\n";
echo "Avg possession run: " . round($totalMinutes / max(1, $possessionChanges), 1) . " minutes\n";
echo "\nExpected: 3-8 minute average possession runs (not flipping every minute)\n";

// ===================== SEQUENCE DATA =====================
echo "\n==========================================================\n";
echo "  5. SEQUENCE ANIMATION DATA\n";
echo "==========================================================\n";
echo "Total sequence steps: " . count($allSequenceSteps) . "\n";
echo "Events with sequences: " . count(array_filter($allEvents, fn($e) => !empty($e['sequence']))) . "/" . $totalEvents . "\n";
echo "Events without sequences: " . count(array_filter($allEvents, fn($e) => empty($e['sequence']))) . "/" . $totalEvents . "\n";

// Analyze step types
$stepTypes = [];
$stepDurations = [];
$stepsWithTargets = 0;
foreach ($allSequenceSteps as $step) {
    $action = $step['action'] ?? 'unknown';
    $stepTypes[$action] = ($stepTypes[$action] ?? 0) + 1;
    $stepDurations[] = $step['duration_ms'] ?? 0;
    if (isset($step['target_id']) && $step['target_id']) {
        $stepsWithTargets++;
    }
}

echo "\nStep action distribution:\n";
arsort($stepTypes);
foreach ($stepTypes as $action => $count) {
    printf("  %-20s %5d\n", $action, $count);
}

if (!empty($stepDurations)) {
    sort($stepDurations);
    echo "\nStep durations (ms):\n";
    echo "  Min:    " . min($stepDurations) . "\n";
    echo "  Max:    " . max($stepDurations) . "\n";
    echo "  Median: " . $stepDurations[count($stepDurations) >> 1] . "\n";
    echo "  Avg:    " . round(array_sum($stepDurations) / count($stepDurations)) . "\n";
}

echo "\nSteps with target_id (receiver): {$stepsWithTargets}/" . count($allSequenceSteps) . "\n";
echo "Expected: Most 'pass' steps should have a target_id\n";

// ===================== BALL POSITION =====================
echo "\n==========================================================\n";
echo "  6. BALL POSITION ANALYSIS\n";
echo "==========================================================\n";
if (!empty($ballPositions)) {
    $avgX = round(array_sum(array_column($ballPositions, 'x')) / count($ballPositions), 1);
    $avgY = round(array_sum(array_column($ballPositions, 'y')) / count($ballPositions), 1);
    $xValues = array_column($ballPositions, 'x');
    echo "Ball positions reported: " . count($ballPositions) . "\n";
    echo "Average ball X: {$avgX} (expected ~50)\n";
    echo "Average ball Y: {$avgY} (expected ~50)\n";
    echo "Ball X range: " . round(min($xValues), 1) . " - " . round(max($xValues), 1) . "\n";

    // Check for teleportation (big jumps)
    $bigJumps = 0;
    for ($i = 1; $i < count($ballPositions); $i++) {
        $dx = abs($ballPositions[$i]['x'] - $ballPositions[$i-1]['x']);
        $dy = abs($ballPositions[$i]['y'] - $ballPositions[$i-1]['y']);
        if ($dx > 50 || $dy > 50) {
            $bigJumps++;
        }
    }
    echo "Large ball teleports (>50 units): {$bigJumps}\n";
    echo "Expected: Very few teleports (only after goals/kickoffs)\n";
} else {
    echo "WARNING: No ball positions in tick data!\n";
}

// ===================== PLAYER INVOLVEMENT =====================
echo "\n==========================================================\n";
echo "  7. PLAYER INVOLVEMENT\n";
echo "==========================================================\n";
$totalPlayers = count($playerInvolvement);
$maxInvolvement = max($playerInvolvement);
$minInvolvement = min($playerInvolvement);
$avgInvolvement = round(array_sum($playerInvolvement) / max(1, $totalPlayers), 1);
echo "Unique players involved: {$totalPlayers}\n";
echo "Expected: 22 (all starters should be involved)\n";
echo "Most involved: {$maxInvolvement} events\n";
echo "Least involved: {$minInvolvement} events\n";
echo "Average involvement: {$avgInvolvement} events per player\n";

// ===================== SAMPLE TICKS =====================
echo "\n==========================================================\n";
echo "  8. SAMPLE TICKS (minutes 10, 25, 45, 60, 80)\n";
echo "==========================================================\n";

$sampleMinutes = [10, 25, 45, 60, 80];
foreach ($sampleMinutes as $sampleMin) {
    $tick = null;
    foreach ($ticks as $t) {
        if ($t['minute'] === $sampleMin) {
            $tick = $t;
            break;
        }
    }
    if (!$tick) continue;

    echo "\n--- Minute {$sampleMin} ---\n";
    echo "Possession: {$tick['possession']}, Zone: {$tick['zone']}, Phase: {$tick['phase']}\n";
    if (isset($tick['ball'])) {
        echo "Ball: ({$tick['ball']['x']}, {$tick['ball']['y']})\n";
    }
    echo "Score: {$tick['score']['home']}-{$tick['score']['away']}\n";
    echo "Commentary: " . ($tick['commentary'] ?: '(empty)') . "\n";

    $events = $tick['events'] ?? [];
    echo "Events (" . count($events) . "):\n";
    foreach ($events as $event) {
        $type = $event['type'];
        $player = $event['primary_player_name'] ?? '?';
        $player2 = $event['secondary_player_name'] ?? '';
        $outcome = $event['outcome'] ?? '';
        $seqCount = count($event['sequence'] ?? []);
        $seqActions = implode('→', array_map(fn($s) => $s['action'], $event['sequence'] ?? []));

        echo "  [{$type}] {$player}" . ($player2 ? " / {$player2}" : "") . " ({$outcome}) seq:{$seqCount}";
        if ($seqActions) echo " [{$seqActions}]";
        echo "\n";
    }
}

// ===================== VERDICT =====================
echo "\n==========================================================\n";
echo "  VERDICT\n";
echo "==========================================================\n";

$issues = [];
$passes = [];

// Check 1: Activity rate
$activityRate = $minutesWithEvents / $totalMinutes * 100;
if ($activityRate < 80) {
    $issues[] = "LOW ACTIVITY: Only {$activityRate}% of minutes have events (expected >80%)";
} else {
    $passes[] = "Activity rate: {$activityRate}% ✓";
}

// Check 2: Possession continuity
$avgPossRun = $totalMinutes / max(1, $possessionChanges);
if ($avgPossRun < 2) {
    $issues[] = "POSSESSION FLIPS TOO FAST: Avg {$avgPossRun} min per run (expected 3-8)";
} elseif ($avgPossRun > 15) {
    $issues[] = "POSSESSION TOO STICKY: Avg {$avgPossRun} min per run (expected 3-8)";
} else {
    $passes[] = "Possession continuity: avg {$avgPossRun} min/run ✓";
}

// Check 3: Pass count
$totalPasses = ($homeStats['passes'] ?? 0) + ($awayStats['passes'] ?? 0);
if ($totalPasses < 400) {
    $issues[] = "LOW PASSES: {$totalPasses} total (expected 600-1200)";
} elseif ($totalPasses > 1500) {
    $issues[] = "HIGH PASSES: {$totalPasses} total (expected 600-1200)";
} else {
    $passes[] = "Pass count: {$totalPasses} ✓";
}

// Check 4: Shot count
$totalShots = ($homeStats['shots'] ?? 0) + ($awayStats['shots'] ?? 0);
if ($totalShots < 15) {
    $issues[] = "LOW SHOTS: {$totalShots} total (expected 20-35)";
} elseif ($totalShots > 45) {
    $issues[] = "HIGH SHOTS: {$totalShots} total (expected 20-35)";
} else {
    $passes[] = "Shot count: {$totalShots} ✓";
}

// Check 5: Sequence data
$eventsWithSeq = count(array_filter($allEvents, fn($e) => !empty($e['sequence'])));
$seqRate = $eventsWithSeq / max(1, $totalEvents) * 100;
if ($seqRate < 40) {
    $issues[] = "LOW SEQUENCE DATA: Only {$seqRate}% of events have sequences (expected >50%)";
} else {
    $passes[] = "Sequence coverage: {$seqRate}% ✓";
}

// Check 6: Tackle count
$totalTackles = ($homeStats['tackles'] ?? 0) + ($awayStats['tackles'] ?? 0);
if ($totalTackles < 15) {
    $issues[] = "LOW TACKLES: {$totalTackles} total (expected 30-60)";
} else {
    $passes[] = "Tackle count: {$totalTackles} ✓";
}

// Check 7: Offside count
$totalOffsides = ($homeStats['offsides'] ?? 0) + ($awayStats['offsides'] ?? 0);
if ($totalOffsides > 10) {
    $issues[] = "HIGH OFFSIDES: {$totalOffsides} total (expected 2-6)";
} else {
    $passes[] = "Offside count: {$totalOffsides} ✓";
}

// Check 8: Player involvement
if ($totalPlayers < 18) {
    $issues[] = "LOW PLAYER INVOLVEMENT: Only {$totalPlayers} unique players (expected 22)";
} else {
    $passes[] = "Player involvement: {$totalPlayers} players ✓";
}

echo "\nPASSED (" . count($passes) . "):\n";
foreach ($passes as $p) echo "  ✓ {$p}\n";

echo "\nISSUES (" . count($issues) . "):\n";
if (empty($issues)) {
    echo "  None! All checks passed.\n";
} else {
    foreach ($issues as $issue) echo "  ✗ {$issue}\n";
}

echo "\n==========================================================\n";
echo "  END OF REPORT\n";
echo "==========================================================\n";
