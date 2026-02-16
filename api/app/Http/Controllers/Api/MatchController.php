<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\League;
use App\Models\GameMatch;
use App\Models\MatchLineup;
use App\Models\Player;
use App\Models\Season;
use App\Services\MatchSimulationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class MatchController extends Controller
{
    /**
     * Get matches for a specific league and season.
     *
     * @OA\Get(
     *     path="/matches/league",
     *     operationId="getLeagueMatches",
     *     tags={"Matches"},
     *     summary="Get matches for a specific league and season",
     *     description="Returns matches filtered by league, season, matchday, team, and status. If no season is specified, the current season is used.",
     *     @OA\Parameter(
     *         name="league_id",
     *         in="query",
     *         required=true,
     *         description="ID of the league",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="season_id",
     *         in="query",
     *         required=false,
     *         description="ID of the season (defaults to current season)",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="matchday",
     *         in="query",
     *         required=false,
     *         description="Filter by matchday number",
     *         @OA\Schema(type="integer", minimum=1)
     *     ),
     *     @OA\Parameter(
     *         name="team_id",
     *         in="query",
     *         required=false,
     *         description="Filter by team (home or away)",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         required=false,
     *         description="Filter by match status (e.g. scheduled, completed)",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="matches", type="array", @OA\Items(type="object")),
     *                 @OA\Property(property="league", type="object"),
     *                 @OA\Property(property="season", type="object")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="No current season found",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="error"),
     *             @OA\Property(property="message", type="string", example="No current season found and no season specified")
     *         )
     *     ),
     *     @OA\Response(response=422, description="Validation error")
     * )
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
     * @OA\Get(
     *     path="/matches/team",
     *     operationId="getTeamMatches",
     *     tags={"Matches"},
     *     summary="Get matches for a specific team",
     *     description="Returns all matches where the specified team plays (home or away), optionally filtered by season and status.",
     *     @OA\Parameter(
     *         name="team_id",
     *         in="query",
     *         required=true,
     *         description="ID of the team",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="season_id",
     *         in="query",
     *         required=false,
     *         description="Filter by season (defaults to current season if omitted)",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         required=false,
     *         description="Filter by match status",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="array", @OA\Items(type="object"))
     *         )
     *     ),
     *     @OA\Response(response=422, description="Validation error")
     * )
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
     * @OA\Get(
     *     path="/matches/upcoming",
     *     operationId="getUpcomingMatches",
     *     tags={"Matches"},
     *     summary="Get upcoming scheduled matches",
     *     description="Returns upcoming matches that have not yet been played, optionally filtered by league.",
     *     @OA\Parameter(
     *         name="league_id",
     *         in="query",
     *         required=false,
     *         description="Filter by league",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="limit",
     *         in="query",
     *         required=false,
     *         description="Maximum number of matches to return (default 10, max 20)",
     *         @OA\Schema(type="integer", minimum=1, maximum=20, default=10)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="array", @OA\Items(type="object"))
     *         )
     *     ),
     *     @OA\Response(response=422, description="Validation error")
     * )
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
     * @OA\Get(
     *     path="/matches/{id}",
     *     operationId="getMatchDetails",
     *     tags={"Matches"},
     *     summary="Get details for a specific match",
     *     description="Returns full match details including home team, away team, league, and season.",
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=404, description="Match not found")
     * )
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
     * @OA\Post(
     *     path="/matches/{id}/simulate",
     *     operationId="simulateMatch",
     *     tags={"Matches"},
     *     summary="Simulate a scheduled match",
     *     description="Runs the match simulation engine for a scheduled match. The match must have status 'scheduled'. Returns the match result and generated events.",
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Match simulated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="match", type="object"),
     *                 @OA\Property(property="events", type="array", @OA\Items(type="object"))
     *             ),
     *             @OA\Property(property="message", type="string", example="Match simulated successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Match already played or in progress",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Match has already been played or is in progress")
     *         )
     *     ),
     *     @OA\Response(response=404, description="Match not found"),
     *     @OA\Response(
     *         response=500,
     *         description="Simulation error",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string")
     *         )
     *     )
     * )
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
     * Generate 20 key events via ChatGPT for a match and return raw JSON array.
     *
     * @OA\Get(
     *     path="/matches/{id}/ai-key-events",
     *     operationId="generateKeyEvents",
     *     tags={"Matches"},
     *     summary="Generate AI key events for a match",
     *     description="Uses AI to generate 20 key events for the specified match based on team rosters and player attributes.",
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Array of generated key events",
     *         @OA\JsonContent(type="array", @OA\Items(type="object"))
     *     ),
     *     @OA\Response(response=404, description="Match not found")
     * )
     */
    public function generateKeyEvents(int $id, MatchSimulationService $simulationService): JsonResponse
    {
        $match = GameMatch::with(['homeTeam.players.attributes', 'awayTeam.players.attributes'])->findOrFail($id);
        $events = $simulationService->generateKeyEvents($match);
        return response()->json($events);
    }

    /**
     * Generate 20 commentary events (no positions).
     *
     * @OA\Get(
     *     path="/matches/{id}/ai-commentary",
     *     operationId="generateCommentary",
     *     tags={"Matches"},
     *     summary="Generate AI commentary for a match",
     *     description="Uses AI to generate 20 commentary events for the specified match. Similar to key events but formatted as commentary text.",
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Array of generated commentary events",
     *         @OA\JsonContent(type="array", @OA\Items(type="object"))
     *     ),
     *     @OA\Response(response=404, description="Match not found")
     * )
     */
    public function generateCommentary(int $id, MatchSimulationService $simulationService): JsonResponse
    {
        $match = GameMatch::with(['homeTeam.players.attributes', 'awayTeam.players.attributes'])->findOrFail($id);
        $events = $simulationService->generateKeyEvents($match);
        return response()->json($events);
    }

    /**
     * Generate positions for a single commentary event.
     *
     * @OA\Post(
     *     path="/matches/{id}/ai-event-positions",
     *     operationId="generateEventPositions",
     *     tags={"Matches"},
     *     summary="Generate player positions for a single event",
     *     description="Uses AI to generate pitch positions for all players during a specific match event.",
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"event"},
     *             @OA\Property(
     *                 property="event",
     *                 type="object",
     *                 required={"time", "event_type", "description", "score"},
     *                 @OA\Property(property="time", type="string", example="23:00", description="Event time in MM:SS format"),
     *                 @OA\Property(property="event_type", type="string", example="goal", description="Type of event"),
     *                 @OA\Property(property="description", type="string", example="Header from a corner kick", description="Event description"),
     *                 @OA\Property(
     *                     property="score",
     *                     type="object",
     *                     @OA\Property(property="home", type="integer", example=1),
     *                     @OA\Property(property="away", type="integer", example=0)
     *                 )
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Generated position data for the event",
     *         @OA\JsonContent(type="object")
     *     ),
     *     @OA\Response(response=404, description="Match not found"),
     *     @OA\Response(
     *         response=500,
     *         description="Position generation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="error", type="string", example="Failed to generate event positions"),
     *             @OA\Property(property="message", type="string")
     *         )
     *     )
     * )
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
     * Get lineup selection for a match.
     *
     * Returns current lineup for both teams. If no lineup is stored yet,
     * generates a suggested lineup based on the team's formation.
     *
     * @OA\Get(
     *     path="/matches/{match}/lineup",
     *     operationId="getLineup",
     *     tags={"Matches"},
     *     summary="Get lineup for a match",
     *     description="Returns starting XI and bench for both home and away teams. If no lineup has been saved, an auto-suggested lineup is generated based on each team's formation.",
     *     @OA\Parameter(
     *         name="match",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Lineup data for both teams",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="home",
     *                     type="object",
     *                     @OA\Property(property="team", type="object"),
     *                     @OA\Property(property="formation", type="object"),
     *                     @OA\Property(property="starting", type="array", @OA\Items(type="object")),
     *                     @OA\Property(property="bench", type="array", @OA\Items(type="object"))
     *                 ),
     *                 @OA\Property(
     *                     property="away",
     *                     type="object",
     *                     @OA\Property(property="team", type="object"),
     *                     @OA\Property(property="formation", type="object"),
     *                     @OA\Property(property="starting", type="array", @OA\Items(type="object")),
     *                     @OA\Property(property="bench", type="array", @OA\Items(type="object"))
     *                 )
     *             )
     *         )
     *     ),
     *     @OA\Response(response=404, description="Match not found")
     * )
     *
     * @param GameMatch $match
     * @return JsonResponse
     */
    public function getLineup(GameMatch $match): JsonResponse
    {
        $match->load(['homeTeam', 'awayTeam', 'homeFormation', 'awayFormation']);

        $homeLineup = MatchLineup::where('match_id', $match->id)
            ->where('team_id', $match->home_team_id)
            ->with('player.attributes', 'player.primaryPosition')
            ->orderBy('sort_order')
            ->get();

        $awayLineup = MatchLineup::where('match_id', $match->id)
            ->where('team_id', $match->away_team_id)
            ->with('player.attributes', 'player.primaryPosition')
            ->orderBy('sort_order')
            ->get();

        // If no lineup exists, generate a suggested one
        if ($homeLineup->isEmpty() && $match->homeFormation) {
            $homeLineup = $this->suggestLineup($match->homeTeam, $match->homeFormation, $match->id);
        }
        if ($awayLineup->isEmpty() && $match->awayFormation) {
            $awayLineup = $this->suggestLineup($match->awayTeam, $match->awayFormation, $match->id);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'home' => [
                    'team' => $match->homeTeam,
                    'formation' => $match->homeFormation,
                    'starting' => $homeLineup->where('is_starting', true)->values(),
                    'bench' => $homeLineup->where('is_starting', false)->values(),
                ],
                'away' => [
                    'team' => $match->awayTeam,
                    'formation' => $match->awayFormation,
                    'starting' => $awayLineup->where('is_starting', true)->values(),
                    'bench' => $awayLineup->where('is_starting', false)->values(),
                ],
            ],
        ]);
    }

    /**
     * Save lineup selection for a match.
     *
     * Accepts starting XI and bench players for a team and persists them.
     *
     * @OA\Put(
     *     path="/matches/{match}/lineup",
     *     operationId="saveLineup",
     *     tags={"Matches"},
     *     summary="Save lineup for a match",
     *     description="Persists the starting XI and bench players for a team in a match. Validates 11 starters with exactly 1 GK, no duplicate players, and all players belonging to the team.",
     *     @OA\Parameter(
     *         name="match",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"team_id", "starting"},
     *             @OA\Property(property="team_id", type="integer", description="ID of the team this lineup belongs to"),
     *             @OA\Property(
     *                 property="starting",
     *                 type="array",
     *                 minItems=11,
     *                 maxItems=11,
     *                 description="Exactly 11 starting players",
     *                 @OA\Items(
     *                     type="object",
     *                     required={"player_id", "position"},
     *                     @OA\Property(property="player_id", type="integer", description="Player ID"),
     *                     @OA\Property(property="position", type="string", maxLength=5, description="Position abbreviation (e.g. GK, CB, ST)"),
     *                     @OA\Property(property="x", type="number", format="float", minimum=0, maximum=100, description="X coordinate on pitch"),
     *                     @OA\Property(property="y", type="number", format="float", minimum=0, maximum=100, description="Y coordinate on pitch")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="bench",
     *                 type="array",
     *                 maxItems=17,
     *                 description="Bench players (optional)",
     *                 @OA\Items(
     *                     type="object",
     *                     required={"player_id"},
     *                     @OA\Property(property="player_id", type="integer", description="Player ID")
     *                 )
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Lineup saved successfully (returns same format as GET lineup)",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error (duplicate players, wrong team, missing GK, etc.)",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="error"),
     *             @OA\Property(property="message", type="string")
     *         )
     *     ),
     *     @OA\Response(response=404, description="Match not found")
     * )
     *
     * @param GameMatch $match
     * @param Request $request
     * @return JsonResponse
     */
    public function saveLineup(GameMatch $match, Request $request): JsonResponse
    {
        $request->validate([
            'team_id' => 'required|integer',
            'starting' => 'required|array|size:11',
            'starting.*.player_id' => 'required|integer|exists:players,id',
            'starting.*.position' => 'required|string|max:5',
            'starting.*.x' => 'nullable|numeric|min:0|max:100',
            'starting.*.y' => 'nullable|numeric|min:0|max:100',
            'bench' => 'nullable|array|max:17',
            'bench.*.player_id' => 'required|integer|exists:players,id',
        ]);

        $teamId = $request->input('team_id');

        // Validate team is part of this match
        if ($teamId != $match->home_team_id && $teamId != $match->away_team_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Team is not part of this match.',
            ], 422);
        }

        $starting = $request->input('starting', []);
        $bench = $request->input('bench', []);

        // Collect all player IDs
        $startingIds = array_column($starting, 'player_id');
        $benchIds = array_column($bench, 'player_id');
        $allPlayerIds = array_merge($startingIds, $benchIds);

        // Check for duplicate player IDs
        if (count($allPlayerIds) !== count(array_unique($allPlayerIds))) {
            return response()->json([
                'status' => 'error',
                'message' => 'Duplicate player IDs found. Each player can only appear once.',
            ], 422);
        }

        // Verify all players belong to the team
        $teamPlayerIds = Player::where('team_id', $teamId)->pluck('id')->toArray();
        $invalidIds = array_diff($allPlayerIds, $teamPlayerIds);
        if (!empty($invalidIds)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Players do not belong to the specified team: ' . implode(', ', $invalidIds),
            ], 422);
        }

        // Validate exactly 1 GK in starting XI
        $gkCount = 0;
        foreach ($starting as $entry) {
            if (strtoupper($entry['position']) === 'GK') {
                $gkCount++;
            }
        }
        if ($gkCount !== 1) {
            return response()->json([
                'status' => 'error',
                'message' => 'Starting XI must have exactly 1 goalkeeper (GK). Found: ' . $gkCount,
            ], 422);
        }

        // Save lineup in a transaction
        DB::transaction(function () use ($match, $teamId, $starting, $bench) {
            // Remove existing lineup for this team in this match
            MatchLineup::where('match_id', $match->id)
                ->where('team_id', $teamId)
                ->delete();

            // Insert starting XI
            foreach ($starting as $index => $entry) {
                MatchLineup::create([
                    'match_id' => $match->id,
                    'team_id' => $teamId,
                    'player_id' => $entry['player_id'],
                    'position' => strtoupper($entry['position']),
                    'is_starting' => true,
                    'sort_order' => $index,
                    'x' => $entry['x'] ?? null,
                    'y' => $entry['y'] ?? null,
                ]);
            }

            // Insert bench players
            foreach ($bench as $index => $entry) {
                $player = Player::find($entry['player_id']);
                $position = $player && $player->primaryPosition
                    ? $player->primaryPosition->short_name
                    : 'SUB';

                MatchLineup::create([
                    'match_id' => $match->id,
                    'team_id' => $teamId,
                    'player_id' => $entry['player_id'],
                    'position' => $position,
                    'is_starting' => false,
                    'sort_order' => 11 + $index,
                    'x' => null,
                    'y' => null,
                ]);
            }
        });

        // Return updated lineup in the same format as getLineup
        return $this->getLineup($match);
    }

    /**
     * Generate a suggested lineup based on team formation.
     *
     * Assigns the best-matching player (by primary position + current_ability) for each
     * formation slot, then puts remaining players on the bench.
     *
     * @param \App\Models\Team $team
     * @param \App\Models\Formation $formation
     * @param int $matchId
     * @return \Illuminate\Database\Eloquent\Collection
     */
    private function suggestLineup($team, $formation, int $matchId)
    {
        $players = $team->players()->with(['attributes', 'primaryPosition'])->get();
        $positions = $formation->positions ?? [];
        $assigned = [];
        $lineupRecords = [];

        // Position compatibility map (same as SimulationEngine)
        $positionCompat = [
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

        // Sort positions: GK first, then by y-coordinate
        usort($positions, function ($a, $b) {
            if ($a['position'] === 'GK') return -1;
            if ($b['position'] === 'GK') return 1;
            return ($a['y'] ?? 0) <=> ($b['y'] ?? 0);
        });

        // Assign best player for each formation slot
        $sortOrder = 0;
        foreach ($positions as $slot) {
            $posAbbr = $slot['position'];
            $compatibles = $positionCompat[$posAbbr] ?? [$posAbbr];

            // Find best unassigned player compatible with this position
            $bestPlayer = null;
            $bestAbility = -1;

            foreach ($players as $player) {
                if (in_array($player->id, $assigned, true)) {
                    continue;
                }
                if ($player->is_injured) {
                    continue;
                }

                $primaryAbbr = $player->primaryPosition->short_name ?? '';
                if (!in_array($primaryAbbr, $compatibles, true)) {
                    continue;
                }

                $ability = $player->attributes->current_ability ?? 0;
                if ($ability > $bestAbility) {
                    $bestAbility = $ability;
                    $bestPlayer = $player;
                }
            }

            // Fallback: best unassigned non-injured player
            if (!$bestPlayer) {
                foreach ($players as $player) {
                    if (in_array($player->id, $assigned, true) || $player->is_injured) {
                        continue;
                    }
                    $ability = $player->attributes->current_ability ?? 0;
                    if ($ability > $bestAbility) {
                        $bestAbility = $ability;
                        $bestPlayer = $player;
                    }
                }
            }

            if ($bestPlayer) {
                $assigned[] = $bestPlayer->id;
                $lineupRecords[] = MatchLineup::create([
                    'match_id' => $matchId,
                    'team_id' => $team->id,
                    'player_id' => $bestPlayer->id,
                    'position' => $posAbbr,
                    'is_starting' => true,
                    'sort_order' => $sortOrder++,
                    'x' => $slot['x'] ?? null,
                    'y' => $slot['y'] ?? null,
                ]);
            }
        }

        // Remaining players go to bench
        foreach ($players as $player) {
            if (in_array($player->id, $assigned, true)) {
                continue;
            }

            $position = $player->primaryPosition->short_name ?? 'SUB';
            $lineupRecords[] = MatchLineup::create([
                'match_id' => $matchId,
                'team_id' => $team->id,
                'player_id' => $player->id,
                'position' => $position,
                'is_starting' => false,
                'sort_order' => $sortOrder++,
                'x' => null,
                'y' => null,
            ]);
        }

        // Reload all records with relationships
        $ids = array_map(fn($r) => $r->id, $lineupRecords);
        return MatchLineup::whereIn('id', $ids)
            ->with('player.attributes', 'player.primaryPosition')
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * Batch-generate positions for multiple commentary events (up to 10 per request).
     *
     * @OA\Post(
     *     path="/matches/{id}/ai-events-positions-batch",
     *     operationId="generateEventsPositionsBatch",
     *     tags={"Matches"},
     *     summary="Batch-generate player positions for multiple events",
     *     description="Uses AI to generate pitch positions for all players across up to 10 match events in a single request. Events are normalized and validated before processing.",
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Match ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"events"},
     *             @OA\Property(
     *                 property="events",
     *                 type="array",
     *                 minItems=1,
     *                 maxItems=10,
     *                 description="Array of events (max 10)",
     *                 @OA\Items(
     *                     type="object",
     *                     required={"time", "event_type", "description", "score", "sub_events"},
     *                     @OA\Property(property="time", type="string", example="45:00", description="Event time in MM:SS format"),
     *                     @OA\Property(property="event_type", type="string", example="goal", description="Type of event"),
     *                     @OA\Property(property="description", type="string", description="Event description"),
     *                     @OA\Property(
     *                         property="score",
     *                         type="object",
     *                         @OA\Property(property="home", type="integer", example=1),
     *                         @OA\Property(property="away", type="integer", example=0)
     *                     ),
     *                     @OA\Property(
     *                         property="sub_events",
     *                         type="array",
     *                         description="Detailed sub-event actions",
     *                         @OA\Items(
     *                             type="object",
     *                             required={"action"},
     *                             @OA\Property(property="action", type="string", description="Sub-event action type"),
     *                             @OA\Property(property="from_player", type="integer", nullable=true, description="Player ID initiating the action"),
     *                             @OA\Property(property="to_player", type="integer", nullable=true, description="Player ID receiving the action"),
     *                             @OA\Property(property="players_involved", type="array", nullable=true, @OA\Items(type="integer")),
     *                             @OA\Property(property="ball_start", type="array", nullable=true, @OA\Items(type="number")),
     *                             @OA\Property(property="ball_end", type="array", nullable=true, @OA\Items(type="number"))
     *                         )
     *                     )
     *                 )
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Batch position data for all events",
     *         @OA\JsonContent(type="object")
     *     ),
     *     @OA\Response(response=404, description="Match not found"),
     *     @OA\Response(response=422, description="Validation error"),
     *     @OA\Response(
     *         response=500,
     *         description="Batch position generation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="error", type="string", example="Failed to generate batch event positions"),
     *             @OA\Property(property="message", type="string")
     *         )
     *     )
     * )
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
