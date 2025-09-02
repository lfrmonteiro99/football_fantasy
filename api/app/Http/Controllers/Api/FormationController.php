<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Formation;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FormationController extends Controller
{
    /**
     * Display a listing of formations.
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
     * Store a newly created formation.
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
     * Display the specified formation.
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
     * Update the specified formation.
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
     * Remove the specified formation.
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
     * Get formations grouped by style.
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
     * Get formation visualization data.
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
     * Get sample tactical instructions for a formation.
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
