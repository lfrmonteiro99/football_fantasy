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
