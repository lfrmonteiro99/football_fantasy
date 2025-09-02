<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\League;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class LeagueController extends Controller
{
    /**
     * Display a listing of leagues.
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
     */
    public function standings(League $league): JsonResponse
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
                    'reputation' => $team->reputation,
                    'players_count' => $team->players->count(),
                    'average_age' => $team->players->avg('age') ?? 0,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'league' => $league,
                'teams' => $teams
            ],
            'message' => 'League standings retrieved successfully'
        ]);
    }
}
