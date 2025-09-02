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
     * Simulate a match between two teams
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
     * Simulate a match in real-time mode
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
     * Check simulator service health
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
     * Simulate a match with streaming updates
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
     * Start async match simulation using RabbitMQ
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
     * Get simulation job status
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
     * Stream simulation updates via Server-Sent Events
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
     * Get available simulation options
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