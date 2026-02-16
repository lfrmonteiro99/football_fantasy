<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tactic;
use App\Models\Formation;
use App\Models\Team;
use App\Services\TacticalAnalysisService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TacticController extends Controller
{
    /**
     * @OA\Get(
     *     path="/tactics",
     *     summary="List all tactics",
     *     description="Retrieve a paginated list of tactics with their formations. Can be filtered by formation, mentality, or formation style. Includes teams count for each tactic.",
     *     operationId="getTactics",
     *     tags={"Tactics"},
     *     @OA\Parameter(
     *         name="formation_id",
     *         in="query",
     *         required=false,
     *         description="Filter tactics by formation ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="mentality",
     *         in="query",
     *         required=false,
     *         description="Filter tactics by mentality",
     *         @OA\Schema(type="string", enum={"very_defensive", "defensive", "balanced", "attacking", "very_attacking"})
     *     ),
     *     @OA\Parameter(
     *         name="style",
     *         in="query",
     *         required=false,
     *         description="Filter tactics by their formation's style",
     *         @OA\Schema(type="string", enum={"defensive", "balanced", "attacking"})
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
     *         description="Tactics retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="current_page", type="integer"),
     *                 @OA\Property(property="data", type="array", @OA\Items(
     *                     @OA\Property(property="id", type="integer"),
     *                     @OA\Property(property="name", type="string"),
     *                     @OA\Property(property="mentality", type="string"),
     *                     @OA\Property(property="formation", type="object"),
     *                     @OA\Property(property="teams_count", type="integer")
     *                 )),
     *                 @OA\Property(property="last_page", type="integer"),
     *                 @OA\Property(property="per_page", type="integer"),
     *                 @OA\Property(property="total", type="integer")
     *             ),
     *             @OA\Property(property="message", type="string", example="Tactics retrieved successfully")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = Tactic::with(['formation']);

        // Filter by formation if provided
        if ($request->has('formation_id')) {
            $query->where('formation_id', $request->formation_id);
        }

        // Filter by mentality if provided
        if ($request->has('mentality')) {
            $query->where('mentality', $request->mentality);
        }

        // Filter by style if provided
        if ($request->has('style')) {
            $query->whereHas('formation', function ($q) use ($request) {
                $q->where('style', $request->style);
            });
        }

        // Include teams count
        $query->withCount('teams');

        $tactics = $query->orderBy('name')->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $tactics,
            'message' => 'Tactics retrieved successfully'
        ]);
    }

    /**
     * @OA\Post(
     *     path="/tactics",
     *     summary="Create a new tactic",
     *     description="Store a newly created tactic. Automatically applies sample instructions from the selected formation (if available) and auto-generates tactical characteristics.",
     *     operationId="storeTactic",
     *     tags={"Tactics"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name", "formation_id", "mentality", "team_instructions", "defensive_line", "pressing", "tempo", "width"},
     *             @OA\Property(property="name", type="string", maxLength=100, example="Tiki-Taka"),
     *             @OA\Property(property="description", type="string", maxLength=500, nullable=true),
     *             @OA\Property(property="formation_id", type="integer", example=1),
     *             @OA\Property(property="mentality", type="string", enum={"very_defensive", "defensive", "balanced", "attacking", "very_attacking"}),
     *             @OA\Property(property="team_instructions", type="string", enum={"control_possession", "direct_passing", "short_passing", "mixed"}),
     *             @OA\Property(property="defensive_line", type="string", enum={"very_deep", "deep", "standard", "high", "very_high"}),
     *             @OA\Property(property="pressing", type="string", enum={"never", "rarely", "sometimes", "often", "always"}),
     *             @OA\Property(property="tempo", type="string", enum={"very_slow", "slow", "standard", "fast", "very_fast"}),
     *             @OA\Property(property="width", type="string", enum={"very_narrow", "narrow", "standard", "wide", "very_wide"}),
     *             @OA\Property(property="offside_trap", type="boolean"),
     *             @OA\Property(property="play_out_of_defence", type="boolean"),
     *             @OA\Property(property="use_offside_trap", type="boolean"),
     *             @OA\Property(property="close_down_more", type="boolean"),
     *             @OA\Property(property="tackle_harder", type="boolean"),
     *             @OA\Property(property="get_stuck_in", type="boolean"),
     *             @OA\Property(property="custom_positions", type="array", @OA\Items(type="object")),
     *             @OA\Property(property="player_assignments", type="array", @OA\Items(type="object")),
     *             @OA\Property(property="characteristics", type="array", @OA\Items(type="string"))
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Tactic created successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="id", type="integer"),
     *                 @OA\Property(property="name", type="string"),
     *                 @OA\Property(property="mentality", type="string"),
     *                 @OA\Property(property="formation", type="object")
     *             ),
     *             @OA\Property(property="message", type="string", example="Tactic created successfully")
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
            'name' => 'required|string|max:100|unique:tactics',
            'description' => 'nullable|string|max:500',
            'formation_id' => 'required|exists:formations,id',
            'mentality' => 'required|in:very_defensive,defensive,balanced,attacking,very_attacking',
            'team_instructions' => 'required|in:control_possession,direct_passing,short_passing,mixed',
            'defensive_line' => 'required|in:very_deep,deep,standard,high,very_high',
            'pressing' => 'required|in:never,rarely,sometimes,often,always',
            'tempo' => 'required|in:very_slow,slow,standard,fast,very_fast',
            'width' => 'required|in:very_narrow,narrow,standard,wide,very_wide',
            'offside_trap' => 'boolean',
            'play_out_of_defence' => 'boolean',
            'use_offside_trap' => 'boolean',
            'close_down_more' => 'boolean',
            'tackle_harder' => 'boolean',
            'get_stuck_in' => 'boolean',
            'custom_positions' => 'sometimes|array',
            'player_assignments' => 'sometimes|array',
            'characteristics' => 'sometimes|array',
        ]);

        $tactic = Tactic::create($validated);

        // Apply sample instructions from formation if available
        if ($tactic->formation && $tactic->formation->sample_instructions) {
            $sampleInstructions = $tactic->formation->sample_instructions;
            // Only apply instructions that weren't explicitly provided
            $instructionsToApply = [];
            foreach ($sampleInstructions as $key => $value) {
                if (!array_key_exists($key, $validated)) {
                    $instructionsToApply[$key] = $value;
                }
            }
            if (!empty($instructionsToApply)) {
                $tactic->update($instructionsToApply);
            }
        }

        // Auto-generate characteristics for new tactic
        $analysisService = new TacticalAnalysisService();
        $generatedCharacteristics = $analysisService->generateCharacteristics($tactic);
        $tactic->update(['characteristics' => $generatedCharacteristics]);

        $tactic->load(['formation']);

        return response()->json([
            'success' => true,
            'data' => $tactic,
            'message' => 'Tactic created successfully'
        ], 201);
    }

    /**
     * @OA\Get(
     *     path="/tactics/{tactic}",
     *     summary="Get a specific tactic",
     *     description="Retrieve a single tactic by ID, including its formation, assigned teams, tactical positions with players, and position details.",
     *     operationId="showTactic",
     *     tags={"Tactics"},
     *     @OA\Parameter(
     *         name="tactic",
     *         in="path",
     *         required=true,
     *         description="Tactic ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Tactic retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="id", type="integer"),
     *                 @OA\Property(property="name", type="string"),
     *                 @OA\Property(property="mentality", type="string"),
     *                 @OA\Property(property="formation", type="object"),
     *                 @OA\Property(property="teams", type="array", @OA\Items(type="object")),
     *                 @OA\Property(property="tactical_positions", type="array", @OA\Items(
     *                     @OA\Property(property="player", type="object"),
     *                     @OA\Property(property="position", type="object")
     *                 ))
     *             ),
     *             @OA\Property(property="message", type="string", example="Tactic retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Tactic not found"
     *     )
     * )
     */
    public function show(Tactic $tactic): JsonResponse
    {
        $tactic->load(['formation', 'teams', 'tacticalPositions.player', 'tacticalPositions.position']);

        return response()->json([
            'success' => true,
            'data' => $tactic,
            'message' => 'Tactic retrieved successfully'
        ]);
    }

    /**
     * @OA\Put(
     *     path="/tactics/{tactic}",
     *     summary="Update a tactic",
     *     description="Update an existing tactic. Supports all tactic fields including extended tactical instructions (attacking_width, approach_play, passing_directness, final_third, creative_freedom, tempo, transition settings, goalkeeper distribution, out-of-possession settings). Custom positions are auto-analyzed and the best matching formation is assigned. Characteristics are auto-regenerated after update.",
     *     operationId="updateTactic",
     *     tags={"Tactics"},
     *     @OA\Parameter(
     *         name="tactic",
     *         in="path",
     *         required=true,
     *         description="Tactic ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="name", type="string", maxLength=100),
     *             @OA\Property(property="description", type="string", maxLength=500, nullable=true),
     *             @OA\Property(property="formation_id", type="integer"),
     *             @OA\Property(property="mentality", type="string", enum={"very_defensive", "defensive", "balanced", "attacking", "very_attacking"}),
     *             @OA\Property(property="team_instructions", type="string", enum={"control_possession", "direct_passing", "short_passing", "mixed"}),
     *             @OA\Property(property="defensive_line", type="string", enum={"very_deep", "deep", "standard", "high", "very_high"}),
     *             @OA\Property(property="pressing", type="string", enum={"never", "rarely", "sometimes", "often", "always"}),
     *             @OA\Property(property="tempo", type="string", enum={"very_slow", "slow", "standard", "fast", "very_fast"}),
     *             @OA\Property(property="width", type="string", enum={"very_narrow", "narrow", "standard", "wide", "very_wide"}),
     *             @OA\Property(property="offside_trap", type="boolean"),
     *             @OA\Property(property="play_out_of_defence", type="boolean"),
     *             @OA\Property(property="use_offside_trap", type="boolean"),
     *             @OA\Property(property="close_down_more", type="boolean"),
     *             @OA\Property(property="tackle_harder", type="boolean"),
     *             @OA\Property(property="get_stuck_in", type="boolean"),
     *             @OA\Property(property="attacking_width", type="string", enum={"very_narrow", "narrow", "standard", "wide", "very_wide"}),
     *             @OA\Property(property="approach_play", type="string", enum={"more_direct", "balanced", "patient"}),
     *             @OA\Property(property="passing_directness", type="string", enum={"very_short", "short", "standard", "direct", "very_direct"}),
     *             @OA\Property(property="time_wasting", type="string", enum={"never", "rarely", "sometimes", "often", "always"}),
     *             @OA\Property(property="final_third", type="string", enum={"work_ball_into_box", "low_crosses", "whipped_crosses", "hit_early_crosses", "mixed"}),
     *             @OA\Property(property="creative_freedom", type="string", enum={"disciplined", "balanced", "expressive"}),
     *             @OA\Property(property="work_ball_into_box", type="boolean"),
     *             @OA\Property(property="low_crosses", type="boolean"),
     *             @OA\Property(property="whipped_crosses", type="boolean"),
     *             @OA\Property(property="hit_early_crosses", type="boolean"),
     *             @OA\Property(property="counter_press", type="boolean"),
     *             @OA\Property(property="counter_attack", type="boolean"),
     *             @OA\Property(property="regroup", type="boolean"),
     *             @OA\Property(property="hold_shape", type="boolean"),
     *             @OA\Property(property="goalkeeper_distribution", type="string", enum={"distribute_quickly", "slow_pace_down", "roll_out", "throw_long", "take_short_kicks", "take_long_kicks", "mixed"}),
     *             @OA\Property(property="distribute_quickly", type="boolean"),
     *             @OA\Property(property="slow_pace_down", type="boolean"),
     *             @OA\Property(property="roll_out", type="boolean"),
     *             @OA\Property(property="throw_long", type="boolean"),
     *             @OA\Property(property="take_short_kicks", type="boolean"),
     *             @OA\Property(property="take_long_kicks", type="boolean"),
     *             @OA\Property(property="line_of_engagement", type="string", enum={"very_deep", "deep", "standard", "high", "very_high"}),
     *             @OA\Property(property="pressing_intensity", type="string", enum={"never", "rarely", "balanced", "often", "always"}),
     *             @OA\Property(property="prevent_short_gk_distribution", type="boolean"),
     *             @OA\Property(property="tackling", type="string", enum={"stay_on_feet", "get_stuck_in", "balanced"}),
     *             @OA\Property(property="pressing_trap", type="string", enum={"none", "inside", "outside"}),
     *             @OA\Property(property="stay_on_feet", type="boolean"),
     *             @OA\Property(property="custom_positions", type="array", @OA\Items(type="object")),
     *             @OA\Property(property="player_assignments", type="array", @OA\Items(type="object")),
     *             @OA\Property(property="characteristics", type="array", @OA\Items(type="string"))
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Tactic updated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="id", type="integer"),
     *                 @OA\Property(property="name", type="string"),
     *                 @OA\Property(property="formation", type="object")
     *             ),
     *             @OA\Property(property="message", type="string", example="Tactic updated successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Tactic not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error"
     *     )
     * )
     */
    public function update(Request $request, Tactic $tactic): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100|unique:tactics,name,' . $tactic->id,
            'description' => 'nullable|string|max:500',
            'formation_id' => 'sometimes|exists:formations,id',
            'mentality' => 'sometimes|in:very_defensive,defensive,balanced,attacking,very_attacking',
            'team_instructions' => 'sometimes|in:control_possession,direct_passing,short_passing,mixed',

            // Existing fields
            'defensive_line' => 'sometimes|in:very_deep,deep,standard,high,very_high',
            'pressing' => 'sometimes|in:never,rarely,sometimes,often,always',
            'tempo' => 'sometimes|in:very_slow,slow,standard,fast,very_fast',
            'width' => 'sometimes|in:very_narrow,narrow,standard,wide,very_wide',
            'offside_trap' => 'boolean',
            'play_out_of_defence' => 'boolean',
            'use_offside_trap' => 'boolean',
            'close_down_more' => 'boolean',
            'tackle_harder' => 'boolean',
            'get_stuck_in' => 'boolean',

            // New tactical instruction fields
            'attacking_width' => 'sometimes|in:very_narrow,narrow,standard,wide,very_wide',
            'approach_play' => 'sometimes|in:more_direct,balanced,patient',
            'passing_directness' => 'sometimes|in:very_short,short,standard,direct,very_direct',
            'time_wasting' => 'sometimes|in:never,rarely,sometimes,often,always',
            'final_third' => 'sometimes|in:work_ball_into_box,low_crosses,whipped_crosses,hit_early_crosses,mixed',
            'creative_freedom' => 'sometimes|in:disciplined,balanced,expressive',

            // Individual final third options
            'work_ball_into_box' => 'boolean',
            'low_crosses' => 'boolean',
            'whipped_crosses' => 'boolean',
            'hit_early_crosses' => 'boolean',

            // Transition fields
            'counter_press' => 'boolean',
            'counter_attack' => 'boolean',
            'regroup' => 'boolean',
            'hold_shape' => 'boolean',
            'goalkeeper_distribution' => 'sometimes|in:distribute_quickly,slow_pace_down,roll_out,throw_long,take_short_kicks,take_long_kicks,mixed',

            // Individual goalkeeper distribution options
            'distribute_quickly' => 'boolean',
            'slow_pace_down' => 'boolean',
            'roll_out' => 'boolean',
            'throw_long' => 'boolean',
            'take_short_kicks' => 'boolean',
            'take_long_kicks' => 'boolean',

            // Out of possession fields
            'line_of_engagement' => 'sometimes|in:very_deep,deep,standard,high,very_high',
            'pressing_intensity' => 'sometimes|in:never,rarely,balanced,often,always',
            'prevent_short_gk_distribution' => 'boolean',
            'tackling' => 'sometimes|in:stay_on_feet,get_stuck_in,balanced',
            'pressing_trap' => 'sometimes|in:none,inside,outside',

            // Individual tackling options
            'stay_on_feet' => 'boolean',

            // Existing fields
            'custom_positions' => 'sometimes|array',
            'player_assignments' => 'sometimes|array',
            'characteristics' => 'sometimes|array',
        ]);

        // If custom positions are provided, analyze and update formation and position roles
        if (isset($validated['custom_positions']) && is_array($validated['custom_positions'])) {
            $customPositions = $validated['custom_positions'];

            // Analyze positions and assign proper roles based on field location
            $analyzedPositions = $this->analyzeCustomPositions($customPositions);
            $validated['custom_positions'] = $analyzedPositions;

            // Find the best matching formation based on the analyzed positions
            $bestFormationId = $this->findBestFormationForPositions($analyzedPositions);
            if ($bestFormationId) {
                $validated['formation_id'] = $bestFormationId;
            }
        }

        $tactic->update($validated);

        // Auto-generate characteristics based on tactic configuration
        $analysisService = new TacticalAnalysisService();
        $generatedCharacteristics = $analysisService->generateCharacteristics($tactic);
        $tactic->update(['characteristics' => $generatedCharacteristics]);

        $tactic->load(['formation']);

        return response()->json([
            'success' => true,
            'data' => $tactic,
            'message' => 'Tactic updated successfully'
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/tactics/{tactic}",
     *     summary="Delete a tactic",
     *     description="Remove the specified tactic from the system.",
     *     operationId="destroyTactic",
     *     tags={"Tactics"},
     *     @OA\Parameter(
     *         name="tactic",
     *         in="path",
     *         required=true,
     *         description="Tactic ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Tactic deleted successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Tactic deleted successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Tactic not found"
     *     )
     * )
     */
    public function destroy(Tactic $tactic): JsonResponse
    {
        $tactic->delete();

        return response()->json([
            'success' => true,
            'message' => 'Tactic deleted successfully'
        ]);
    }

    /**
     * Assign tactic to a team.
     */
    public function assignToTeam(Request $request, Tactic $tactic): JsonResponse
    {
        $validated = $request->validate([
            'team_id' => 'required|exists:teams,id',
            'is_primary' => 'boolean',
        ]);

        $team = Team::find($validated['team_id']);

        // If setting as primary, remove primary status from other tactics
        if ($validated['is_primary'] ?? false) {
            $team->tactics()->updateExistingPivot($team->tactics()->get()->pluck('id'), ['is_primary' => false]);
        }

        // Check if already assigned
        if ($team->tactics()->where('tactic_id', $tactic->id)->exists()) {
            $team->tactics()->updateExistingPivot($tactic->id, [
                'is_primary' => $validated['is_primary'] ?? false,
                'is_active' => true
            ]);
        } else {
            $team->tactics()->attach($tactic->id, [
                'is_primary' => $validated['is_primary'] ?? false,
                'is_active' => true
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'tactic' => $tactic,
                'team' => $team,
                'is_primary' => $validated['is_primary'] ?? false
            ],
            'message' => 'Tactic assigned to team successfully'
        ]);
    }

    /**
     * @OA\Post(
     *     path="/tactics/{tactic}/assign-team",
     *     summary="Assign a tactic to a team",
     *     description="Assign the specified tactic to a team. Optionally set it as the team's primary tactic (which removes primary status from other tactics).",
     *     operationId="assignTacticToTeam",
     *     tags={"Tactics"},
     *     @OA\Parameter(
     *         name="tactic",
     *         in="path",
     *         required=true,
     *         description="Tactic ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"team_id"},
     *             @OA\Property(property="team_id", type="integer", example=1),
     *             @OA\Property(property="is_primary", type="boolean", example=true)
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Tactic assigned to team successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="tactic", type="object"),
     *                 @OA\Property(property="team", type="object"),
     *                 @OA\Property(property="is_primary", type="boolean")
     *             ),
     *             @OA\Property(property="message", type="string", example="Tactic assigned to team successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Tactic not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error"
     *     )
     * )
     */
    public function assignTeam(Request $request, Tactic $tactic): JsonResponse
    {
        return $this->assignToTeam($request, $tactic);
    }

    /**
     * Remove tactic from a team.
     */
    public function removeFromTeam(Request $request, Tactic $tactic): JsonResponse
    {
        $validated = $request->validate([
            'team_id' => 'required|exists:teams,id',
        ]);

        $team = Team::find($validated['team_id']);
        $team->tactics()->detach($tactic->id);

        return response()->json([
            'success' => true,
            'message' => 'Tactic removed from team successfully'
        ]);
    }

    /**
     * @OA\Get(
     *     path="/tactics/{tactic}/analysis",
     *     summary="Get tactical analysis",
     *     description="Retrieve a comprehensive tactical analysis for the specified tactic, including formation analysis (defensive stability, attacking threat, midfield control scores), tactical summary (approach, strengths, weaknesses), and recommended match scenarios.",
     *     operationId="getTacticAnalysis",
     *     tags={"Tactics"},
     *     @OA\Parameter(
     *         name="tactic",
     *         in="path",
     *         required=true,
     *         description="Tactic ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Tactical analysis retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="tactic", type="object"),
     *                 @OA\Property(property="formation_analysis", type="object",
     *                     @OA\Property(property="name", type="string", example="4-3-3"),
     *                     @OA\Property(property="style", type="string", example="attacking"),
     *                     @OA\Property(property="defensive_stability", type="integer", example=65),
     *                     @OA\Property(property="attacking_threat", type="integer", example=74),
     *                     @OA\Property(property="midfield_control", type="integer", example=68)
     *                 ),
     *                 @OA\Property(property="tactical_summary", type="object",
     *                     @OA\Property(property="approach", type="string", example="Attacking"),
     *                     @OA\Property(property="strengths", type="array", @OA\Items(type="string", example="High pressing")),
     *                     @OA\Property(property="weaknesses", type="array", @OA\Items(type="string", example="Vulnerable to counter-attacks"))
     *                 ),
     *                 @OA\Property(property="recommended_for", type="array", @OA\Items(type="string", example="Chasing a game"))
     *             ),
     *             @OA\Property(property="message", type="string", example="Tactical analysis retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Tactic not found"
     *     )
     * )
     */
    public function analysis(Tactic $tactic): JsonResponse
    {
        $formation = $tactic->formation;

        $analysis = [
            'tactic' => $tactic,
            'formation_analysis' => [
                'name' => $formation->name,
                'style' => $formation->style,
                'defensive_stability' => $this->calculateDefensiveStability($tactic),
                'attacking_threat' => $this->calculateAttackingThreat($tactic),
                'midfield_control' => $this->calculateMidfieldControl($tactic),
            ],
            'tactical_summary' => [
                'approach' => $this->getTacticalApproach($tactic),
                'strengths' => $this->getTacticalStrengths($tactic),
                'weaknesses' => $this->getTacticalWeaknesses($tactic),
            ],
            'recommended_for' => $this->getRecommendedScenarios($tactic),
        ];

        return response()->json([
            'success' => true,
            'data' => $analysis,
            'message' => 'Tactical analysis retrieved successfully'
        ]);
    }

    private function calculateDefensiveStability(Tactic $tactic): int
    {
        $score = 50; // Base score

        // Mentality impact
        $mentalityScores = [
            'very_defensive' => 25,
            'defensive' => 15,
            'balanced' => 0,
            'attacking' => -10,
            'very_attacking' => -20
        ];
        $score += $mentalityScores[$tactic->mentality] ?? 0;

        // Formation impact
        $score += $tactic->formation->defenders_count * 5;

        // Tactical instructions
        if ($tactic->tackle_harder) $score += 5;
        if ($tactic->get_stuck_in) $score += 5;
        if ($tactic->close_down_more) $score += 3;

        return max(0, min(100, $score));
    }

    private function calculateAttackingThreat(Tactic $tactic): int
    {
        $score = 50; // Base score

        // Mentality impact
        $mentalityScores = [
            'very_defensive' => -20,
            'defensive' => -10,
            'balanced' => 0,
            'attacking' => 15,
            'very_attacking' => 25
        ];
        $score += $mentalityScores[$tactic->mentality] ?? 0;

        // Formation impact
        $score += $tactic->formation->forwards_count * 8;

        // Tempo impact
        $tempoScores = [
            'very_slow' => -10,
            'slow' => -5,
            'standard' => 0,
            'fast' => 5,
            'very_fast' => 10
        ];
        $score += $tempoScores[$tactic->tempo] ?? 0;

        return max(0, min(100, $score));
    }

    private function calculateMidfieldControl(Tactic $tactic): int
    {
        $score = 50; // Base score

        // Formation impact
        $score += $tactic->formation->midfielders_count * 6;

        // Team instructions
        if ($tactic->team_instructions === 'control_possession') $score += 15;
        if ($tactic->team_instructions === 'short_passing') $score += 10;

        return max(0, min(100, $score));
    }

    private function getTacticalApproach(Tactic $tactic): string
    {
        if ($tactic->mentality === 'very_defensive') return 'Ultra-defensive';
        if ($tactic->mentality === 'defensive') return 'Defensive';
        if ($tactic->mentality === 'attacking') return 'Attacking';
        if ($tactic->mentality === 'very_attacking') return 'Ultra-attacking';
        return 'Balanced';
    }

    private function getTacticalStrengths(Tactic $tactic): array
    {
        $strengths = [];

        if ($tactic->formation->defenders_count >= 5) $strengths[] = 'Defensive solidity';
        if ($tactic->formation->midfielders_count >= 5) $strengths[] = 'Midfield control';
        if ($tactic->formation->forwards_count >= 3) $strengths[] = 'Attacking options';
        if ($tactic->pressing === 'often' || $tactic->pressing === 'always') $strengths[] = 'High pressing';
        if ($tactic->team_instructions === 'control_possession') $strengths[] = 'Ball retention';

        return $strengths;
    }

    private function getTacticalWeaknesses(Tactic $tactic): array
    {
        $weaknesses = [];

        if ($tactic->formation->defenders_count <= 3) $weaknesses[] = 'Defensive vulnerability';
        if ($tactic->formation->midfielders_count <= 2) $weaknesses[] = 'Midfield overrun risk';
        if ($tactic->formation->forwards_count <= 1) $weaknesses[] = 'Limited attacking threat';
        if ($tactic->defensive_line === 'very_high') $weaknesses[] = 'Vulnerable to counter-attacks';
        if ($tactic->width === 'very_narrow') $weaknesses[] = 'Lack of width';

        return $weaknesses;
    }

    private function getRecommendedScenarios(Tactic $tactic): array
    {
        $scenarios = [];

        if ($tactic->mentality === 'defensive') $scenarios[] = 'Protecting a lead';
        if ($tactic->mentality === 'attacking') $scenarios[] = 'Chasing a game';
        if ($tactic->formation->style === 'balanced') $scenarios[] = 'Even matches';
        if ($tactic->pressing === 'often') $scenarios[] = 'Against possession teams';
        if ($tactic->team_instructions === 'direct_passing') $scenarios[] = 'Quick transitions';

        return $scenarios;
    }

    /**
     * Analyze custom positions and assign appropriate position names and roles
     * based on their location on the field
     */
    private function analyzeCustomPositions(array $positions): array
    {
        $analyzedPositions = [];

        foreach ($positions as $position) {
            $x = $position['x'] ?? 50;
            $y = $position['y'] ?? 50;

            // Determine position based on field location (y-axis: 0=goal, 100=goal)
            // x-axis: 0=left, 100=right

            $analyzedPosition = [
                'x' => $x,
                'y' => $y,
                'position' => $this->determinePositionFromCoordinates($x, $y),
                'role' => $this->determineRoleFromCoordinates($x, $y)
            ];

            $analyzedPositions[] = $analyzedPosition;
        }

        return $analyzedPositions;
    }

    /**
     * Determine position name based on field coordinates
     */
    private function determinePositionFromCoordinates(float $x, float $y): string
    {
        // Goalkeeper area (very close to goal)
        if ($y <= 15) {
            return 'GK';
        }

        // Defensive third (15-35)
        if ($y <= 35) {
            if ($x <= 20) return 'LB';
            if ($x >= 80) return 'RB';
            return 'CB';
        }

        // Midfield third (35-70)
        if ($y <= 70) {
            if ($x <= 15) return 'LM';
            if ($x >= 85) return 'RM';
            if ($y <= 50) return 'DM';
            if ($y >= 55) return 'AM';
            return 'CM';
        }

        // Attacking third (70-100)
        if ($x <= 25) return 'LW';
        if ($x >= 75) return 'RW';
        return 'ST';
    }

    /**
     * Determine role based on field coordinates and position
     */
    private function determineRoleFromCoordinates(float $x, float $y): string
    {
        $position = $this->determinePositionFromCoordinates($x, $y);

        // Role mapping based on position and specific location
        $roleMap = [
            'GK' => 'Goalkeeper',
            'LB' => $y <= 25 ? 'Full Back' : 'Wing Back',
            'RB' => $y <= 25 ? 'Full Back' : 'Wing Back',
            'CB' => $y <= 25 ? 'Ball Playing Defender' : 'Libero',
            'LM' => 'Wide Midfielder',
            'RM' => 'Wide Midfielder',
            'DM' => 'Holding Midfielder',
            'CM' => $y <= 45 ? 'Central Midfielder' : 'Box to Box Midfielder',
            'AM' => 'Advanced Playmaker',
            'LW' => $y >= 75 ? 'Inside Forward' : 'Winger',
            'RW' => $y >= 75 ? 'Inside Forward' : 'Winger',
            'ST' => $x >= 40 && $x <= 60 ? 'Complete Forward' : 'Striker'
        ];

        return $roleMap[$position] ?? 'Midfielder';
    }

    /**
     * Find the best formation that matches the given positions
     */
    private function findBestFormationForPositions(array $positions): ?int
    {
        // Count players by position category
        $positionCounts = [
            'GK' => 0,
            'defenders' => 0,
            'midfielders' => 0,
            'forwards' => 0
        ];

        foreach ($positions as $position) {
            $pos = $position['position'];

            if ($pos === 'GK') {
                $positionCounts['GK']++;
            } elseif (in_array($pos, ['CB', 'LB', 'RB', 'WB', 'SW'])) {
                $positionCounts['defenders']++;
            } elseif (in_array($pos, ['DM', 'CM', 'AM', 'LM', 'RM'])) {
                $positionCounts['midfielders']++;
            } elseif (in_array($pos, ['ST', 'CF', 'LW', 'RW'])) {
                $positionCounts['forwards']++;
            }
        }

        // Map position counts to formation patterns
        $formationPattern = sprintf(
            '%d-%d-%d',
            $positionCounts['defenders'],
            $positionCounts['midfielders'],
            $positionCounts['forwards']
        );

        // Find matching formation in database
        $formation = Formation::where('name', 'LIKE', "%{$formationPattern}%")->first();

        // If no exact match, create a new formation or find closest match
        if (!$formation) {

            // Create new formation if it doesn't exist
            $formation = $this->createFormationIfNotExists($formationPattern, $positions);

            // If creation failed, fallback to most common formations
            if (!$formation) {
                $commonFormations = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '5-3-2'];

                foreach ($commonFormations as $commonFormation) {
                    $formation = Formation::where('name', 'LIKE', "%{$commonFormation}%")->first();
                    if ($formation) break;
                }
            }
        }

        return $formation?->id;
    }

    /**
     * Create a new formation if it doesn't exist
     */
    private function createFormationIfNotExists(string $formationPattern, array $positions): ?Formation
    {
        try {
            // Generate formation display name and description
            $displayNames = [
                '5-4-1' => '5-4-1 Defensive',
                '5-3-2' => '5-3-2 Wing-backs',
                '4-5-1' => '4-5-1 Midfield',
                '3-4-3' => '3-4-3 Attacking',
                '4-1-4-1' => '4-1-4-1 Holding',
                '3-6-1' => '3-6-1 Ultra Defensive'
            ];

            $descriptions = [
                '5-4-1' => 'Defensive formation with five defenders and one striker',
                '5-3-2' => 'Formation with five defenders, three midfielders and two strikers',
                '4-5-1' => 'Midfield-heavy formation with four defenders and one striker',
                '3-4-3' => 'Attacking formation with three defenders and three forwards',
                '4-1-4-1' => 'Formation with holding midfielder and lone striker',
                '3-6-1' => 'Ultra defensive formation with six midfielders'
            ];

            $styles = [
                '5-4-1' => 'defensive',
                '5-3-2' => 'balanced',
                '4-5-1' => 'balanced',
                '3-4-3' => 'attacking',
                '4-1-4-1' => 'defensive',
                '3-6-1' => 'defensive'
            ];

            $displayName = $displayNames[$formationPattern] ?? "{$formationPattern} Custom";
            $description = $descriptions[$formationPattern] ?? "Custom formation with {$formationPattern} setup";
            $style = $styles[$formationPattern] ?? 'balanced';

            // Count players by category
            $defenderCount = 0;
            $midfielderCount = 0;
            $forwardCount = 0;

            foreach ($positions as $position) {
                $pos = $position['position'];
                if (in_array($pos, ['CB', 'LB', 'RB', 'WB', 'SW'])) {
                    $defenderCount++;
                } elseif (in_array($pos, ['DM', 'CM', 'AM', 'LM', 'RM'])) {
                    $midfielderCount++;
                } elseif (in_array($pos, ['ST', 'CF', 'LW', 'RW'])) {
                    $forwardCount++;
                }
            }

            // Create the formation
            $formation = Formation::create([
                'name' => $formationPattern,
                'display_name' => $displayName,
                'description' => $description,
                'positions' => $positions,
                'style' => $style,
                'defenders_count' => $defenderCount,
                'midfielders_count' => $midfielderCount,
                'forwards_count' => $forwardCount,
                'is_active' => true
            ]);

            return $formation;

        } catch (\Exception $e) {
            return null;
        }
    }
}
