<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Team;
use App\Models\Tactic;
use App\Models\Player;

class MatchSimulatorService
{
    private array $simulatorUrls;
    private int $timeout;
    private string $loadBalancer;
    private array $healthyInstances = [];
    private int $currentInstance = 0;

    public function __construct()
    {
        $this->simulatorUrls = config('services.match_simulator.urls', ['http://localhost:8001']);
        $this->timeout = config('services.match_simulator.timeout', 300);
        $this->loadBalancer = config('services.match_simulator.load_balancer', 'round_robin');
        
        // Skip health checks for async RabbitMQ mode - assume healthy
        $this->healthyInstances = $this->simulatorUrls;
        
        // Only do health checks if explicitly needed for synchronous operations
        // $this->checkInstancesHealth();
    }

    /**
     * Get the next available simulator instance
     */
    private function getNextInstance(): string
    {
        if (empty($this->healthyInstances)) {
            $this->checkInstancesHealth();
            if (empty($this->healthyInstances)) {
                throw new \Exception('No healthy simulator instances available');
            }
        }

        switch ($this->loadBalancer) {
            case 'random':
                return $this->healthyInstances[array_rand($this->healthyInstances)];
            
            case 'least_connections':
                // For now, use round robin. In production, track active connections per instance
                return $this->getRoundRobinInstance();
            
            case 'round_robin':
            default:
                return $this->getRoundRobinInstance();
        }
    }

    private function getRoundRobinInstance(): string
    {
        $instance = $this->healthyInstances[$this->currentInstance % count($this->healthyInstances)];
        $this->currentInstance++;
        return $instance;
    }

    /**
     * Check health of all simulator instances
     */
    private function checkInstancesHealth(): void
    {
        $this->healthyInstances = [];
        
        foreach ($this->simulatorUrls as $url) {
            try {
                $response = Http::timeout(5)->get($url . '/health');
                if ($response->successful()) {
                    $this->healthyInstances[] = $url;
                }
            } catch (\Exception $e) {
                Log::warning("Simulator instance unhealthy: {$url}", ['error' => $e->getMessage()]);
            }
        }
        
        Log::info('Health check completed', [
            'total_instances' => count($this->simulatorUrls),
            'healthy_instances' => count($this->healthyInstances)
        ]);
    }

    /**
     * Get count of concurrent simulations across all instances
     */
    public function getConcurrentSimulationsCount(): int
    {
        $total = 0;
        foreach ($this->healthyInstances as $url) {
            try {
                $response = Http::timeout(5)->get($url . '/stats');
                if ($response->successful()) {
                    $stats = $response->json();
                    $total += $stats['active_simulations'] ?? 0;
                }
            } catch (\Exception $e) {
                // Skip unhealthy instances
            }
        }
        return $total;
    }

    /**
     * Simulate a match between two teams
     */
    public function simulateMatch(Team $homeTeam, Team $awayTeam, ?Tactic $homeTactic = null, ?Tactic $awayTactic = null, array $options = []): array
    {
        try {
            $requestData = $this->buildSimulationRequest($homeTeam, $awayTeam, $homeTactic, $awayTactic, $options);
            
            $simulatorUrl = $this->getNextInstance();
            
            Log::info('Sending simulation request to microservice', [
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name,
                'simulator_url' => $simulatorUrl
            ]);

            $response = Http::timeout($this->timeout)
                ->post($simulatorUrl . '/simulate', $requestData);

            Log::info('Microservice response received', [
                'status' => $response->status(),
                'successful' => $response->successful(),
                'body_length' => strlen($response->body())
            ]);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('Simulation completed successfully', [
                    'response_time' => $response->handlerStats()['total_time'] ?? 0,
                    'final_score' => $data['data']['final_score'] ?? null,
                    'response_keys' => array_keys($data)
                ]);
                return $data;
            } else {
                Log::error('Simulation service error', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                throw new \Exception('Simulation service error: ' . $response->status());
            }

        } catch (\Exception $e) {
            Log::error('Simulation request failed', [
                'error' => $e->getMessage(),
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name
            ]);
            throw $e;
        }
    }

    /**
     * Simulate a match in real-time mode
     */
    public function simulateRealTimeMatch(Team $homeTeam, Team $awayTeam, ?Tactic $homeTactic = null, ?Tactic $awayTactic = null, array $options = []): array
    {
        $options['realTime'] = true;
        $options['enableCommentary'] = true;
        $options['enableStatistics'] = true;
        $options['enableFatigue'] = true;
        $options['enableMomentum'] = true;

        return $this->simulateMatch($homeTeam, $awayTeam, $homeTactic, $awayTactic, $options);
    }

    /**
     * Simulate a match with streaming updates
     */
    public function simulateStreamingMatch(Team $homeTeam, Team $awayTeam, ?Tactic $homeTactic = null, ?Tactic $awayTactic = null, array $options = [])
    {
        try {
            $requestData = $this->buildSimulationRequest($homeTeam, $awayTeam, $homeTactic, $awayTactic, $options);
            
            $simulatorUrl = $this->getNextInstance();
            
            Log::info('Sending streaming simulation request to microservice', [
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name,
                'simulator_url' => $simulatorUrl,
                'players_count' => [
                    'home' => count($requestData['home_team']['players']),
                    'away' => count($requestData['away_team']['players'])
                ]
            ]);

            // Set up Server-Sent Events response
            return response()->stream(function () use ($requestData, $simulatorUrl) {
                // Set headers for SSE
                echo "data: " . json_encode(['type' => 'start', 'message' => 'Simulation starting...']) . "\n\n";
                flush();

                try {
                    // Call microservice streaming endpoint
                    $response = Http::withOptions([
                        'stream' => true,
                        'timeout' => 300
                    ])->post($simulatorUrl . '/simulate-streaming', $requestData);

                    if ($response->successful()) {
                        // Stream the response from microservice to client
                        $body = $response->getBody();
                        while (!$body->eof()) {
                            $chunk = $body->read(1024);
                            echo $chunk;
                            flush();
                        }
                    } else {
                        echo "data: " . json_encode([
                            'type' => 'error', 
                            'error' => 'Microservice error: ' . $response->status()
                        ]) . "\n\n";
                    }
                } catch (\Exception $e) {
                    Log::error('Streaming simulation error', ['error' => $e->getMessage()]);
                    echo "data: " . json_encode([
                        'type' => 'error', 
                        'error' => $e->getMessage()
                    ]) . "\n\n";
                }

                echo "data: " . json_encode(['type' => 'complete', 'message' => 'Simulation completed']) . "\n\n";
                flush();
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Headers' => 'Cache-Control'
            ]);

        } catch (\Exception $e) {
            Log::error('Streaming simulation request failed', [
                'error' => $e->getMessage(),
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name
            ]);
            throw $e;
        }
    }

    /**
     * Check if at least one simulator service is healthy
     */
    public function isHealthy(): bool
    {
        return !empty($this->healthyInstances);
    }

    /**
     * Queue a simulation for later processing
     */
    public function queueSimulation(Team $homeTeam, Team $awayTeam, ?Tactic $homeTactic = null, ?Tactic $awayTactic = null, array $options = []): string
    {
        $simulationId = uniqid('sim_');
        $requestData = $this->buildSimulationRequest($homeTeam, $awayTeam, $homeTactic, $awayTactic, $options);
        
        // In production, use Redis or database queue
        // For now, log the queued simulation
        Log::info('Simulation queued', [
            'simulation_id' => $simulationId,
            'home_team' => $homeTeam->name,
            'away_team' => $awayTeam->name
        ]);
        
        return $simulationId;
    }

    /**
     * Build the simulation request data
     */
    private function buildSimulationRequest(Team $homeTeam, Team $awayTeam, ?Tactic $homeTactic, ?Tactic $awayTactic, array $options): array
    {
        return [
            'home_team' => $this->formatTeamData($homeTeam),
            'away_team' => $this->formatTeamData($awayTeam),
            'home_tactic' => $homeTactic ? $this->formatTacticData($homeTactic) : null,
            'away_tactic' => $awayTactic ? $this->formatTacticData($awayTactic) : null,
            'weather' => $options['weather'] ?? 'normal',
            'stadium' => $options['stadium'] ?? 'default',
            'options' => array_merge([
                'tickRate' => 60,
                'enableCommentary' => true,
                'enableStatistics' => true,
                'enableFatigue' => true,
                'enableMomentum' => true,
                'enableWeather' => false
            ], $options)
        ];
    }

    /**
     * Format team data for the simulator
     */
    private function formatTeamData(Team $team): array
    {
        return [
            'id' => $team->id,
            'name' => $team->name,
            'players' => $team->players->map(function (Player $player) {
                return [
                    'id' => $player->id,
                    'first_name' => $player->first_name,
                    'last_name' => $player->last_name,
                    'shirt_number' => $player->shirt_number,
                    'primary_position' => [
                        'id' => $player->primaryPosition->id,
                        'name' => $player->primaryPosition->name,
                        'short_name' => $player->primaryPosition->short_name,
                        'category' => $player->primaryPosition->category,
                        'key_attributes' => $player->primaryPosition->key_attributes
                    ],
                    'attributes' => $player->attributes ? [
                        'pace' => $player->attributes->pace,
                        'shooting' => $player->attributes->shooting,
                        'passing' => $player->attributes->passing,
                        'dribbling' => $player->attributes->dribbling,
                        'defending' => $player->attributes->defending,
                        'physical' => $player->attributes->physical,
                        'stamina' => $player->attributes->stamina,
                        'strength' => $player->attributes->strength,
                        'acceleration' => $player->attributes->acceleration,
                        'sprint_speed' => $player->attributes->sprint_speed,
                        'finishing' => $player->attributes->finishing,
                        'shot_power' => $player->attributes->shot_power,
                        'long_shots' => $player->attributes->long_shots,
                        'volleys' => $player->attributes->volleys,
                        'penalties' => $player->attributes->penalties,
                        'vision' => $player->attributes->vision,
                        'crossing' => $player->attributes->crossing,
                        'free_kick_accuracy' => $player->attributes->free_kick_accuracy,
                        'short_passing' => $player->attributes->short_passing,
                        'long_passing' => $player->attributes->long_passing,
                        'curve' => $player->attributes->curve,
                        'agility' => $player->attributes->agility,
                        'balance' => $player->attributes->balance,
                        'reactions' => $player->attributes->reactions,
                        'ball_control' => $player->attributes->ball_control,
                        'dribbling_skill' => $player->attributes->dribbling_skill,
                        'composure' => $player->attributes->composure,
                        'interceptions' => $player->attributes->interceptions,
                        'heading_accuracy' => $player->attributes->heading_accuracy,
                        'marking' => $player->attributes->marking,
                        'standing_tackle' => $player->attributes->standing_tackle,
                        'sliding_tackle' => $player->attributes->sliding_tackle,
                        'jumping' => $player->attributes->jumping,
                        'stamina_attr' => $player->attributes->stamina_attr,
                        'strength_attr' => $player->attributes->strength_attr,
                        'aggression' => $player->attributes->aggression,
                    ] : null,
                    'team_id' => $player->team_id
                ];
            })->toArray()
        ];
    }

    /**
     * Format tactic data for the simulator
     */
    private function formatTacticData(Tactic $tactic): array
    {
        return [
            'id' => $tactic->id,
            'name' => $tactic->name,
            'formation_id' => $tactic->formation_id,
            'mentality' => $tactic->mentality,
            'custom_positions' => $tactic->custom_positions,
            'player_assignments' => $tactic->player_assignments,
            'width' => $tactic->width ?? 'normal',
            'tempo' => $tactic->tempo ?? 'normal',
            'defensive_line' => $tactic->defensive_line ?? 'normal',
            'pressing' => $tactic->pressing ?? 'normal',
            'team_instructions' => $tactic->team_instructions ?? []
        ];
    }
} 