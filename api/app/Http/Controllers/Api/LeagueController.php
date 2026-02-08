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
