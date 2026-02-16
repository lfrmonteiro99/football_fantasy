<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PositionController extends Controller
{
    /**
     * Display a listing of positions.
     *
     * @OA\Get(
     *     path="/positions",
     *     operationId="listPositions",
     *     tags={"Positions"},
     *     summary="List all positions",
     *     description="Returns all positions with primary player counts. Optionally filter by category.",
     *     @OA\Parameter(
     *         name="category",
     *         in="query",
     *         description="Filter by position category",
     *         required=false,
     *         @OA\Schema(type="string", enum={"goalkeeper", "defender", "midfielder", "forward"})
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Positions retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="array", @OA\Items(type="object",
     *                 @OA\Property(property="id", type="integer"),
     *                 @OA\Property(property="name", type="string", example="Centre Back"),
     *                 @OA\Property(property="short_name", type="string", example="CB"),
     *                 @OA\Property(property="category", type="string", example="defender"),
     *                 @OA\Property(property="primary_players_count", type="integer", example=42)
     *             )),
     *             @OA\Property(property="message", type="string", example="Positions retrieved successfully")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = Position::query();

        // Filter by category if provided
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Include player count
        $query->withCount('primaryPlayers');

        $positions = $query->orderBy('category')->get();

        return response()->json([
            'success' => true,
            'data' => $positions,
            'message' => 'Positions retrieved successfully'
        ]);
    }

    /**
     * Store a newly created position.
     *
     * @OA\Post(
     *     path="/positions",
     *     operationId="createPosition",
     *     tags={"Positions"},
     *     summary="Create a new position",
     *     description="Creates a new player position with a name, short name, category, and key attributes.",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name", "short_name", "category", "key_attributes"},
     *             @OA\Property(property="name", type="string", maxLength=100, description="Full position name (must be unique)", example="Centre Back"),
     *             @OA\Property(property="short_name", type="string", maxLength=3, description="Short abbreviation (must be unique)", example="CB"),
     *             @OA\Property(property="category", type="string", enum={"goalkeeper", "defender", "midfielder", "forward"}, example="defender"),
     *             @OA\Property(property="key_attributes", type="array", minItems=3, @OA\Items(type="string", maxLength=50), description="Key attributes for this position (minimum 3)", example={"tackling", "heading", "positioning"})
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Position created successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Created position"),
     *             @OA\Property(property="message", type="string", example="Position created successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error (e.g., duplicate name/short_name, missing key_attributes)"
     *     )
     * )
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:positions',
            'short_name' => 'required|string|max:3|unique:positions',
            'category' => 'required|in:goalkeeper,defender,midfielder,forward',
            'key_attributes' => 'required|array|min:3',
            'key_attributes.*' => 'string|max:50',
        ]);

        $position = Position::create($validated);

        return response()->json([
            'success' => true,
            'data' => $position,
            'message' => 'Position created successfully'
        ], 201);
    }

    /**
     * Display the specified position.
     *
     * @OA\Get(
     *     path="/positions/{position}",
     *     operationId="getPosition",
     *     tags={"Positions"},
     *     summary="Get a specific position",
     *     description="Returns a single position with its primary players, including each player's team and attributes.",
     *     @OA\Parameter(
     *         name="position",
     *         in="path",
     *         description="Position ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Position retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Position with primary players (including team and attributes)"),
     *             @OA\Property(property="message", type="string", example="Position retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Position not found"
     *     )
     * )
     */
    public function show(Position $position): JsonResponse
    {
        $position->load(['primaryPlayers.team', 'primaryPlayers.attributes']);

        return response()->json([
            'success' => true,
            'data' => $position,
            'message' => 'Position retrieved successfully'
        ]);
    }

    /**
     * Update the specified position.
     *
     * @OA\Put(
     *     path="/positions/{position}",
     *     operationId="updatePosition",
     *     tags={"Positions"},
     *     summary="Update an existing position",
     *     description="Updates a position's details. All fields are optional (uses 'sometimes' validation). Uniqueness constraints on name and short_name exclude the current record.",
     *     @OA\Parameter(
     *         name="position",
     *         in="path",
     *         description="Position ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="name", type="string", maxLength=100, example="Wide Midfielder"),
     *             @OA\Property(property="short_name", type="string", maxLength=3, example="WM"),
     *             @OA\Property(property="category", type="string", enum={"goalkeeper", "defender", "midfielder", "forward"}),
     *             @OA\Property(property="key_attributes", type="array", minItems=3, @OA\Items(type="string", maxLength=50))
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Position updated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Updated position"),
     *             @OA\Property(property="message", type="string", example="Position updated successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Position not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error"
     *     )
     * )
     */
    public function update(Request $request, Position $position): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100|unique:positions,name,' . $position->id,
            'short_name' => 'sometimes|string|max:3|unique:positions,short_name,' . $position->id,
            'category' => 'sometimes|in:goalkeeper,defender,midfielder,forward',
            'key_attributes' => 'sometimes|array|min:3',
            'key_attributes.*' => 'string|max:50',
        ]);

        $position->update($validated);

        return response()->json([
            'success' => true,
            'data' => $position,
            'message' => 'Position updated successfully'
        ]);
    }

    /**
     * Remove the specified position.
     *
     * @OA\Delete(
     *     path="/positions/{position}",
     *     operationId="deletePosition",
     *     tags={"Positions"},
     *     summary="Delete a position",
     *     description="Permanently deletes a position from the system.",
     *     @OA\Parameter(
     *         name="position",
     *         in="path",
     *         description="Position ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Position deleted successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Position deleted successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Position not found"
     *     )
     * )
     */
    public function destroy(Position $position): JsonResponse
    {
        $position->delete();

        return response()->json([
            'success' => true,
            'message' => 'Position deleted successfully'
        ]);
    }

    /**
     * Get positions grouped by category.
     *
     * @OA\Get(
     *     path="/positions/category/grouped",
     *     operationId="getPositionsGroupedByCategory",
     *     tags={"Positions"},
     *     summary="Get positions grouped by category",
     *     description="Returns all positions organized into groups by their category (goalkeeper, defender, midfielder, forward).",
     *     @OA\Response(
     *         response=200,
     *         description="Positions grouped by category retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="goalkeeper", type="array", @OA\Items(type="object"), description="Goalkeeper positions"),
     *                 @OA\Property(property="defender", type="array", @OA\Items(type="object"), description="Defender positions"),
     *                 @OA\Property(property="midfielder", type="array", @OA\Items(type="object"), description="Midfielder positions"),
     *                 @OA\Property(property="forward", type="array", @OA\Items(type="object"), description="Forward positions")
     *             ),
     *             @OA\Property(property="message", type="string", example="Positions grouped by category retrieved successfully")
     *         )
     *     )
     * )
     */
    public function byCategory(): JsonResponse
    {
        $positions = Position::all()->groupBy('category');

        return response()->json([
            'success' => true,
            'data' => $positions,
            'message' => 'Positions grouped by category retrieved successfully'
        ]);
    }
}
