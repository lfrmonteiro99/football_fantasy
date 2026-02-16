<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Tactic;
use App\Services\MatchSimulatorService;
use App\Jobs\SimulateMatchJob;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class MatchSimulatorController extends Controller
{
    private MatchSimulatorService $simulatorService;

    public function __construct(MatchSimulatorService $simulatorService)
    {
        $this->simulatorService = $simulatorService;
    }

    /**
     * Simulate a match between two teams.
     *
     * @OA\Post(
     *     path="/simulator/simulate",
     *     summary="Simulate a match between two teams",
     *     description="Runs a full match simulation synchronously using the provided teams, tactics, weather, and options. Returns the complete match result.",
     *     operationId="simulatorSimulateMatch",
     *     tags={"Simulator"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"home_team_id", "away_team_id"},
     *             @OA\Property(property="home_team_id", type="integer", example=1, description="ID of the home team"),
     *             @OA\Property(property="away_team_id", type="integer", example=2, description="ID of the away team"),
     *             @OA\Property(property="home_tactic_id", type="integer", nullable=true, example=1, description="ID of the home team tactic"),
     *             @OA\Property(property="away_tactic_id", type="integer", nullable=true, example=2, description="ID of the away team tactic"),
     *             @OA\Property(property="weather", type="string", enum={"normal", "rainy", "snowy", "windy"}, nullable=true, default="normal", description="Weather condition for the match"),
     *             @OA\Property(property="stadium", type="string", nullable=true, example="Estadio da Luz", description="Stadium name"),
     *             @OA\Property(
     *                 property="options",
     *                 type="object",
     *                 nullable=true,
     *                 description="Simulation options",
     *                 @OA\Property(property="tickRate", type="integer", minimum=1, maximum=120, example=60),
     *                 @OA\Property(property="enableCommentary", type="boolean", example=true),
     *                 @OA\Property(property="enableStatistics", type="boolean", example=true),
     *                 @OA\Property(property="enableFatigue", type="boolean", example=true),
     *                 @OA\Property(property="enableMomentum", type="boolean", example=true),
     *                 @OA\Property(property="enableWeather", type="boolean", example=false)
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Match simulation result",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Full match result data")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Simulation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Match simulation failed"),
     *             @OA\Property(property="error", type="string")
     *         )
     *     ),
     *     @OA\Response(
     *         response=503,
     *         description="Simulator service unavailable",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Match simulator service is unavailable")
     *         )
     *     )
     * )
     */
    public function simulateMatch(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'home_team_id' => 'required|exists:teams,id',
                'away_team_id' => 'required|exists:teams,id',
                'home_tactic_id' => 'nullable|exists:tactics,id',
                'away_tactic_id' => 'nullable|exists:tactics,id',
                'weather' => 'nullable|string|in:normal,rainy,snowy,windy',
                'stadium' => 'nullable|string',
                'options' => 'nullable|array',
                'options.tickRate' => 'nullable|integer|min:1|max:120',
                'options.enableCommentary' => 'nullable|boolean',
                'options.enableStatistics' => 'nullable|boolean',
                'options.enableFatigue' => 'nullable|boolean',
                'options.enableMomentum' => 'nullable|boolean',
                'options.enableWeather' => 'nullable|boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Load teams with players and attributes
            $homeTeam = Team::with(['players.primaryPosition', 'players.attributes'])->findOrFail($request->home_team_id);
            $awayTeam = Team::with(['players.primaryPosition', 'players.attributes'])->findOrFail($request->away_team_id);

            // Load tactics if provided
            $homeTactic = null;
            $awayTactic = null;

            if ($request->home_tactic_id) {
                $homeTactic = Tactic::with(['custom_positions', 'player_assignments'])->find($request->home_tactic_id);
            }

            if ($request->away_tactic_id) {
                $awayTactic = Tactic::with(['custom_positions', 'player_assignments'])->find($request->away_tactic_id);
            }

            // Check if simulator service is healthy
            if (!$this->simulatorService->isHealthy()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Match simulator service is unavailable'
                ], 503);
            }

            // Build options
            $options = array_merge([
                'weather' => $request->weather ?? 'normal',
                'stadium' => $request->stadium ?? 'default'
            ], $request->options ?? []);

            // Simulate the match
            $result = $this->simulatorService->simulateMatch(
                $homeTeam,
                $awayTeam,
                $homeTactic,
                $awayTactic,
                $options
            );

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Match simulation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Match simulation failed',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Simulate a match in real-time mode.
     *
     * @OA\Post(
     *     path="/simulator/simulate-realtime",
     *     summary="Simulate a match in real-time mode",
     *     description="Runs a match simulation with real-time settings enabled (commentary, statistics, fatigue, and momentum). Returns the complete match result.",
     *     operationId="simulateRealTimeMatch",
     *     tags={"Simulator"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"home_team_id", "away_team_id"},
     *             @OA\Property(property="home_team_id", type="integer", example=1, description="ID of the home team"),
     *             @OA\Property(property="away_team_id", type="integer", example=2, description="ID of the away team"),
     *             @OA\Property(property="home_tactic_id", type="integer", nullable=true, example=1, description="ID of the home team tactic"),
     *             @OA\Property(property="away_tactic_id", type="integer", nullable=true, example=2, description="ID of the away team tactic"),
     *             @OA\Property(property="weather", type="string", enum={"normal", "rainy", "snowy", "windy"}, nullable=true, default="normal", description="Weather condition for the match"),
     *             @OA\Property(property="stadium", type="string", nullable=true, example="Estadio da Luz", description="Stadium name")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Real-time match simulation result",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Full match result data including final_score")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Simulation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Real-time match simulation failed"),
     *             @OA\Property(property="error", type="string")
     *         )
     *     ),
     *     @OA\Response(
     *         response=503,
     *         description="Simulator service unavailable",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Match simulator service is unavailable")
     *         )
     *     )
     * )
     */
    public function simulateRealTimeMatch(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'home_team_id' => 'required|exists:teams,id',
                'away_team_id' => 'required|exists:teams,id',
                'home_tactic_id' => 'nullable|exists:tactics,id',
                'away_tactic_id' => 'nullable|exists:tactics,id',
                'weather' => 'nullable|string|in:normal,rainy,snowy,windy',
                'stadium' => 'nullable|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Load teams with players and attributes
            $homeTeam = Team::with(['players.primaryPosition', 'players.attributes'])->findOrFail($request->home_team_id);
            $awayTeam = Team::with(['players.primaryPosition', 'players.attributes'])->findOrFail($request->away_team_id);

            // Load tactics if provided
            $homeTactic = null;
            $awayTactic = null;

            if ($request->home_tactic_id) {
                $homeTactic = Tactic::with(['custom_positions', 'player_assignments'])->find($request->home_tactic_id);
            }

            if ($request->away_tactic_id) {
                $awayTactic = Tactic::with(['custom_positions', 'player_assignments'])->find($request->away_tactic_id);
            }

            // Check if simulator service is healthy
            if (!$this->simulatorService->isHealthy()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Match simulator service is unavailable'
                ], 503);
            }

            // Build options
            $options = [
                'weather' => $request->weather ?? 'normal',
                'stadium' => $request->stadium ?? 'default',
                'realTime' => true,
                'enableCommentary' => true,
                'enableStatistics' => true,
                'enableFatigue' => true,
                'enableMomentum' => true
            ];

            // Simulate the match in real-time
            $result = $this->simulatorService->simulateRealTimeMatch(
                $homeTeam,
                $awayTeam,
                $homeTactic,
                $awayTactic,
                $options
            );

            Log::info('Real-time match simulation completed', [
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name,
                'final_score' => $result['data']['final_score'] ?? null
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Real-time match simulation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Real-time match simulation failed',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check simulator service health.
     *
     * @OA\Get(
     *     path="/simulator/health",
     *     summary="Check simulator service health",
     *     description="Returns the current health status of the match simulator service along with a timestamp.",
     *     operationId="simulatorHealth",
     *     tags={"Simulator"},
     *     @OA\Response(
     *         response=200,
     *         description="Health status",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="simulator_healthy", type="boolean", example=true),
     *                 @OA\Property(property="timestamp", type="string", format="date-time", example="2026-02-16T12:00:00.000000Z")
     *             )
     *         )
     *     )
     * )
     */
    public function health(): JsonResponse
    {
        try {
            $isHealthy = $this->simulatorService->isHealthy();

            return response()->json([
                'success' => true,
                'data' => [
                    'simulator_healthy' => $isHealthy,
                    'timestamp' => now()->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'data' => [
                    'simulator_healthy' => false,
                    'error' => $e->getMessage(),
                    'timestamp' => now()->toISOString()
                ]
            ]);
        }
    }

    /**
     * Simulate a match with streaming updates.
     *
     * @OA\Post(
     *     path="/simulator/simulate-streaming",
     *     summary="Simulate a match with streaming updates",
     *     description="Starts a match simulation with streaming updates. If the server is under high load (max concurrent simulations reached), the simulation is queued and a 202 response is returned with a queue position. Otherwise, the simulation streams immediately with a 200 response.",
     *     operationId="simulateStreamingMatch",
     *     tags={"Simulator"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"home_team_id", "away_team_id"},
     *             @OA\Property(property="home_team_id", type="integer", example=1, description="ID of the home team"),
     *             @OA\Property(property="away_team_id", type="integer", example=2, description="ID of the away team"),
     *             @OA\Property(property="home_tactic_id", type="integer", nullable=true, example=1, description="ID of the home team tactic"),
     *             @OA\Property(property="away_tactic_id", type="integer", nullable=true, example=2, description="ID of the away team tactic"),
     *             @OA\Property(property="weather", type="string", enum={"normal", "rainy", "snowy", "windy"}, nullable=true, default="normal", description="Weather condition for the match"),
     *             @OA\Property(property="stadium", type="string", nullable=true, example="Estadio da Luz", description="Stadium name"),
     *             @OA\Property(property="options", type="object", nullable=true, description="Simulation options")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Streaming simulation started immediately"
     *     ),
     *     @OA\Response(
     *         response=202,
     *         description="Simulation queued due to high server load",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Simulation queued due to high load"),
     *             @OA\Property(property="simulation_id", type="string"),
     *             @OA\Property(property="estimated_wait_time", type="integer", description="Estimated wait in seconds", example=270),
     *             @OA\Property(property="queue_position", type="integer", example=4)
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Simulation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Streaming match simulation failed"),
     *             @OA\Property(property="error", type="string")
     *         )
     *     ),
     *     @OA\Response(
     *         response=503,
     *         description="Simulator service unavailable",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Match simulator service is unavailable")
     *         )
     *     )
     * )
     */
    public function simulateStreamingMatch(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'home_team_id' => 'required|exists:teams,id',
                'away_team_id' => 'required|exists:teams,id',
                'home_tactic_id' => 'nullable|exists:tactics,id',
                'away_tactic_id' => 'nullable|exists:tactics,id',
                'weather' => 'nullable|string|in:normal,rainy,snowy,windy',
                'stadium' => 'nullable|string',
                'options' => 'nullable|array'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Load teams with players and attributes
            $homeTeam = Team::with(['players.primaryPosition', 'players.attributes'])->findOrFail($request->home_team_id);
            $awayTeam = Team::with(['players.primaryPosition', 'players.attributes'])->findOrFail($request->away_team_id);

            // Load tactics if provided
            $homeTactic = null;
            $awayTactic = null;

            if ($request->home_tactic_id) {
                $homeTactic = Tactic::with(['custom_positions', 'player_assignments'])->find($request->home_tactic_id);
            }

            if ($request->away_tactic_id) {
                $awayTactic = Tactic::with(['custom_positions', 'player_assignments'])->find($request->away_tactic_id);
            }

            // Check if simulator service is healthy
            if (!$this->simulatorService->isHealthy()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Match simulator service is unavailable'
                ], 503);
            }

            // Build options
            $options = array_merge([
                'weather' => $request->weather ?? 'normal',
                'stadium' => $request->stadium ?? 'default',
                'realTime' => true,
                'enableCommentary' => true,
                'enableStatistics' => true,
                'enableFatigue' => true,
                'enableMomentum' => true
            ], $request->options ?? []);

            Log::info('Starting streaming simulation via Laravel API', [
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name,
                'home_players_count' => $homeTeam->players->count(),
                'away_players_count' => $awayTeam->players->count(),
                'has_home_tactic' => !is_null($homeTactic),
                'has_away_tactic' => !is_null($awayTactic)
            ]);

            // Check system load and decide on execution strategy
            $concurrentSimulations = $this->simulatorService->getConcurrentSimulationsCount();
            $maxConcurrent = config('services.match_simulator.max_concurrent', 3);

            if ($concurrentSimulations >= $maxConcurrent) {
                // Queue the simulation for later processing
                $simulationId = $this->simulatorService->queueSimulation(
                    $homeTeam,
                    $awayTeam,
                    $homeTactic,
                    $awayTactic,
                    $options
                );

                return response()->json([
                    'success' => true,
                    'message' => 'Simulation queued due to high load',
                    'simulation_id' => $simulationId,
                    'estimated_wait_time' => $concurrentSimulations * 90, // seconds
                    'queue_position' => $concurrentSimulations + 1
                ], 202); // 202 Accepted
            }

            // Stream the match simulation immediately
            return $this->simulatorService->simulateStreamingMatch(
                $homeTeam,
                $awayTeam,
                $homeTactic,
                $awayTactic,
                $options
            );

        } catch (\Exception $e) {
            Log::error('Streaming match simulation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Streaming match simulation failed',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Start async match simulation using RabbitMQ.
     *
     * @OA\Post(
     *     path="/simulator/simulate-async",
     *     summary="Start an asynchronous match simulation",
     *     description="Queues a match simulation job via RabbitMQ for background processing. Returns immediately with a job ID and status URL for polling.",
     *     operationId="simulateMatchAsync",
     *     tags={"Simulator"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"home_team_id", "away_team_id"},
     *             @OA\Property(property="home_team_id", type="integer", example=1, description="ID of the home team"),
     *             @OA\Property(property="away_team_id", type="integer", example=2, description="ID of the away team"),
     *             @OA\Property(property="home_tactic_id", type="integer", nullable=true, example=1, description="ID of the home team tactic"),
     *             @OA\Property(property="away_tactic_id", type="integer", nullable=true, example=2, description="ID of the away team tactic"),
     *             @OA\Property(property="weather", type="string", enum={"normal", "rainy", "snowy", "windy"}, nullable=true, default="normal", description="Weather condition for the match"),
     *             @OA\Property(property="stadium", type="string", nullable=true, example="Estadio da Luz", description="Stadium name"),
     *             @OA\Property(property="options", type="object", nullable=true, description="Simulation options")
     *         )
     *     ),
     *     @OA\Response(
     *         response=202,
     *         description="Simulation job accepted and queued",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Match simulation started"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="job_id", type="string", format="uuid", example="550e8400-e29b-41d4-a716-446655440000"),
     *                 @OA\Property(property="status", type="string", example="queued"),
     *                 @OA\Property(property="estimated_duration", type="string", example="90-120 seconds"),
     *                 @OA\Property(property="status_url", type="string", format="uri", example="http://localhost:8000/api/v1/simulator/status/550e8400-e29b-41d4-a716-446655440000")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Failed to queue simulation",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to start match simulation"),
     *             @OA\Property(property="error", type="string")
     *         )
     *     )
     * )
     */
    public function simulateMatchAsync(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'home_team_id' => 'required|exists:teams,id',
                'away_team_id' => 'required|exists:teams,id',
                'home_tactic_id' => 'nullable|exists:tactics,id',
                'away_tactic_id' => 'nullable|exists:tactics,id',
                'weather' => 'nullable|string|in:normal,rainy,snowy,windy',
                'stadium' => 'nullable|string',
                'options' => 'nullable|array'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Generate unique job ID
            $jobId = Str::uuid()->toString();
            $userId = $request->user()?->id ?? 1; // Use user ID 1 as default for unauthenticated requests

            // Prepare match data
            $matchData = [
                'home_team_id' => $request->home_team_id,
                'away_team_id' => $request->away_team_id,
                'home_tactic_id' => $request->home_tactic_id,
                'away_tactic_id' => $request->away_tactic_id,
                'weather' => $request->weather ?? 'normal',
                'stadium' => $request->stadium ?? 'default'
            ];

            $options = array_merge([
                'tickRate' => 60,
                'enableCommentary' => true,
                'enableStatistics' => true,
                'enableFatigue' => true,
                'enableMomentum' => true,
                'enableWeather' => true
            ], $request->options ?? []);

            // Dispatch async job to RabbitMQ
            SimulateMatchJob::dispatch($jobId, $userId, $matchData, $options)
                ->onConnection('rabbitmq')
                ->onQueue('match_simulation');

            // Log job dispatch (Producer side - Controller)
            Log::info('🐰 RABBITMQ PRODUCER: Job dispatched from controller', [
                'job_id' => $jobId,
                'user_id' => $userId,
                'queue' => 'match_simulation',
                'connection' => 'rabbitmq',
                'match_data' => $matchData,
                'options' => $options,
                'request_ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'timestamp' => now()->toISOString(),
                'endpoint' => '/api/v1/simulator/simulate-async'
            ]);

            // Store initial job status
            Cache::put("simulation_job:{$jobId}", [
                'job_id' => $jobId,
                'user_id' => $userId,
                'status' => 'queued',
                'message' => 'Match simulation queued for processing',
                'progress' => 0,
                'timestamp' => now()->toISOString(),
                'match_data' => $matchData
            ], 3600);

            Log::info('Async match simulation queued', [
                'job_id' => $jobId,
                'user_id' => $userId,
                'match_data' => $matchData
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Match simulation started',
                'data' => [
                    'job_id' => $jobId,
                    'status' => 'queued',
                    'estimated_duration' => '90-120 seconds',
                    'status_url' => url("/api/v1/simulator/status/{$jobId}")
                ]
            ], 202);

        } catch (\Exception $e) {
            Log::error('Failed to start async match simulation', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to start match simulation',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get simulation job status.
     *
     * @OA\Get(
     *     path="/simulator/status/{jobId}",
     *     summary="Get the status of an async simulation job",
     *     description="Retrieves the current status and progress of a previously queued simulation job by its UUID.",
     *     operationId="getSimulationStatus",
     *     tags={"Simulator"},
     *     @OA\Parameter(
     *         name="jobId",
     *         in="path",
     *         required=true,
     *         description="UUID of the simulation job",
     *         @OA\Schema(type="string", format="uuid", example="550e8400-e29b-41d4-a716-446655440000")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Job status retrieved",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="job_id", type="string", format="uuid"),
     *                 @OA\Property(property="user_id", type="integer"),
     *                 @OA\Property(property="status", type="string", example="queued", description="One of: queued, processing, completed, failed"),
     *                 @OA\Property(property="message", type="string"),
     *                 @OA\Property(property="progress", type="integer", example=0),
     *                 @OA\Property(property="timestamp", type="string", format="date-time"),
     *                 @OA\Property(property="match_data", type="object")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Simulation job not found",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Simulation job not found")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Failed to retrieve status",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to get simulation status")
     *         )
     *     )
     * )
     */
    public function getSimulationStatus(string $jobId): JsonResponse
    {
        try {
            $status = Cache::get("simulation_job:{$jobId}");

            if (!$status) {
                return response()->json([
                    'success' => false,
                    'message' => 'Simulation job not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $status
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get simulation status', [
                'job_id' => $jobId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get simulation status'
            ], 500);
        }
    }

    /**
     * Stream simulation updates via Server-Sent Events.
     *
     * @OA\Get(
     *     path="/simulator/stream/{jobId}",
     *     summary="Stream simulation updates via Server-Sent Events",
     *     description="Opens an SSE connection to receive real-time updates for an async simulation job. Events emitted: connected, status (progress updates), heartbeat (every 5s), finished (completed/failed), timeout (after 5 minutes).",
     *     operationId="streamSimulationUpdates",
     *     tags={"Simulator"},
     *     @OA\Parameter(
     *         name="jobId",
     *         in="path",
     *         required=true,
     *         description="UUID of the simulation job to stream updates for",
     *         @OA\Schema(type="string", format="uuid", example="550e8400-e29b-41d4-a716-446655440000")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="SSE stream (text/event-stream). Named events: connected (initial handshake), status (job progress updates), heartbeat (keep-alive every 5s), finished (simulation completed or failed), timeout (stream timed out after 5 minutes)."
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Failed to start event stream",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to start event stream"),
     *             @OA\Property(property="error", type="string")
     *         )
     *     )
     * )
     */
    public function streamSimulationUpdates(string $jobId)
    {
        try {
            // Set unlimited execution time for SSE stream
            set_time_limit(0);

            // Set headers for SSE
            $headers = [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Headers' => 'Cache-Control'
            ];

            return response()->stream(function () use ($jobId) {
                // Send initial connection event
                echo "event: connected\n";
                echo "data: {\"message\": \"Connected to simulation stream\", \"job_id\": \"{$jobId}\"}\n\n";
                ob_flush();
                flush();

                $startTime = time();
                $timeout = 300; // 5 minutes timeout
                $lastStatus = null;

                while (time() - $startTime < $timeout) {
                    // Get current job status from cache
                    $status = Cache::get("simulation_job:{$jobId}");

                    if ($status && $status !== $lastStatus) {
                        // Send status update
                        echo "event: status\n";
                        echo "data: " . json_encode($status) . "\n\n";
                        ob_flush();
                        flush();

                        $lastStatus = $status;

                        // If job is completed or failed, send final event and close
                        if (in_array($status['status'], ['completed', 'failed'])) {
                            echo "event: finished\n";
                            echo "data: {\"message\": \"Simulation finished\", \"status\": \"{$status['status']}\"}\n\n";
                            ob_flush();
                            flush();
                            break;
                        }
                    }

                    // Send heartbeat every 5 seconds
                    if ((time() - $startTime) % 5 === 0) {
                        echo "event: heartbeat\n";
                        echo "data: {\"timestamp\": \"" . now()->toISOString() . "\"}\n\n";
                        ob_flush();
                        flush();
                    }

                    // Check if client disconnected
                    if (connection_aborted()) {
                        break;
                    }

                    sleep(1);
                }

                // Send timeout event if we exit due to timeout
                if (time() - $startTime >= $timeout) {
                    echo "event: timeout\n";
                    echo "data: {\"message\": \"Stream timeout reached\"}\n\n";
                    ob_flush();
                    flush();
                }
            }, 200, $headers);

        } catch (\Exception $e) {
            Log::error('SSE stream failed', [
                'job_id' => $jobId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to start event stream',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get available simulation options.
     *
     * @OA\Get(
     *     path="/simulator/options",
     *     summary="Get available simulation options",
     *     description="Returns the available weather options, default simulation options, and performance limits.",
     *     operationId="getSimulatorOptions",
     *     tags={"Simulator"},
     *     @OA\Response(
     *         response=200,
     *         description="Available simulation options",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="weather_options",
     *                     type="array",
     *                     @OA\Items(type="string"),
     *                     example={"normal", "rainy", "snowy", "windy"}
     *                 ),
     *                 @OA\Property(
     *                     property="default_options",
     *                     type="object",
     *                     @OA\Property(property="tickRate", type="integer", example=60),
     *                     @OA\Property(property="enableCommentary", type="boolean", example=true),
     *                     @OA\Property(property="enableStatistics", type="boolean", example=true),
     *                     @OA\Property(property="enableFatigue", type="boolean", example=true),
     *                     @OA\Property(property="enableMomentum", type="boolean", example=true),
     *                     @OA\Property(property="enableWeather", type="boolean", example=false)
     *                 ),
     *                 @OA\Property(
     *                     property="performance_limits",
     *                     type="object",
     *                     @OA\Property(property="max_tick_rate", type="integer", example=120),
     *                     @OA\Property(property="max_duration", type="integer", example=7200),
     *                     @OA\Property(property="max_concurrent_simulations", type="integer", example=10)
     *                 )
     *             )
     *         )
     *     )
     * )
     */
    public function getOptions(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'weather_options' => ['normal', 'rainy', 'snowy', 'windy'],
                'default_options' => [
                    'tickRate' => 60,
                    'enableCommentary' => true,
                    'enableStatistics' => true,
                    'enableFatigue' => true,
                    'enableMomentum' => true,
                    'enableWeather' => false
                ],
                'performance_limits' => [
                    'max_tick_rate' => 120,
                    'max_duration' => 7200,
                    'max_concurrent_simulations' => 10
                ]
            ]
        ]);
    }
}
