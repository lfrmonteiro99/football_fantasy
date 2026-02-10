<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Services\Simulation\SimulationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SimulationStreamController extends Controller
{
    /** Microsecond delays keyed by speed name. */
    private const SPEED_DELAYS = [
        'realtime' => 1_000_000,  // 1 second per minute
        'fast'     => 300_000,    // 300ms per minute
        'instant'  => 0,          // no delay
    ];

    /**
     * Stream a real-time match simulation via Server-Sent Events.
     *
     * POST /api/v1/matches/{match}/simulate-stream?speed=fast
     */
    public function simulateStream(Request $request, GameMatch $match): StreamedResponse
    {
        $this->validateMatchReadiness($match);

        $match->load([
            'homeTeam.players.attributes',
            'homeTeam.players.primaryPosition',
            'awayTeam.players.attributes',
            'awayTeam.players.primaryPosition',
            'homeFormation',
            'awayFormation',
        ]);

        $speed = $request->query('speed', 'fast');
        $delay = self::SPEED_DELAYS[$speed] ?? self::SPEED_DELAYS['fast'];

        return response()->stream(function () use ($match, $delay): void {
            // Disable any stacked output buffers so data reaches the client immediately.
            while (ob_get_level()) {
                ob_end_clean();
            }

            try {
                $engine = new SimulationEngine();

                // ── Lineup event ────────────────────────────────────────
                $lineupData = $this->buildLineupPayload($match);
                $this->sendSSE('lineup', $lineupData);

                // ── Minute-by-minute ticks ──────────────────────────────
                $lastTick  = null;
                $allEvents = [];

                foreach ($engine->simulate($match) as $tick) {
                    // Always emit the full minute tick.
                    $this->sendSSE('minute', $tick);

                    // Emit granular named events so the frontend can listen selectively.
                    $this->emitNamedEvents($tick);

                    // Collect events for persistence
                    foreach ($tick['events'] ?? [] as $event) {
                        $allEvents[] = [
                            'match_id'     => $match->id,
                            'minute'       => $tick['minute'],
                            'event_type'   => $event['type'],
                            'team_type'    => $event['team'],
                            'player_name'  => $event['primary_player_name'] ?? 'Unknown',
                            'description'  => $event['description'] ?? '',
                            'x_coordinate' => (int) ($event['coordinates']['x'] ?? 50),
                            'y_coordinate' => (int) ($event['coordinates']['y'] ?? 50),
                            'commentary'   => $tick['commentary'] ?? '',
                            'sub_events'   => json_encode($event['sequence'] ?? []),
                        ];
                    }

                    // Detect phase-boundary events.
                    if ($tick['phase'] === 'half_time') {
                        $this->sendSSE('half_time', [
                            'score' => $tick['score'],
                            'stats' => $tick['stats'],
                        ]);
                    }

                    if ($tick['phase'] === 'full_time') {
                        $this->sendSSE('full_time', [
                            'score' => $tick['score'],
                            'stats' => $tick['stats'],
                        ]);
                    }

                    $lastTick = $tick;

                    if ($delay > 0) {
                        usleep($delay);
                    }
                }

                // If the engine ended without an explicit full_time phase, emit one.
                if ($lastTick !== null && $lastTick['phase'] !== 'full_time') {
                    $this->sendSSE('full_time', [
                        'score' => $lastTick['score'],
                        'stats' => $lastTick['stats'],
                    ]);
                }

                // ── Persist results after stream completes ────────────
                if ($lastTick) {
                    try {
                        $this->saveMatchResults($match, $lastTick, $allEvents);
                    } catch (\Throwable $e) {
                        Log::error('Failed to save match results after simulation stream', [
                            'match_id'  => $match->id,
                            'exception' => $e->getMessage(),
                        ]);
                    }
                }
            } catch (\Throwable $e) {
                $this->sendSSE('error', [
                    'message' => $e->getMessage(),
                    'code'    => $e->getCode(),
                ]);
            }
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache',
            'Connection'        => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Run the full simulation and return a single JSON response.
     *
     * GET /api/v1/matches/{match}/simulate-instant
     */
    public function simulateInstant(Request $request, GameMatch $match): JsonResponse
    {
        $this->validateMatchReadiness($match);

        $match->load([
            'homeTeam.players.attributes',
            'homeTeam.players.primaryPosition',
            'awayTeam.players.attributes',
            'awayTeam.players.primaryPosition',
            'homeFormation',
            'awayFormation',
        ]);

        $engine  = new SimulationEngine();
        $lineups = $this->buildLineupPayload($match);

        $minutes       = [];
        $allEvents     = [];
        $finalScore    = ['home' => 0, 'away' => 0];
        $fullTimeStats = [];
        $lastTick      = null;

        foreach ($engine->simulate($match) as $tick) {
            $minutes[] = $tick;

            // Collect events for persistence
            foreach ($tick['events'] ?? [] as $event) {
                $allEvents[] = [
                    'match_id'     => $match->id,
                    'minute'       => $tick['minute'],
                    'event_type'   => $event['type'],
                    'team_type'    => $event['team'],
                    'player_name'  => $event['primary_player_name'] ?? 'Unknown',
                    'description'  => $event['description'] ?? '',
                    'x_coordinate' => (int) ($event['coordinates']['x'] ?? 50),
                    'y_coordinate' => (int) ($event['coordinates']['y'] ?? 50),
                    'commentary'   => $tick['commentary'] ?? '',
                    'sub_events'   => json_encode($event['sequence'] ?? []),
                ];
            }

            $finalScore    = $tick['score'];
            $fullTimeStats = $tick['stats'];
            $lastTick      = $tick;
        }

        // Persist results to database
        if ($lastTick) {
            $this->saveMatchResults($match, $lastTick, $allEvents);
        }

        return response()->json([
            'match_id'        => $match->id,
            'lineups'         => $lineups,
            'minutes'         => $minutes,
            'final_score'     => $finalScore,
            'full_time_stats' => $fullTimeStats,
        ]);
    }

    // ─── Private helpers ────────────────────────────────────────────────

    /**
     * Persist final match results and events to the database.
     *
     * @param GameMatch $match     The match being simulated.
     * @param array     $finalTick The last tick from the simulation engine.
     * @param array     $events    All accumulated match events.
     */
    private function saveMatchResults(GameMatch $match, array $finalTick, array $events): void
    {
        // Update the match record with final score, stats, and status
        $match->update([
            'home_score'  => $finalTick['score']['home'],
            'away_score'  => $finalTick['score']['away'],
            'status'      => 'completed',
            'match_stats' => $finalTick['stats'],
        ]);

        // Delete any existing events for this match (in case of re-simulation)
        MatchEvent::where('match_id', $match->id)->delete();

        // Bulk insert events in chunks to avoid memory issues
        if (!empty($events)) {
            $now = now();
            foreach (array_chunk($events, 100) as $chunk) {
                MatchEvent::insert(
                    array_map(fn ($e) => array_merge($e, [
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]), $chunk)
                );
            }
        }
    }

    /**
     * Validate that the match has everything required to run a simulation.
     *
     * @throws \Illuminate\Http\Exceptions\HttpResponseException
     */
    private function validateMatchReadiness(GameMatch $match): void
    {
        $match->loadMissing(['homeTeam.primaryTactic.formation', 'awayTeam.primaryTactic.formation', 'homeFormation', 'awayFormation']);

        if (!$match->homeTeam || !$match->awayTeam) {
            abort(422, 'Match must have both a home team and an away team assigned.');
        }

        // Auto-assign formations from team's primary tactic if not set on the match
        if (!$match->homeFormation) {
            $formation = $match->homeTeam->primaryTactic?->formation ?? \App\Models\Formation::first();
            if ($formation) {
                $match->update(['home_formation_id' => $formation->id]);
                $match->load('homeFormation');
            }
        }

        if (!$match->awayFormation) {
            $formation = $match->awayTeam->primaryTactic?->formation ?? \App\Models\Formation::first();
            if ($formation) {
                $match->update(['away_formation_id' => $formation->id]);
                $match->load('awayFormation');
            }
        }

        if (!$match->homeFormation || !$match->awayFormation) {
            abort(422, 'Both teams must have a formation assigned and no default could be resolved.');
        }

        $match->homeTeam->loadMissing('players');
        $match->awayTeam->loadMissing('players');

        if ($match->homeTeam->players->isEmpty()) {
            abort(422, "Home team ({$match->homeTeam->name}) has no players.");
        }

        if ($match->awayTeam->players->isEmpty()) {
            abort(422, "Away team ({$match->awayTeam->name}) has no players.");
        }
    }

    /**
     * Build the lineup payload for both teams.
     *
     * @return array{home: array, away: array}
     */
    private function buildLineupPayload(GameMatch $match): array
    {
        $mapPlayers = fn ($players) => $players
            ->sortBy('shirt_number')
            ->values()
            ->map(fn ($player) => [
                'player_id'    => $player->id,
                'name'         => $player->full_name,
                'position'     => $player->primaryPosition?->short_name ?? 'SUB',
                'shirt_number' => $player->shirt_number,
            ])
            ->all();

        return [
            'home' => [
                'team_name' => $match->homeTeam->name,
                'formation' => $match->homeFormation->name ?? null,
                'starting'  => $mapPlayers($match->homeTeam->players),
            ],
            'away' => [
                'team_name' => $match->awayTeam->name,
                'formation' => $match->awayFormation->name ?? null,
                'starting'  => $mapPlayers($match->awayTeam->players),
            ],
        ];
    }

    /**
     * Inspect a tick's events and emit named SSE signals for goals and cards.
     */
    private function emitNamedEvents(array $tick): void
    {
        foreach ($tick['events'] as $event) {
            match ($event['type'] ?? null) {
                'goal' => $this->sendSSE('goal', [
                    'minute'    => $tick['minute'],
                    'team'      => $event['team'],
                    'scorer'    => $event['primary_player_name'] ?? null,
                    'assister'  => $event['secondary_player_name'] ?? null,
                    'score'     => $tick['score'],
                ]),
                'yellow_card' => $this->sendSSE('card', [
                    'minute'    => $tick['minute'],
                    'team'      => $event['team'],
                    'player'    => $event['primary_player_name'] ?? null,
                    'card_type' => 'yellow',
                ]),
                'red_card' => $this->sendSSE('card', [
                    'minute'    => $tick['minute'],
                    'team'      => $event['team'],
                    'player'    => $event['primary_player_name'] ?? null,
                    'card_type' => 'red',
                ]),
                default => null,
            };
        }
    }

    /**
     * Write a single SSE frame to the output stream and flush immediately.
     */
    private function sendSSE(string $event, array $data): void
    {
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_THROW_ON_ERROR) . "\n\n";

        if (ob_get_level()) {
            ob_flush();
        }
        flush();
    }
}
