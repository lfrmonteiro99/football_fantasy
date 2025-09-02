<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\League;
use App\Models\GameMatch;
use App\Models\Season;
use App\Services\MatchSimulationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class MatchController extends Controller
{
    /**
     * Get matches for a specific league and season.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getLeagueMatches(Request $request): JsonResponse
    {
        $request->validate([
            'league_id' => 'required|exists:leagues,id',
            'season_id' => 'nullable|exists:seasons,id',
            'matchday' => 'nullable|integer|min:1',
            'team_id' => 'nullable|exists:teams,id',
            'status' => 'nullable|string',
        ]);

        $leagueId = $request->input('league_id');
        $seasonId = $request->input('season_id');
        $matchday = $request->input('matchday');
        $teamId = $request->input('team_id');
        $status = $request->input('status');

        // If no season is specified, use the current one
        if (!$seasonId) {
            $currentSeason = Season::where('is_current', true)->first();
            $seasonId = $currentSeason ? $currentSeason->id : null;
        }

        if (!$seasonId) {
            return response()->json([
                'status' => 'error',
                'message' => 'No current season found and no season specified',
            ], 404);
        }

        $query = GameMatch::with(['homeTeam', 'awayTeam'])
            ->where('league_id', $leagueId)
            ->where('season_id', $seasonId);

        if ($matchday) {
            $query->where('matchday', $matchday);
        }

        if ($teamId) {
            $query->where(function ($q) use ($teamId) {
                $q->where('home_team_id', $teamId)
                    ->orWhere('away_team_id', $teamId);
            });
        }

        if ($status) {
            $query->where('status', $status);
        }

        $matches = $query->orderBy('match_date')
            ->orderBy('match_time')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'matches' => $matches,
                'league' => League::find($leagueId),
                'season' => Season::find($seasonId),
            ],
        ]);
    }

    /**
     * Get matches for a specific team.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getTeamMatches(Request $request): JsonResponse
    {
        $request->validate([
            'team_id' => 'required|exists:teams,id',
            'season_id' => 'nullable|exists:seasons,id',
            'status' => 'nullable|string',
        ]);

        $teamId = $request->input('team_id');
        $seasonId = $request->input('season_id');
        $status = $request->input('status');

        // If no season is specified, use the current one
        if (!$seasonId) {
            $currentSeason = Season::where('is_current', true)->first();
            $seasonId = $currentSeason ? $currentSeason->id : null;
        }

        $query = GameMatch::with(['homeTeam', 'awayTeam', 'league'])
            ->where(function ($q) use ($teamId) {
                $q->where('home_team_id', $teamId)
                    ->orWhere('away_team_id', $teamId);
            });

        if ($seasonId) {
            $query->where('season_id', $seasonId);
        }

        if ($status) {
            $query->where('status', $status);
        }

        $matches = $query->orderBy('match_date')
            ->orderBy('match_time')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $matches,
        ]);
    }

    /**
     * Get upcoming matches.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getUpcomingMatches(Request $request): JsonResponse
    {
        $request->validate([
            'league_id' => 'nullable|exists:leagues,id',
            'limit' => 'nullable|integer|min:1|max:20',
        ]);

        $leagueId = $request->input('league_id');
        $limit = $request->input('limit', 10);

        $query = GameMatch::with(['homeTeam', 'awayTeam', 'league'])
            ->where('match_date', '>=', now()->format('Y-m-d'))
            ->where('status', 'scheduled')
            ->orderBy('match_date')
            ->orderBy('match_time');

        if ($leagueId) {
            $query->where('league_id', $leagueId);
        }

        $matches = $query->limit($limit)->get();

        return response()->json([
            'status' => 'success',
            'data' => $matches,
        ]);
    }

    /**
     * Get match details.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function getMatchDetails(int $id): JsonResponse
    {
        $match = GameMatch::with(['homeTeam', 'awayTeam', 'league', 'season'])
            ->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $match,
        ]);
    }

    /**
     * Simulate a match using the advanced simulation service.
     *
     * @param int $id
     * @param MatchSimulationService $simulationService
     * @return JsonResponse
     */
    public function simulateMatch(int $id, MatchSimulationService $simulationService): JsonResponse
    {
        try {
            $match = GameMatch::findOrFail($id);

            if ($match->status !== 'scheduled') {
                return response()->json([
                    'success' => false,
                    'message' => 'Match has already been played or is in progress'
                ], 400);
            }

            // Use the advanced simulation service
            $events = $simulationService->simulateMatch($match);

            // Reload match with events and relationships
            $match->load([
                'homeTeam',
                'awayTeam',
                'league',
                'season',
                'events' => function($query) {
                    $query->orderBy('minute');
                }
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'match' => $match,
                    'events' => $events
                ],
                'message' => 'Match simulated successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error simulating match: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate 20 key events via ChatGPT for a match and return raw JSON array
     */
    public function generateKeyEvents(int $id, MatchSimulationService $simulationService): JsonResponse
    {
        $match = GameMatch::with(['homeTeam.players.attributes', 'awayTeam.players.attributes'])->findOrFail($id);
        $events = $simulationService->generateKeyEvents($match);
        return response()->json($events);
    }

    /**
     * Generate 20 commentary events (no positions)
     */
    public function generateCommentary(int $id, MatchSimulationService $simulationService): JsonResponse
    {
        $match = GameMatch::with(['homeTeam.players.attributes', 'awayTeam.players.attributes'])->findOrFail($id);
        $events = $simulationService->generateKeyEvents($match);
        return response()->json($events);
    }

    /**
     * Generate positions for a single commentary event
     */
    public function generateEventPositions(int $id, Request $request, MatchSimulationService $simulationService): JsonResponse
    {
        try {
            $validated = $request->validate([
                'event' => 'required|array',
                'event.time' => 'required|string',
                'event.event_type' => 'required|string',
                'event.description' => 'required|string',
                'event.score' => 'required|array',
            ]);

            $match = GameMatch::with(['homeTeam.players', 'awayTeam.players'])->findOrFail($id);
            $payload = $simulationService->generateEventPositions($match, $validated['event']);
            return response()->json($payload);
        } catch (\Throwable $e) {
            // Log full context for debugging
            Log::error('AIEventPositions endpoint failed', [
                'match_id' => $id,
                'event' => $request->input('event'),
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'error' => 'Failed to generate event positions',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Batch-generate positions for multiple commentary events (up to 10 per request)
     */
    public function generateEventsPositionsBatch(
        int $id,
        Request $request,
        MatchSimulationService $simulationService
    ): JsonResponse {
        try {
            // Normalize incoming events: trim keys/values, fix common key typos
            $rawEvents = $request->input('events', []);
            $normalized = [];
            foreach ((array) $rawEvents as $ev) {
                $norm = [];
                foreach ((array) $ev as $k => $v) {
                    $tk = is_string($k) ? trim($k) : $k;
                    // alias common mistakes
                    if ($tk === ' description') { $tk = 'description'; }
                    if ($tk === 'desc') { $tk = 'description'; }
                    if ($tk === 'eventType') { $tk = 'event_type'; }
                    if (is_string($v)) { $v = trim($v); }
                    $norm[$tk] = $v;
                }

                // Ensure time MM:SS format and clamp ranges
                $time = data_get($norm, 'time');
                if (is_string($time) && preg_match('/^(\d{1,2}):(\d{1,2})$/', $time, $m)) {
                    $mm = max(0, min(90, (int) $m[1]));
                    $ss = max(0, min(59, (int) $m[2]));
                    $norm['time'] = str_pad((string)$mm, 2, '0', STR_PAD_LEFT)
                        . ':' . str_pad((string)$ss, 2, '0', STR_PAD_LEFT);
                }

                // Coerce score to array with ints
                $score = (array) data_get($norm, 'score', []);
                $norm['score'] = [
                    'home' => (int) data_get($score, 'home', 0),
                    'away' => (int) data_get($score, 'away', 0),
                ];

                // Ensure sub_events is always an array
                $subEvents = data_get($norm, 'sub_events', []);
                if (!is_array($subEvents)) {
                    $subEvents = [];
                }
                $norm['sub_events'] = array_map(function ($se) {
                    return [
                        'action' => data_get($se, 'action'),
                        'from_player' => data_get($se, 'from_player'),
                        'to_player' => data_get($se, 'to_player'),
                        'players_involved' => (array) data_get($se, 'players_involved', []),
                        'ball_start' => (array) data_get($se, 'ball_start', []),
                        'ball_end' => (array) data_get($se, 'ball_end', []),
                    ];
                }, $subEvents);

                $normalized[] = $norm;
            }
            $request->merge(['events' => $normalized]);

            $validated = $request->validate([
                'events' => 'required|array|min:1|max:10',
                'events.*.time' => 'required|string',
                'events.*.event_type' => 'required|string',
                'events.*.description' => 'required|string',
                'events.*.score' => 'required|array',
                'events.*.sub_events' => 'required|array',
                'events.*.sub_events.*.action' => 'required|string',
                'events.*.sub_events.*.from_player' => 'nullable|integer',
                'events.*.sub_events.*.to_player' => 'nullable|integer',
                'events.*.sub_events.*.players_involved' => 'nullable|array',   // relaxed
                'events.*.sub_events.*.ball_start' => 'nullable|array',         // relaxed
                'events.*.sub_events.*.ball_end' => 'nullable|array',           // relaxed
            ]);
            

            // Fetch match and pass to simulation
            $match = GameMatch::with(['homeTeam.players', 'awayTeam.players'])->findOrFail($id);
            $payload = $simulationService->generateEventsPositionsBatch($match, $validated['events']);

            return response()->json($payload);

        } catch (\Throwable $e) {
            Log::error('AIEventsPositionsBatch endpoint failed', [
                'match_id' => $id,
                'events' => $request->input('events'),
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'error' => 'Failed to generate batch event positions',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

}
