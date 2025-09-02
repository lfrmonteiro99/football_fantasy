<?php

namespace App\Jobs;

use App\Models\Team;
use App\Models\User;
use App\Services\MatchSimulatorService;
use Illuminate\Support\Facades\Http;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

class SimulateMatchJob implements ShouldQueue
{
    use Queueable, InteractsWithQueue, SerializesModels;

    public $timeout = 300; // 5 minutes
    public $tries = 3;
    public $maxExceptions = 3;

    protected string $jobId;
    protected int $userId;
    protected array $matchData;
    protected array $options;

    /**
     * Create a new job instance.
     */
    public function __construct(string $jobId, int $userId, array $matchData, array $options = [])
    {
        $this->jobId = $jobId;
        $this->userId = $userId;
        $this->matchData = $matchData;
        $this->options = $options;
        
        // Set RabbitMQ connection and queue
        $this->onConnection('rabbitmq');
        $this->onQueue('laravel_jobs');

        // Log job creation (Producer side)
        Log::info('🐰 RABBITMQ PRODUCER: Job created and queued', [
            'job_id' => $this->jobId,
            'user_id' => $this->userId,
            'queue' => 'match_simulation',
            'connection' => 'rabbitmq',
            'match_data' => $this->matchData,
            'options' => $this->options,
            'timestamp' => now()->toISOString(),
            'job_class' => static::class
        ]);
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // Log job execution start (Consumer side)
        Log::info('🐰 RABBITMQ CONSUMER: Job execution started', [
            'job_id' => $this->jobId,
            'user_id' => $this->userId,
            'queue' => 'match_simulation',
            'connection' => 'rabbitmq',
            'attempt' => $this->attempts(),
            'timestamp' => now()->toISOString(),
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true)
        ]);

        try {
            // Set unlimited execution time for this job
            set_time_limit(0);
            
            Log::info("Starting async match simulation", [
                'job_id' => $this->jobId,
                'user_id' => $this->userId,
                'match_data' => $this->matchData
            ]);

            // Update job status
            $this->updateJobStatus('processing', ['message' => 'Loading teams and preparing simulation']);

            // Load teams with full data
            $homeTeam = Team::with(['players.primaryPosition', 'players.attributes'])
                ->findOrFail($this->matchData['home_team_id']);
            $awayTeam = Team::with(['players.primaryPosition', 'players.attributes'])
                ->findOrFail($this->matchData['away_team_id']);

            // Prepare simulation data for the Node.js microservice
            $jobData = [
                'job_id' => $this->jobId,
                'user_id' => $this->userId,
                'match_data' => [
                    'home_team_id' => $this->matchData['home_team_id'],
                    'away_team_id' => $this->matchData['away_team_id'],
                    'home_team' => $homeTeam->toArray(),
                    'away_team' => $awayTeam->toArray(),
                    'home_tactic_id' => $this->matchData['home_tactic_id'] ?? null,
                    'away_tactic_id' => $this->matchData['away_tactic_id'] ?? null,
                    'weather' => $this->matchData['weather'] ?? 'normal',
                    'stadium' => $this->matchData['stadium'] ?? $homeTeam->stadium_name ?? 'default',
                ],
                'options' => array_merge([
                    'tickRate' => 60,
                    'enableCommentary' => true,
                    'enableStatistics' => true,
                    'enableFatigue' => true,
                    'enableMomentum' => true,
                    'enableWeather' => true,
                ], $this->options),
            ];

            $this->updateJobStatus('processing', [
                'message' => 'Sending simulation request to microservice...',
                'progress' => 20
            ]);

            // Send job data directly as a simple message (not Laravel job format)
            $this->sendToMicroservice($jobData);

            // Mark job as completed in Laravel
            $this->updateJobStatus('processing', [
                'message' => 'Job sent to microservice for processing',
                'progress' => 30
            ]);

            // Log successful job completion (Consumer side)
            Log::info('🐰 RABBITMQ CONSUMER: Job completed successfully', [
                'job_id' => $this->jobId,
                'user_id' => $this->userId,
                'queue' => 'match_simulation',
                'execution_time' => microtime(true) - LARAVEL_START,
                'memory_usage' => memory_get_usage(true),
                'peak_memory' => memory_get_peak_usage(true),
                'timestamp' => now()->toISOString()
            ]);

            Log::info("Async match simulation job processed (sent to microservice)", [
                'job_id' => $this->jobId,
                'user_id' => $this->userId
            ]);

        } catch (\Exception $e) {
            // Log job failure (Consumer side)
            Log::error('🐰 RABBITMQ CONSUMER: Job execution failed', [
                'job_id' => $this->jobId,
                'user_id' => $this->userId,
                'queue' => 'match_simulation',
                'attempt' => $this->attempts(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'memory_usage' => memory_get_usage(true),
                'timestamp' => now()->toISOString()
            ]);

            Log::error("Async match simulation failed", [
                'job_id' => $this->jobId,
                'user_id' => $this->userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            $this->updateJobStatus('failed', [
                'message' => 'Match simulation failed: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ]);

            throw $e;
        }
    }

    /**
     * Send job data to microservice via RabbitMQ
     */
    protected function sendToMicroservice(array $jobData): void
    {
        try {
            Log::info('🐰 RABBITMQ PRODUCER: Sending job to microservice', [
                'job_id' => $this->jobId,
                'queue' => 'match_simulation',
                'message_size' => strlen(json_encode($jobData)),
                'job_data_keys' => array_keys($jobData),
                'timestamp' => now()->toISOString()
            ]);

            // Connect to RabbitMQ and publish the job data
            $connection = new AMQPStreamConnection(
                config('queue.connections.rabbitmq.hosts.0.host'),
                config('queue.connections.rabbitmq.hosts.0.port'),
                config('queue.connections.rabbitmq.hosts.0.user'),
                config('queue.connections.rabbitmq.hosts.0.password'),
                config('queue.connections.rabbitmq.hosts.0.vhost')
            );

            $channel = $connection->channel();

            // Declare queue for microservice jobs
            $channel->queue_declare('microservice_jobs', false, true, false, false);

            // Create message with detailed headers
            $messageBody = json_encode($jobData);
            $messageHeaders = [
                'content_type' => 'application/json',
                'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT,
                'message_id' => $this->jobId,
                'timestamp' => time(),
                'producer' => 'laravel-simulator',
                'version' => '1.0',
                'priority' => 0,
                'correlation_id' => $this->jobId,
                'reply_to' => 'simulation_results',
                'job_type' => 'match_simulation'
            ];

            $msg = new AMQPMessage($messageBody, $messageHeaders);

            // Log message details before publishing
            Log::info('🐰 RABBITMQ PRODUCER: Message details before publishing', [
                'job_id' => $this->jobId,
                'queue' => 'match_simulation',
                'message_body_size' => strlen($messageBody),
                'message_headers' => $messageHeaders,
                'routing_key' => 'match_simulation',
                'exchange' => '',
                'timestamp' => now()->toISOString()
            ]);

            // Publish job data
            $channel->basic_publish($msg, '', 'microservice_jobs');

            // Log successful publish
            Log::info('🐰 RABBITMQ PRODUCER: Message published successfully', [
                'job_id' => $this->jobId,
                'queue' => 'match_simulation',
                'message_id' => $this->jobId,
                'timestamp' => now()->toISOString()
            ]);

            $channel->close();
            $connection->close();

            Log::info('Job sent to microservice successfully', [
                'job_id' => $this->jobId
            ]);

        } catch (\Exception $e) {
            Log::error('🐰 RABBITMQ PRODUCER: Failed to send job to microservice', [
                'job_id' => $this->jobId,
                'queue' => 'match_simulation',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'timestamp' => now()->toISOString()
            ]);

            Log::error('Failed to send job to microservice', [
                'job_id' => $this->jobId,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Format team data for microservice
     */
    protected function formatTeamData(Team $team): array
    {
        return [
            'id' => $team->id,
            'name' => $team->name,
            'short_name' => $team->short_name,
            'primary_color' => $team->primary_color,
            'secondary_color' => $team->secondary_color,
            'players' => $team->players->map(function ($player) {
                return [
                    'id' => $player->id,
                    'name' => $player->full_name,
                    'shirt_number' => $player->shirt_number,
                    'position' => [
                        'id' => $player->primaryPosition->id,
                        'name' => $player->primaryPosition->name,
                        'short_name' => $player->primaryPosition->short_name,
                        'category' => $player->primaryPosition->category,
                    ],
                    'attributes' => $player->attributes ? [
                        'finishing' => $player->attributes->finishing,
                        'passing' => $player->attributes->passing,
                        'pace' => $player->attributes->pace,
                        'defending' => $player->attributes->tackling,
                        'physical' => $player->attributes->strength,
                        'current_ability' => $player->attributes->current_ability,
                    ] : null,
                    'age' => $player->age,
                    'nationality' => $player->nationality,
                ];
            })->toArray(),
            'formation' => '4-4-2', // Default formation for now
            'tactics' => [
                'mentality' => 'balanced',
                'pressing' => 'medium',
                'tempo' => 'standard',
            ]
        ];
    }

    /**
     * Update job status and broadcast to subscribers
     */
    protected function updateJobStatus(string $status, array $data = []): void
    {
        $statusData = array_merge([
            'job_id' => $this->jobId,
            'user_id' => $this->userId,
            'status' => $status,
            'timestamp' => now()->toISOString(),
        ], $data);

        // Store in cache for API access
        Cache::put("simulation_job:{$this->jobId}", $statusData, 3600); // 1 hour

        // Publish to RabbitMQ for real-time updates
        $this->publishUpdate($statusData);
    }

    /**
     * Publish update to RabbitMQ for real-time delivery
     */
    protected function publishUpdate(array $data): void
    {
        try {
            $connection = new AMQPStreamConnection(
                config('queue.connections.rabbitmq.hosts.0.host'),
                config('queue.connections.rabbitmq.hosts.0.port'),
                config('queue.connections.rabbitmq.hosts.0.user'),
                config('queue.connections.rabbitmq.hosts.0.password'),
                config('queue.connections.rabbitmq.hosts.0.vhost')
            );

            $channel = $connection->channel();

            // Declare exchange for simulation results
            $channel->exchange_declare('simulation_results', 'topic', false, true, false);

            // Publish update
            $msg = new AMQPMessage(json_encode($data), [
                'content_type' => 'application/json',
                'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT
            ]);

            $routingKey = "job.{$this->jobId}";
            $channel->basic_publish($msg, 'simulation_results', $routingKey);

            $channel->close();
            $connection->close();

        } catch (\Exception $e) {
            Log::error("Failed to publish simulation update", [
                'job_id' => $this->jobId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        try {
            Log::error("SimulateMatchJob failed", [
                'job_id' => $this->jobId ?? 'unknown',
                'user_id' => $this->userId ?? 0,
                'exception' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString()
            ]);

            if (isset($this->jobId)) {
                $this->updateJobStatus('failed', [
                    'message' => 'Job failed: ' . $exception->getMessage(),
                    'error' => $exception->getMessage()
                ]);
            }
        } catch (\Exception $e) {
            Log::error("Failed to handle job failure", [
                'error' => $e->getMessage(),
                'original_exception' => $exception->getMessage()
            ]);
        }
    }
}
