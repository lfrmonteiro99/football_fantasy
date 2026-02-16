<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Formation;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FormationController extends Controller
{
    /**
     * @OA\Get(
     *     path="/formations",
     *     summary="List all formations",
     *     description="Retrieve a list of formations, optionally filtered by style and active status. Includes tactics count for each formation.",
     *     operationId="getFormations",
     *     tags={"Formations"},
     *     @OA\Parameter(
     *         name="style",
     *         in="query",
     *         required=false,
     *         description="Filter formations by tactical style",
     *         @OA\Schema(type="string", enum={"defensive", "balanced", "attacking"})
     *     ),
     *     @OA\Parameter(
     *         name="is_active",
     *         in="query",
     *         required=false,
     *         description="Filter formations by active status",
     *         @OA\Schema(type="boolean")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Formations retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="array", @OA\Items(
     *                 @OA\Property(property="id", type="integer"),
     *                 @OA\Property(property="name", type="string", example="4-3-3"),
     *                 @OA\Property(property="display_name", type="string"),
     *                 @OA\Property(property="style", type="string", enum={"defensive", "balanced", "attacking"}),
     *                 @OA\Property(property="is_active", type="boolean"),
     *                 @OA\Property(property="tactics_count", type="integer")
     *             )),
     *             @OA\Property(property="message", type="string", example="Formations retrieved successfully")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = Formation::query();

        // Filter by style if provided
        if ($request->has('style')) {
            $query->where('style', $request->style);
        }

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Include tactics count
        $query->withCount('tactics');

        $formations = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $formations,
            'message' => 'Formations retrieved successfully'
        ]);
    }

    /**
     * @OA\Post(
     *     path="/formations",
     *     summary="Create a new formation",
     *     description="Store a newly created formation. Defenders, midfielders, and forwards must total 10 outfield players.",
     *     operationId="storeFormation",
     *     tags={"Formations"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name", "display_name", "positions", "style", "defenders_count", "midfielders_count", "forwards_count"},
     *             @OA\Property(property="name", type="string", maxLength=20, example="4-3-3"),
     *             @OA\Property(property="display_name", type="string", maxLength=100, example="4-3-3 Attacking"),
     *             @OA\Property(property="description", type="string", maxLength=500, nullable=true),
     *             @OA\Property(property="positions", type="array", minItems=11, maxItems=11,
     *                 @OA\Items(
     *                     @OA\Property(property="x", type="integer", minimum=0, maximum=100),
     *                     @OA\Property(property="y", type="integer", minimum=0, maximum=100),
     *                     @OA\Property(property="position", type="string", maxLength=3, example="CB")
     *                 )
     *             ),
     *             @OA\Property(property="style", type="string", enum={"defensive", "balanced", "attacking"}),
     *             @OA\Property(property="defenders_count", type="integer", minimum=3, maximum=6),
     *             @OA\Property(property="midfielders_count", type="integer", minimum=2, maximum=6),
     *             @OA\Property(property="forwards_count", type="integer", minimum=1, maximum=4),
     *             @OA\Property(property="is_active", type="boolean")
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Formation created successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="id", type="integer"),
     *                 @OA\Property(property="name", type="string"),
     *                 @OA\Property(property="display_name", type="string"),
     *                 @OA\Property(property="style", type="string"),
     *                 @OA\Property(property="is_active", type="boolean")
     *             ),
     *             @OA\Property(property="message", type="string", example="Formation created successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error (e.g. defenders + midfielders + forwards must total 10)",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Defenders, midfielders, and forwards must total 10 players")
     *         )
     *     )
     * )
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:20|unique:formations',
            'display_name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'positions' => 'required|array|size:11',
            'positions.*.x' => 'required|integer|min:0|max:100',
            'positions.*.y' => 'required|integer|min:0|max:100',
            'positions.*.position' => 'required|string|max:3',
            'style' => 'required|in:defensive,balanced,attacking',
            'defenders_count' => 'required|integer|min:3|max:6',
            'midfielders_count' => 'required|integer|min:2|max:6',
            'forwards_count' => 'required|integer|min:1|max:4',
            'is_active' => 'boolean',
        ]);

        // Validate that defenders + midfielders + forwards = 10 (excluding GK)
        $totalOutfield = $validated['defenders_count'] + $validated['midfielders_count'] + $validated['forwards_count'];
        if ($totalOutfield !== 10) {
            return response()->json([
                'success' => false,
                'message' => 'Defenders, midfielders, and forwards must total 10 players'
            ], 422);
        }

        $formation = Formation::create($validated);

        return response()->json([
            'success' => true,
            'data' => $formation,
            'message' => 'Formation created successfully'
        ], 201);
    }

    /**
     * @OA\Get(
     *     path="/formations/{formation}",
     *     summary="Get a specific formation",
     *     description="Retrieve a single formation by ID, including its associated tactics.",
     *     operationId="showFormation",
     *     tags={"Formations"},
     *     @OA\Parameter(
     *         name="formation",
     *         in="path",
     *         required=true,
     *         description="Formation ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Formation retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="id", type="integer"),
     *                 @OA\Property(property="name", type="string"),
     *                 @OA\Property(property="display_name", type="string"),
     *                 @OA\Property(property="style", type="string"),
     *                 @OA\Property(property="tactics", type="array", @OA\Items(type="object"))
     *             ),
     *             @OA\Property(property="message", type="string", example="Formation retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Formation not found"
     *     )
     * )
     */
    public function show(Formation $formation): JsonResponse
    {
        $formation->load(['tactics']);

        return response()->json([
            'success' => true,
            'data' => $formation,
            'message' => 'Formation retrieved successfully'
        ]);
    }

    /**
     * @OA\Put(
     *     path="/formations/{formation}",
     *     summary="Update a formation",
     *     description="Update an existing formation. All fields are optional (uses 'sometimes' validation). If position counts are updated, they must still total 10.",
     *     operationId="updateFormation",
     *     tags={"Formations"},
     *     @OA\Parameter(
     *         name="formation",
     *         in="path",
     *         required=true,
     *         description="Formation ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="name", type="string", maxLength=20),
     *             @OA\Property(property="display_name", type="string", maxLength=100),
     *             @OA\Property(property="description", type="string", maxLength=500, nullable=true),
     *             @OA\Property(property="positions", type="array", minItems=11, maxItems=11,
     *                 @OA\Items(
     *                     @OA\Property(property="x", type="integer", minimum=0, maximum=100),
     *                     @OA\Property(property="y", type="integer", minimum=0, maximum=100),
     *                     @OA\Property(property="position", type="string", maxLength=3)
     *                 )
     *             ),
     *             @OA\Property(property="style", type="string", enum={"defensive", "balanced", "attacking"}),
     *             @OA\Property(property="defenders_count", type="integer", minimum=3, maximum=6),
     *             @OA\Property(property="midfielders_count", type="integer", minimum=2, maximum=6),
     *             @OA\Property(property="forwards_count", type="integer", minimum=1, maximum=4),
     *             @OA\Property(property="is_active", type="boolean")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Formation updated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object"),
     *             @OA\Property(property="message", type="string", example="Formation updated successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Formation not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error"
     *     )
     * )
     */
    public function update(Request $request, Formation $formation): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:20|unique:formations,name,' . $formation->id,
            'display_name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'positions' => 'sometimes|array|size:11',
            'positions.*.x' => 'required_with:positions|integer|min:0|max:100',
            'positions.*.y' => 'required_with:positions|integer|min:0|max:100',
            'positions.*.position' => 'required_with:positions|string|max:3',
            'style' => 'sometimes|in:defensive,balanced,attacking',
            'defenders_count' => 'sometimes|integer|min:3|max:6',
            'midfielders_count' => 'sometimes|integer|min:2|max:6',
            'forwards_count' => 'sometimes|integer|min:1|max:4',
            'is_active' => 'boolean',
        ]);

        // Validate total if any count is being updated
        if (isset($validated['defenders_count']) || isset($validated['midfielders_count']) || isset($validated['forwards_count'])) {
            $defendersCount = $validated['defenders_count'] ?? $formation->defenders_count;
            $midfieldersCount = $validated['midfielders_count'] ?? $formation->midfielders_count;
            $forwardsCount = $validated['forwards_count'] ?? $formation->forwards_count;

            $totalOutfield = $defendersCount + $midfieldersCount + $forwardsCount;
            if ($totalOutfield !== 10) {
                return response()->json([
                    'success' => false,
                    'message' => 'Defenders, midfielders, and forwards must total 10 players'
                ], 422);
            }
        }

        $formation->update($validated);

        return response()->json([
            'success' => true,
            'data' => $formation,
            'message' => 'Formation updated successfully'
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/formations/{formation}",
     *     summary="Delete a formation",
     *     description="Remove the specified formation from the system.",
     *     operationId="destroyFormation",
     *     tags={"Formations"},
     *     @OA\Parameter(
     *         name="formation",
     *         in="path",
     *         required=true,
     *         description="Formation ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Formation deleted successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Formation deleted successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Formation not found"
     *     )
     * )
     */
    public function destroy(Formation $formation): JsonResponse
    {
        $formation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Formation deleted successfully'
        ]);
    }

    /**
     * @OA\Get(
     *     path="/formations/style/grouped",
     *     summary="Get formations grouped by style",
     *     description="Retrieve all active formations grouped by their tactical style (defensive, balanced, attacking).",
     *     operationId="getFormationsGroupedByStyle",
     *     tags={"Formations"},
     *     @OA\Response(
     *         response=200,
     *         description="Formations grouped by style retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="defensive", type="array", @OA\Items(type="object")),
     *                 @OA\Property(property="balanced", type="array", @OA\Items(type="object")),
     *                 @OA\Property(property="attacking", type="array", @OA\Items(type="object"))
     *             ),
     *             @OA\Property(property="message", type="string", example="Formations grouped by style retrieved successfully")
     *         )
     *     )
     * )
     */
    public function byStyle(): JsonResponse
    {
        $formations = Formation::where('is_active', true)
            ->get()
            ->groupBy('style');

        return response()->json([
            'success' => true,
            'data' => $formations,
            'message' => 'Formations grouped by style retrieved successfully'
        ]);
    }

    /**
     * @OA\Get(
     *     path="/formations/{formation}/visualization",
     *     summary="Get formation visualization data",
     *     description="Retrieve visualization data for a formation including field positions, tactical setup lines (defensive, midfield, attacking), and width analysis (left flank, center, right flank).",
     *     operationId="getFormationVisualization",
     *     tags={"Formations"},
     *     @OA\Parameter(
     *         name="formation",
     *         in="path",
     *         required=true,
     *         description="Formation ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Formation visualization data retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="formation", type="object"),
     *                 @OA\Property(property="field_positions", type="array", @OA\Items(
     *                     @OA\Property(property="x", type="integer"),
     *                     @OA\Property(property="y", type="integer"),
     *                     @OA\Property(property="position", type="string")
     *                 )),
     *                 @OA\Property(property="tactical_setup", type="object",
     *                     @OA\Property(property="defensive_line", type="number"),
     *                     @OA\Property(property="midfield_line", type="number"),
     *                     @OA\Property(property="attacking_line", type="number")
     *                 ),
     *                 @OA\Property(property="width_analysis", type="object",
     *                     @OA\Property(property="left_flank", type="integer"),
     *                     @OA\Property(property="center", type="integer"),
     *                     @OA\Property(property="right_flank", type="integer")
     *                 )
     *             ),
     *             @OA\Property(property="message", type="string", example="Formation visualization data retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Formation not found"
     *     )
     * )
     */
    public function visualization(Formation $formation): JsonResponse
    {
        $visualizationData = [
            'formation' => $formation,
            'field_positions' => $formation->positions,
            'tactical_setup' => [
                'defensive_line' => $formation->positions->where('position', 'CB')->avg('y'),
                'midfield_line' => $formation->positions->whereIn('position', ['CM', 'DM', 'AM'])->avg('y'),
                'attacking_line' => $formation->positions->whereIn('position', ['ST', 'CF'])->avg('y'),
            ],
            'width_analysis' => [
                'left_flank' => $formation->positions->where('x', '<', 30)->count(),
                'center' => $formation->positions->whereBetween('x', [30, 70])->count(),
                'right_flank' => $formation->positions->where('x', '>', 70)->count(),
            ]
        ];

        return response()->json([
            'success' => true,
            'data' => $visualizationData,
            'message' => 'Formation visualization data retrieved successfully'
        ]);
    }

    /**
     * @OA\Get(
     *     path="/formations/{formation}/sample-instructions",
     *     summary="Get sample tactical instructions for a formation",
     *     description="Retrieve sample tactical instructions associated with a formation, including the formation's basic info and whether sample instructions are available.",
     *     operationId="getFormationSampleInstructions",
     *     tags={"Formations"},
     *     @OA\Parameter(
     *         name="formation",
     *         in="path",
     *         required=true,
     *         description="Formation ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Formation sample instructions retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="formation", type="object",
     *                     @OA\Property(property="id", type="integer"),
     *                     @OA\Property(property="name", type="string"),
     *                     @OA\Property(property="display_name", type="string"),
     *                     @OA\Property(property="style", type="string")
     *                 ),
     *                 @OA\Property(property="sample_instructions", type="object"),
     *                 @OA\Property(property="has_sample_instructions", type="boolean")
     *             ),
     *             @OA\Property(property="message", type="string", example="Formation sample instructions retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Formation not found"
     *     )
     * )
     */
    public function sampleInstructions(Formation $formation): JsonResponse
    {
        $sampleInstructions = $formation->getSampleInstructions();

        return response()->json([
            'success' => true,
            'data' => [
                'formation' => $formation->only(['id', 'name', 'display_name', 'style']),
                'sample_instructions' => $sampleInstructions,
                'has_sample_instructions' => $formation->hasSampleInstructions()
            ],
            'message' => 'Formation sample instructions retrieved successfully'
        ]);
    }
}
