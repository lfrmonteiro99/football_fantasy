<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GameMatch;
use App\Models\League;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class LeagueController extends Controller
{
    /**
     * Display a listing of leagues.
     *
     * @OA\Get(
     *     path="/leagues",
     *     operationId="getLeagues",
     *     tags={"Leagues"},
     *     summary="List all leagues",
     *     description="Returns a paginated list of leagues, optionally filtered by country or level.",
     *     @OA\Parameter(
     *         name="country",
     *         in="query",
     *         required=false,
     *         description="Filter leagues by country",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="level",
     *         in="query",
     *         required=false,
     *         description="Filter leagues by level",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="per_page",
     *         in="query",
     *         required=false,
     *         description="Number of results per page (default: 15)",
     *         @OA\Schema(type="integer", default=15)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Leagues retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="Leagues retrieved successfully")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = League::with(['teams']);

        // Filter by country if provided
        if ($request->has('country')) {
            $query->where('country', $request->country);
        }

        // Filter by level if provided
        if ($request->has('level')) {
            $query->where('level', $request->level);
        }

        // Sort by reputation by default
        $query->orderBy('reputation', 'desc');

        $leagues = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $leagues,
            'message' => 'Leagues retrieved successfully'
        ]);
    }

    /**
     * Store a newly created league.
     *
     * @OA\Post(
     *     path="/leagues",
     *     operationId="createLeague",
     *     tags={"Leagues"},
     *     summary="Create a new league",
     *     description="Creates a new league with the provided details.",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name", "country", "level", "max_teams", "reputation"},
     *             @OA\Property(property="name", type="string", maxLength=255, example="Premier League"),
     *             @OA\Property(property="country", type="string", maxLength=100, example="England"),
     *             @OA\Property(property="level", type="integer", minimum=1, maximum=10, example=1),
     *             @OA\Property(property="max_teams", type="integer", minimum=8, maximum=30, example=20),
     *             @OA\Property(property="reputation", type="number", minimum=1, maximum=10, example=9.5)
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="League created successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="League created successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error"
     *     )
     * )
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:leagues',
            'country' => 'required|string|max:100',
            'level' => 'required|integer|min:1|max:10',
            'max_teams' => 'required|integer|min:8|max:30',
            'reputation' => 'required|numeric|min:1|max:10',
        ]);

        $league = League::create($validated);

        return response()->json([
            'success' => true,
            'data' => $league,
            'message' => 'League created successfully'
        ], 201);
    }

    /**
     * Display the specified league.
     *
     * @OA\Get(
     *     path="/leagues/{league}",
     *     operationId="getLeague",
     *     tags={"Leagues"},
     *     summary="Get a specific league",
     *     description="Returns a single league with its teams and players.",
     *     @OA\Parameter(
     *         name="league",
     *         in="path",
     *         required=true,
     *         description="League ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="League retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="League retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="League not found"
     *     )
     * )
     */
    public function show(League $league): JsonResponse
    {
        $league->load(['teams.players']);

        return response()->json([
            'success' => true,
            'data' => $league,
            'message' => 'League retrieved successfully'
        ]);
    }

    /**
     * Update the specified league.
     *
     * @OA\Put(
     *     path="/leagues/{league}",
     *     operationId="updateLeague",
     *     tags={"Leagues"},
     *     summary="Update an existing league",
     *     description="Updates a league with the provided fields. All fields are optional.",
     *     @OA\Parameter(
     *         name="league",
     *         in="path",
     *         required=true,
     *         description="League ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=false,
     *         @OA\JsonContent(
     *             @OA\Property(property="name", type="string", maxLength=255, example="Premier League"),
     *             @OA\Property(property="country", type="string", maxLength=100, example="England"),
     *             @OA\Property(property="level", type="integer", minimum=1, maximum=10, example=1),
     *             @OA\Property(property="max_teams", type="integer", minimum=8, maximum=30, example=20),
     *             @OA\Property(property="reputation", type="number", minimum=1, maximum=10, example=9.5)
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="League updated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="League updated successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="League not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error"
     *     )
     * )
     */
    public function update(Request $request, League $league): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('leagues')->ignore($league->id)],
            'country' => 'sometimes|string|max:100',
            'level' => 'sometimes|integer|min:1|max:10',
            'max_teams' => 'sometimes|integer|min:8|max:30',
            'reputation' => 'sometimes|numeric|min:1|max:10',
        ]);

        $league->update($validated);

        return response()->json([
            'success' => true,
            'data' => $league,
            'message' => 'League updated successfully'
        ]);
    }

    /**
     * Remove the specified league.
     *
     * @OA\Delete(
     *     path="/leagues/{league}",
     *     operationId="deleteLeague",
     *     tags={"Leagues"},
     *     summary="Delete a league",
     *     description="Permanently deletes the specified league.",
     *     @OA\Parameter(
     *         name="league",
     *         in="path",
     *         required=true,
     *         description="League ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="League deleted successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="League deleted successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="League not found"
     *     )
     * )
     */
    public function destroy(League $league): JsonResponse
    {
        $league->delete();

        return response()->json([
            'success' => true,
            'message' => 'League deleted successfully'
        ]);
    }

    /**
     * Get league standings/table.
     *
     * @OA\Get(
     *     path="/leagues/{league}/standings",
     *     operationId="getLeagueStandings",
     *     tags={"Leagues"},
     *     summary="Get league standings",
     *     description="Returns the league table computed from completed match results, sorted by points, goal difference, and goals for. Includes last 5 match form for each team.",
     *     @OA\Parameter(
     *         name="league",
     *         in="path",
     *         required=true,
     *         description="League ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="League standings retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="league", type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="name", type="string", example="Liga Portugal"),
     *                 @OA\Property(property="country", type="string", nullable=true, example="Portugal")
     *             ),
     *             @OA\Property(property="standings", type="array",
     *                 @OA\Items(type="object",
     *                     @OA\Property(property="position", type="integer", example=1),
     *                     @OA\Property(property="team", type="object",
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="name", type="string", example="SL Benfica"),
     *                         @OA\Property(property="short_name", type="string", example="BEN"),
     *                         @OA\Property(property="primary_color", type="string", nullable=true, example="#FF0000"),
     *                         @OA\Property(property="secondary_color", type="string", nullable=true, example="#FFFFFF")
     *                     ),
     *                     @OA\Property(property="played", type="integer", example=10),
     *                     @OA\Property(property="won", type="integer", example=7),
     *                     @OA\Property(property="drawn", type="integer", example=2),
     *                     @OA\Property(property="lost", type="integer", example=1),
     *                     @OA\Property(property="goals_for", type="integer", example=22),
     *                     @OA\Property(property="goals_against", type="integer", example=8),
     *                     @OA\Property(property="goal_difference", type="integer", example=14),
     *                     @OA\Property(property="points", type="integer", example=23),
     *                     @OA\Property(property="form", type="array", @OA\Items(type="string", enum={"W","D","L"}), example={"W","W","D","W","L"})
     *                 )
     *             ),
     *             @OA\Property(property="matches_played", type="integer", example=45)
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="League not found"
     *     )
     * )
     */
    public function standings(League $league): JsonResponse
    {
        $league->load('teams');

        // Get all completed matches for this league
        $matches = GameMatch::where('league_id', $league->id)
            ->where('status', 'completed')
            ->get();

        $standings = [];

        foreach ($league->teams as $team) {
            $played = 0; $won = 0; $drawn = 0; $lost = 0;
            $goalsFor = 0; $goalsAgainst = 0;

            foreach ($matches as $match) {
                if ($match->home_team_id === $team->id) {
                    $played++;
                    $goalsFor += $match->home_score;
                    $goalsAgainst += $match->away_score;
                    if ($match->home_score > $match->away_score) $won++;
                    elseif ($match->home_score === $match->away_score) $drawn++;
                    else $lost++;
                } elseif ($match->away_team_id === $team->id) {
                    $played++;
                    $goalsFor += $match->away_score;
                    $goalsAgainst += $match->home_score;
                    if ($match->away_score > $match->home_score) $won++;
                    elseif ($match->away_score === $match->home_score) $drawn++;
                    else $lost++;
                }
            }

            $points = ($won * 3) + ($drawn * 1);
            $goalDifference = $goalsFor - $goalsAgainst;

            $standings[] = [
                'position' => 0, // will be set after sorting
                'team' => [
                    'id' => $team->id,
                    'name' => $team->name,
                    'short_name' => $team->short_name,
                    'primary_color' => $team->primary_color ?? null,
                    'secondary_color' => $team->secondary_color ?? null,
                ],
                'played' => $played,
                'won' => $won,
                'drawn' => $drawn,
                'lost' => $lost,
                'goals_for' => $goalsFor,
                'goals_against' => $goalsAgainst,
                'goal_difference' => $goalDifference,
                'points' => $points,
                'form' => $this->getRecentForm($team->id, $matches), // last 5 results
            ];
        }

        // Sort: points DESC, then goal_difference DESC, then goals_for DESC
        usort($standings, function ($a, $b) {
            if ($a['points'] !== $b['points']) return $b['points'] - $a['points'];
            if ($a['goal_difference'] !== $b['goal_difference']) return $b['goal_difference'] - $a['goal_difference'];
            return $b['goals_for'] - $a['goals_for'];
        });

        // Assign positions
        foreach ($standings as $i => &$entry) {
            $entry['position'] = $i + 1;
        }

        return response()->json([
            'league' => [
                'id' => $league->id,
                'name' => $league->name,
                'country' => $league->country ?? null,
            ],
            'standings' => $standings,
            'matches_played' => $matches->count(),
        ]);
    }

    /**
     * Get recent form (last 5 results) for a team.
     */
    private function getRecentForm(int $teamId, $matches): array
    {
        $teamMatches = $matches->filter(function ($m) use ($teamId) {
            return $m->home_team_id === $teamId || $m->away_team_id === $teamId;
        })->sortByDesc('match_date')->take(5);

        $form = [];
        foreach ($teamMatches as $match) {
            if ($match->home_team_id === $teamId) {
                if ($match->home_score > $match->away_score) $form[] = 'W';
                elseif ($match->home_score === $match->away_score) $form[] = 'D';
                else $form[] = 'L';
            } else {
                if ($match->away_score > $match->home_score) $form[] = 'W';
                elseif ($match->away_score === $match->home_score) $form[] = 'D';
                else $form[] = 'L';
            }
        }
        return $form;
    }

    /**
     * Get overview stats for all leagues.
     *
     * @OA\Get(
     *     path="/stats/overview",
     *     operationId="getStatsOverview",
     *     tags={"Stats"},
     *     summary="Get overview stats for all leagues",
     *     description="Returns aggregate statistics for every league including team counts, match progress, total goals, and average goals per match.",
     *     @OA\Response(
     *         response=200,
     *         description="Overview stats retrieved successfully",
     *         @OA\JsonContent(
     *             type="array",
     *             @OA\Items(type="object",
     *                 @OA\Property(property="league", type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="name", type="string", example="Liga Portugal")
     *                 ),
     *                 @OA\Property(property="teams_count", type="integer", example=18),
     *                 @OA\Property(property="matches_completed", type="integer", example=45),
     *                 @OA\Property(property="matches_total", type="integer", example=306),
     *                 @OA\Property(property="total_goals", type="integer", example=120),
     *                 @OA\Property(property="avg_goals_per_match", type="number", format="float", example=2.67)
     *             )
     *         )
     *     )
     * )
     */
    public function overview(): JsonResponse
    {
        $leagues = League::with('teams')->get();

        $overview = [];
        foreach ($leagues as $league) {
            $completedMatches = GameMatch::where('league_id', $league->id)
                ->where('status', 'completed')
                ->count();
            $totalMatches = GameMatch::where('league_id', $league->id)->count();
            $totalGoals = GameMatch::where('league_id', $league->id)
                ->where('status', 'completed')
                ->selectRaw('SUM(home_score + away_score) as total_goals')
                ->value('total_goals') ?? 0;

            $overview[] = [
                'league' => ['id' => $league->id, 'name' => $league->name],
                'teams_count' => $league->teams->count(),
                'matches_completed' => $completedMatches,
                'matches_total' => $totalMatches,
                'total_goals' => (int) $totalGoals,
                'avg_goals_per_match' => $completedMatches > 0 ? round($totalGoals / $completedMatches, 2) : 0,
            ];
        }

        return response()->json($overview);
    }
}
