<?php
/**
 * Capture a full simulation and dump JSON for analysis.
 * Usage: php api/tests/CaptureSimulation.php > /tmp/sim_capture.json
 */
require_once __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\GameMatch;
use App\Services\Simulation\SimulationEngine;

$match = GameMatch::with([
    'homeTeam.players.attributes',
    'homeTeam.players.primaryPosition',
    'homeTeam.primaryTactic',
    'awayTeam.players.attributes',
    'awayTeam.players.primaryPosition',
    'awayTeam.primaryTactic',
])->first();

$engine = new SimulationEngine();
$ticks = [];
foreach ($engine->simulate($match) as $tick) {
    $ticks[] = $tick;
}

// Analysis
$totalEvents = 0;
$totalSequenceSteps = 0;
$ticksWithEvents = 0;
$ticksWithNoEvents = 0;
$eventsByType = [];
$sequenceStepsByAction = [];
$eventsPerTick = [];
$stepsPerEvent = [];

foreach ($ticks as $tick) {
    $eventCount = count($tick['events'] ?? []);
    $eventsPerTick[] = $eventCount;
    if ($eventCount > 0) {
        $ticksWithEvents++;
    } else {
        $ticksWithNoEvents++;
    }
    foreach ($tick['events'] ?? [] as $event) {
        $totalEvents++;
        $type = $event['type'] ?? 'unknown';
        $eventsByType[$type] = ($eventsByType[$type] ?? 0) + 1;
        $stepCount = count($event['sequence'] ?? []);
        $stepsPerEvent[] = $stepCount;
        $totalSequenceSteps += $stepCount;
        foreach ($event['sequence'] ?? [] as $step) {
            $action = $step['action'] ?? 'unknown';
            $sequenceStepsByAction[$action] = ($sequenceStepsByAction[$action] ?? 0) + 1;
        }
    }
}

// Output analysis
$analysis = [
    'summary' => [
        'total_ticks' => count($ticks),
        'total_events' => $totalEvents,
        'total_sequence_steps' => $totalSequenceSteps,
        'ticks_with_events' => $ticksWithEvents,
        'ticks_with_no_events' => $ticksWithNoEvents,
        'avg_events_per_tick' => round($totalEvents / max(1, count($ticks)), 2),
        'avg_steps_per_event' => round($totalSequenceSteps / max(1, $totalEvents), 2),
        'events_per_tick_distribution' => array_count_values($eventsPerTick),
        'steps_per_event_distribution' => array_count_values($stepsPerEvent),
    ],
    'event_types' => $eventsByType,
    'sequence_actions' => $sequenceStepsByAction,
    'sample_ticks' => [
        'tick_5' => $ticks[4] ?? null,
        'tick_10' => $ticks[9] ?? null,
        'tick_25' => $ticks[24] ?? null,
        'tick_45' => $ticks[44] ?? null,
        'tick_60' => $ticks[59] ?? null,
        'tick_75' => $ticks[74] ?? null,
    ],
    'first_5_ticks_full' => array_slice($ticks, 0, 5),
];

echo json_encode($analysis, JSON_PRETTY_PRINT);
