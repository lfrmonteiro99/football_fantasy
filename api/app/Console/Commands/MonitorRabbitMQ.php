<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

class MonitorRabbitMQ extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'rabbitmq:monitor {--queue=match_simulation : Queue to monitor} {--duration=60 : Duration in seconds to monitor}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Monitor RabbitMQ messages in real-time';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $queue = $this->option('queue');
        $duration = (int) $this->option('duration');

        $this->info("🐰 Starting RabbitMQ Monitor for queue: {$queue}");
        $this->info("📊 Duration: {$duration} seconds");
        $this->info("⏰ Started at: " . now()->toISOString());
        $this->line('');

        try {
            // Connect to RabbitMQ using localhost
            $connection = new AMQPStreamConnection(
                'localhost', // Use localhost for local development
                5672,
                'football',
                'fantasy',
                '/'
            );

            $channel = $connection->channel();

            // Declare queue
            $channel->queue_declare($queue, false, true, false, false);

            // Get queue info
            $queueInfo = $channel->queue_declare($queue, false, true, false, false);
            $messageCount = $queueInfo[1];
            $consumerCount = $queueInfo[2];

            $this->info("📈 Queue Status:");
            $this->line("   Messages in queue: {$messageCount}");
            $this->line("   Active consumers: {$consumerCount}");
            $this->line('');

            // Set up consumer to monitor messages
            $this->info("👀 Monitoring messages...");
            $this->line("Press Ctrl+C to stop");
            $this->line('');

            $startTime = time();
            $messageCount = 0;

            $channel->basic_consume($queue, '', false, false, false, false, function (AMQPMessage $msg) use (&$messageCount) {
                $messageCount++;
                $timestamp = now()->toISOString();
                
                $this->line("📨 Message #{$messageCount} received at {$timestamp}");
                $this->line("   Message ID: " . ($msg->get_properties()['message_id'] ?? 'N/A'));
                $this->line("   Correlation ID: " . ($msg->get_properties()['correlation_id'] ?? 'N/A'));
                $this->line("   Producer: " . ($msg->get_properties()['producer'] ?? 'N/A'));
                $this->line("   Size: " . strlen($msg->body) . " bytes");
                $this->line("   Headers: " . json_encode($msg->get_properties()));
                
                // Try to decode message body
                try {
                    $body = json_decode($msg->body, true);
                    if ($body) {
                        $this->line("   Body keys: " . implode(', ', array_keys($body)));
                        if (isset($body['job_id'])) {
                            $this->line("   Job ID: " . $body['job_id']);
                        }
                    } else {
                        $this->line("   Body: " . substr($msg->body, 0, 100) . "...");
                    }
                } catch (\Exception $e) {
                    $this->line("   Body: [Could not decode]");
                }
                
                $this->line('');

                // Acknowledge the message
                $msg->ack();
            });

            // Monitor for the specified duration
            while (time() - $startTime < $duration) {
                try {
                    $channel->wait(null, true, 1); // Wait 1 second for messages
                } catch (\PhpAmqpLib\Exception\AMQPTimeoutException $e) {
                    // Timeout is expected, continue monitoring
                    continue;
                }
            }

            $channel->close();
            $connection->close();

            $this->info("✅ Monitoring completed!");
            $this->line("📊 Total messages received: {$messageCount}");
            $this->line("⏰ Duration: " . (time() - $startTime) . " seconds");

        } catch (\Exception $e) {
            $this->error("❌ Error monitoring RabbitMQ: " . $e->getMessage());
            Log::error('RabbitMQ monitor error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }

        return 0;
    }
}
