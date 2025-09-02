<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Season;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class SeasonController extends Controller
{
    /**
     * Get all seasons.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $seasons = Season::orderBy('start_date', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $seasons,
        ]);
    }

    /**
     * Get a specific season.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show(int $id): JsonResponse
    {
        $season = Season::with('matches')->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $season,
        ]);
    }

    /**
     * Get the current season.
     *
     * @return JsonResponse
     */
    public function current(): JsonResponse
    {
        $season = Season::where('is_current', true)->first();

        if (!$season) {
            return response()->json([
                'status' => 'error',
                'message' => 'No current season found',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $season,
        ]);
    }
}
