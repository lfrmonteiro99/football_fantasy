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
     * @OA\Get(
     *     path="/seasons",
     *     operationId="getSeasons",
     *     tags={"Seasons"},
     *     summary="List all seasons",
     *     description="Returns all seasons ordered by start date descending.",
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="array", @OA\Items(type="object"))
     *         )
     *     )
     * )
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
     * @OA\Get(
     *     path="/seasons/{id}",
     *     operationId="getSeason",
     *     tags={"Seasons"},
     *     summary="Get a specific season",
     *     description="Returns a single season with its associated matches.",
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Season ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=404, description="Season not found")
     * )
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
     * @OA\Get(
     *     path="/seasons/current",
     *     operationId="getCurrentSeason",
     *     tags={"Seasons"},
     *     summary="Get the current active season",
     *     description="Returns the season that is marked as current. Returns 404 if no current season is set.",
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="No current season found",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string", example="error"),
     *             @OA\Property(property="message", type="string", example="No current season found")
     *         )
     *     )
     * )
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
