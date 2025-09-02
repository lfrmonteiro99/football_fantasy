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
