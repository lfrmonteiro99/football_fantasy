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