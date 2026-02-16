<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TimeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeController extends Controller
{
    private TimeService $timeService;

    public function __construct(TimeService $timeService)
    {
        $this->timeService = $timeService;
    }

    /**
     * Advance time by one day.
     *
     * @OA\Post(
     *     path="/time/advance-day",
     *     operationId="advanceDay",
     *     tags={"Time"},
     *     summary="Advance the game clock by one day",
     *     description="Advances the in-game date by one day for the specified team. Returns a status message and the next upcoming match if one exists.",
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"team_id"},
     *             @OA\Property(property="team_id", type="integer", example=1, description="ID of the team to advance time for")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Time advanced successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Advanced to next day"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="message", type="string", example="Advanced to next day"),
     *                 @OA\Property(property="next_match", type="object", nullable=true, description="Next match with homeTeam, awayTeam, and league loaded")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="The team id field is required."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Error advancing time: error details")
     *         )
     *     )
     * )
     */
    public function advanceDay(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'team_id' => 'required|exists:teams,id',
            ]);

            $teamId = $validated['team_id'];
            $userId = $request->user()->id;
            $result = $this->timeService->advanceDay($teamId, $userId);

            // Load relationships for the next match
            if ($result['next_match']) {
                $result['next_match']->load(['homeTeam', 'awayTeam', 'league']);
            }

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'data' => $result
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error advancing time: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Advance time intelligently to next significant event.
     *
     * @OA\Post(
     *     path="/time/advance-to-match",
     *     operationId="advanceToMatch",
     *     tags={"Time"},
     *     summary="Advance game time to the next match day",
     *     description="Jumps the in-game date forward to the next significant event (typically the next match day) for the specified team. Returns a status message and the next upcoming match.",
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"team_id"},
     *             @OA\Property(property="team_id", type="integer", example=1, description="ID of the team to advance time for")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Time advanced successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Advanced to match day"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="message", type="string", example="Advanced to match day"),
     *                 @OA\Property(property="next_match", type="object", nullable=true, description="Next match with homeTeam, awayTeam, and league loaded")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="The team id field is required."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Error advancing time: error details")
     *         )
     *     )
     * )
     */
    public function advanceToMatch(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'team_id' => 'required|exists:teams,id',
            ]);

            $teamId = $validated['team_id'];
            $userId = $request->user()->id;
            $result = $this->timeService->advanceToNextEvent($teamId, $userId);

            // Load relationships for the next match
            if ($result['next_match']) {
                $result['next_match']->load(['homeTeam', 'awayTeam', 'league']);
            }

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'data' => $result
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error advancing time: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get current game date and next match information.
     *
     * @OA\Get(
     *     path="/time/current-date",
     *     operationId="getCurrentDate",
     *     tags={"Time"},
     *     summary="Get the current in-game date and next match info",
     *     description="Returns the current game date for the authenticated user. If a team_id is provided, also returns the next match for that team, days until the match, and whether it is match day.",
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="team_id",
     *         in="query",
     *         required=false,
     *         description="Optional team ID to include next-match information",
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Current date retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="current_date", type="string", format="date", example="2025-09-15"),
     *                 @OA\Property(property="formatted_date", type="string", example="Monday, September 15, 2025"),
     *                 @OA\Property(property="next_match", type="object", nullable=true, description="Next match with homeTeam, awayTeam, and league loaded (only present when team_id is provided)"),
     *                 @OA\Property(property="days_until_match", type="integer", nullable=true, example=3, description="Days until the next match (only present when team_id is provided)"),
     *                 @OA\Property(property="match_day", type="boolean", nullable=true, example=false, description="Whether today is match day (only present when team_id is provided)")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Error getting current date: error details")
     *         )
     *     )
     * )
     */
    public function getCurrentDate(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'team_id' => 'nullable|exists:teams,id',
            ]);

            $teamId = $validated['team_id'] ?? null;
            $userId = $request->user()->id;
            $currentDate = $this->timeService->getCurrentGameDate($userId);

            $data = [
                'current_date' => $currentDate->format('Y-m-d'),
                'formatted_date' => $currentDate->format('l, F j, Y')
            ];

            if ($teamId) {
                $nextMatch = $this->timeService->getNextMatchForTeam($teamId);
                $daysUntilMatch = $this->timeService->getDaysUntilNextMatch($teamId, $userId);

                if ($nextMatch) {
                    $nextMatch->load(['homeTeam', 'awayTeam', 'league']);
                }

                $data = array_merge($data, [
                    'next_match' => $nextMatch,
                    'days_until_match' => $daysUntilMatch,
                    'match_day' => $daysUntilMatch === 0
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => $data
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error getting current date: ' . $e->getMessage()
            ], 500);
        }
    }
}
