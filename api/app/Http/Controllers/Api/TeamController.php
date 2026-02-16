<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    /**
     * Get all teams.
     *
     * @OA\Get(
     *     path="/teams/all",
     *     operationId="getAllTeams",
     *     tags={"Teams"},
     *     summary="Get all teams (unpaginated)",
     *     description="Returns all teams ordered by name, each with its associated league.",
     *     @OA\Response(
     *         response=200,
     *         description="Teams retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="array", @OA\Items(type="object"))
     *         )
     *     )
     * )
     *
     * @return JsonResponse
     */
    public function getAllTeams(): JsonResponse
    {
        $teams = Team::with('league')
            ->orderBy('name')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $teams,
        ]);
    }

    /**
     * Display a listing of teams.
     *
     * @OA\Get(
     *     path="/teams",
     *     operationId="getTeams",
     *     tags={"Teams"},
     *     summary="List all teams",
     *     description="Returns a paginated list of teams, optionally filtered by league, country, or search term.",
     *     @OA\Parameter(
     *         name="league_id",
     *         in="query",
     *         required=false,
     *         description="Filter teams by league ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="country",
     *         in="query",
     *         required=false,
     *         description="Filter teams by country (matched via league)",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         required=false,
     *         description="Search teams by name (partial match)",
     *         @OA\Schema(type="string")
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
     *         description="Teams retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="Teams retrieved successfully")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = Team::with(['league', 'players.primaryPosition']);

        // Filter by league if provided
        if ($request->has('league_id')) {
            $query->where('league_id', $request->league_id);
        }

        // Filter by country if provided
        if ($request->has('country')) {
            $query->whereHas('league', function ($q) use ($request) {
                $q->where('country', $request->country);
            });
        }

        // Search by name
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        // Sort by reputation by default
        $query->orderBy('reputation', 'desc');

        $teams = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $teams,
            'message' => 'Teams retrieved successfully'
        ]);
    }

    /**
     * Store a newly created team.
     *
     * @OA\Post(
     *     path="/teams",
     *     operationId="createTeam",
     *     tags={"Teams"},
     *     summary="Create a new team",
     *     description="Creates a new team with the provided details and returns it with its league.",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name", "short_name", "city", "league_id", "budget", "reputation", "primary_color", "secondary_color"},
     *             @OA\Property(property="name", type="string", maxLength=255, example="FC Porto"),
     *             @OA\Property(property="short_name", type="string", maxLength=3, example="FCP"),
     *             @OA\Property(property="city", type="string", maxLength=100, example="Porto"),
     *             @OA\Property(property="stadium_name", type="string", maxLength=255, nullable=true, example="Estadio do Dragao"),
     *             @OA\Property(property="stadium_capacity", type="integer", minimum=1000, maximum=150000, nullable=true, example=50033),
     *             @OA\Property(property="league_id", type="integer", example=1),
     *             @OA\Property(property="budget", type="number", minimum=0, example=50000000),
     *             @OA\Property(property="reputation", type="number", minimum=1, maximum=10, example=8.5),
     *             @OA\Property(property="primary_color", type="string", example="#003DA5", description="Hex color code"),
     *             @OA\Property(property="secondary_color", type="string", example="#FFFFFF", description="Hex color code"),
     *             @OA\Property(property="founded_year", type="integer", minimum=1800, nullable=true, example=1893)
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Team created successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="Team created successfully")
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
            'name' => 'required|string|max:255|unique:teams',
            'short_name' => 'required|string|max:3|unique:teams',
            'city' => 'required|string|max:100',
            'stadium_name' => 'nullable|string|max:255',
            'stadium_capacity' => 'nullable|integer|min:1000|max:150000',
            'league_id' => 'required|exists:leagues,id',
            'budget' => 'required|numeric|min:0',
            'reputation' => 'required|numeric|min:1|max:10',
            'primary_color' => 'required|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'secondary_color' => 'required|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'founded_year' => 'nullable|integer|min:1800|max:' . date('Y'),
        ]);

        $team = Team::create($validated);
        $team->load(['league']);

        return response()->json([
            'success' => true,
            'data' => $team,
            'message' => 'Team created successfully'
        ], 201);
    }

    /**
     * Display the specified team.
     *
     * @OA\Get(
     *     path="/teams/{team}",
     *     operationId="getTeam",
     *     tags={"Teams"},
     *     summary="Get a specific team",
     *     description="Returns a single team with its league, players, and tactics (including formations).",
     *     @OA\Parameter(
     *         name="team",
     *         in="path",
     *         required=true,
     *         description="Team ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Team retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="Team retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Team not found"
     *     )
     * )
     */
    public function show(Team $team): JsonResponse
    {
        $team->load([
            'league',
            'players.primaryPosition',
            'players.attributes',
            'tactics.formation'
        ]);

        return response()->json([
            'success' => true,
            'data' => $team,
            'message' => 'Team retrieved successfully'
        ]);
    }

    /**
     * Update the specified team.
     *
     * @OA\Put(
     *     path="/teams/{team}",
     *     operationId="updateTeam",
     *     tags={"Teams"},
     *     summary="Update an existing team",
     *     description="Updates a team with the provided fields. All fields are optional.",
     *     @OA\Parameter(
     *         name="team",
     *         in="path",
     *         required=true,
     *         description="Team ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=false,
     *         @OA\JsonContent(
     *             @OA\Property(property="name", type="string", maxLength=255, example="FC Porto"),
     *             @OA\Property(property="short_name", type="string", maxLength=3, example="FCP"),
     *             @OA\Property(property="city", type="string", maxLength=100, example="Porto"),
     *             @OA\Property(property="stadium_name", type="string", maxLength=255, nullable=true, example="Estadio do Dragao"),
     *             @OA\Property(property="stadium_capacity", type="integer", minimum=1000, maximum=150000, nullable=true, example=50033),
     *             @OA\Property(property="league_id", type="integer", example=1),
     *             @OA\Property(property="budget", type="number", minimum=0, example=50000000),
     *             @OA\Property(property="reputation", type="number", minimum=1, maximum=10, example=8.5),
     *             @OA\Property(property="primary_color", type="string", example="#003DA5", description="Hex color code"),
     *             @OA\Property(property="secondary_color", type="string", example="#FFFFFF", description="Hex color code"),
     *             @OA\Property(property="founded_year", type="integer", minimum=1800, nullable=true, example=1893)
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Team updated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="Team updated successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Team not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error"
     *     )
     * )
     */
    public function update(Request $request, Team $team): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('teams')->ignore($team->id)],
            'short_name' => ['sometimes', 'string', 'max:3', Rule::unique('teams')->ignore($team->id)],
            'city' => 'sometimes|string|max:100',
            'stadium_name' => 'nullable|string|max:255',
            'stadium_capacity' => 'nullable|integer|min:1000|max:150000',
            'league_id' => 'sometimes|exists:leagues,id',
            'budget' => 'sometimes|numeric|min:0',
            'reputation' => 'sometimes|numeric|min:1|max:10',
            'primary_color' => 'sometimes|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'secondary_color' => 'sometimes|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'founded_year' => 'nullable|integer|min:1800|max:' . date('Y'),
        ]);

        $team->update($validated);
        $team->load(['league']);

        return response()->json([
            'success' => true,
            'data' => $team,
            'message' => 'Team updated successfully'
        ]);
    }

    /**
     * Remove the specified team.
     *
     * @OA\Delete(
     *     path="/teams/{team}",
     *     operationId="deleteTeam",
     *     tags={"Teams"},
     *     summary="Delete a team",
     *     description="Permanently deletes the specified team.",
     *     @OA\Parameter(
     *         name="team",
     *         in="path",
     *         required=true,
     *         description="Team ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Team deleted successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Team deleted successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Team not found"
     *     )
     * )
     */
    public function destroy(Team $team): JsonResponse
    {
        $team->delete();

        return response()->json([
            'success' => true,
            'message' => 'Team deleted successfully'
        ]);
    }

    /**
     * Get team squad with detailed player information.
     *
     * @OA\Get(
     *     path="/teams/{team}/squad",
     *     operationId="getTeamSquad",
     *     tags={"Teams"},
     *     summary="Get team squad",
     *     description="Returns the team's full squad with detailed player information including position, attributes, age, nationality, market value, and injury status. Also includes aggregate squad statistics.",
     *     @OA\Parameter(
     *         name="team",
     *         in="path",
     *         required=true,
     *         description="Team ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Team squad retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="team", type="object"),
     *                 @OA\Property(property="players", type="array",
     *                     @OA\Items(type="object",
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="full_name", type="string", example="Diogo Costa"),
     *                         @OA\Property(property="shirt_number", type="integer", example=99),
     *                         @OA\Property(property="position", type="object", nullable=true,
     *                             @OA\Property(property="id", type="integer"),
     *                             @OA\Property(property="name", type="string"),
     *                             @OA\Property(property="short_name", type="string"),
     *                             @OA\Property(property="category", type="string"),
     *                             @OA\Property(property="key_attributes", type="object")
     *                         ),
     *                         @OA\Property(property="age", type="integer", example=25),
     *                         @OA\Property(property="nationality", type="string", example="Portuguese"),
     *                         @OA\Property(property="market_value", type="number", example=25000000),
     *                         @OA\Property(property="current_ability", type="number", example=15.5),
     *                         @OA\Property(property="potential_ability", type="number", example=18.0),
     *                         @OA\Property(property="is_injured", type="boolean", example=false)
     *                     )
     *                 ),
     *                 @OA\Property(property="stats", type="object",
     *                     @OA\Property(property="total_players", type="integer", example=28),
     *                     @OA\Property(property="average_age", type="number", format="float", example=25.3),
     *                     @OA\Property(property="total_value", type="number", example=350000000),
     *                     @OA\Property(property="average_rating", type="number", format="float", example=14.2),
     *                     @OA\Property(property="injured_players", type="integer", example=2)
     *                 )
     *             ),
     *             @OA\Property(property="message", type="string", example="Team squad retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Team not found"
     *     )
     * )
     */
    public function squad(Team $team): JsonResponse
    {
        $players = $team->players()
            ->with(['primaryPosition', 'attributes'])
            ->orderBy('shirt_number')
            ->get()
            ->map(function ($player) {
                $position = $player->primaryPosition;
                return [
                    'id' => $player->id,
                    'full_name' => $player->full_name,
                    'shirt_number' => $player->shirt_number,
                    'position' => $position ? [
                        'id' => $position->id,
                        'name' => $position->name,
                        'short_name' => $position->short_name,
                        'category' => $position->category,
                        'key_attributes' => $position->key_attributes,
                    ] : null,
                    'age' => $player->age,
                    'nationality' => $player->nationality,
                    'market_value' => $player->market_value,
                    'current_ability' => $player->attributes->current_ability ?? 0,
                    'potential_ability' => $player->attributes->potential_ability ?? 0,
                    'is_injured' => $player->is_injured,
                ];
            });

        $squadStats = [
            'total_players' => $players->count(),
            'average_age' => $players->avg('age'),
            'total_value' => $players->sum('market_value'),
            'average_rating' => $players->avg('current_ability'),
            'injured_players' => $players->where('is_injured', true)->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'team' => $team,
                'players' => $players,
                'stats' => $squadStats
            ],
            'message' => 'Team squad retrieved successfully'
        ]);
    }

    /**
     * Get team tactics and formations.
     *
     * @OA\Get(
     *     path="/teams/{team}/tactics",
     *     operationId="getTeamTactics",
     *     tags={"Teams"},
     *     summary="Get team tactics",
     *     description="Returns all tactics configured for the team, each with its associated formation.",
     *     @OA\Parameter(
     *         name="team",
     *         in="path",
     *         required=true,
     *         description="Team ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Team tactics retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="team", type="object"),
     *                 @OA\Property(property="tactics", type="array", @OA\Items(type="object"))
     *             ),
     *             @OA\Property(property="message", type="string", example="Team tactics retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Team not found"
     *     )
     * )
     */
    public function tactics(Team $team): JsonResponse
    {
        $tactics = $team->tactics()
            ->with(['formation'])
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'team' => $team,
                'tactics' => $tactics
            ],
            'message' => 'Team tactics retrieved successfully'
        ]);
    }

    /**
     * Get teams by league.
     *
     * @OA\Get(
     *     path="/leagues/{league}/teams",
     *     operationId="getTeamsByLeague",
     *     tags={"Teams"},
     *     summary="Get teams by league",
     *     description="Returns all teams belonging to the specified league, ordered by reputation, with player counts and budget information.",
     *     @OA\Parameter(
     *         name="league",
     *         in="path",
     *         required=true,
     *         description="League ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Teams retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="league", type="object"),
     *                 @OA\Property(property="teams", type="array",
     *                     @OA\Items(type="object",
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="name", type="string", example="SL Benfica"),
     *                         @OA\Property(property="short_name", type="string", example="BEN"),
     *                         @OA\Property(property="city", type="string", example="Lisbon"),
     *                         @OA\Property(property="reputation", type="number", example=8.5),
     *                         @OA\Property(property="players_count", type="integer", example=28),
     *                         @OA\Property(property="budget", type="number", example=80000000),
     *                         @OA\Property(property="primary_color", type="string", example="#FF0000"),
     *                         @OA\Property(property="secondary_color", type="string", example="#FFFFFF")
     *                     )
     *                 )
     *             ),
     *             @OA\Property(property="message", type="string", example="Teams retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="League not found"
     *     )
     * )
     */
    public function byLeague(League $league): JsonResponse
    {
        $teams = $league->teams()
            ->with(['players'])
            ->orderBy('reputation', 'desc')
            ->get()
            ->map(function ($team) {
                return [
                    'id' => $team->id,
                    'name' => $team->name,
                    'short_name' => $team->short_name,
                    'city' => $team->city,
                    'reputation' => $team->reputation,
                    'players_count' => $team->players->count(),
                    'budget' => $team->budget,
                    'primary_color' => $team->primary_color,
                    'secondary_color' => $team->secondary_color,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'league' => $league,
                'teams' => $teams
            ],
            'message' => 'Teams retrieved successfully'
        ]);
    }
}
