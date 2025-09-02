<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobExceptionOccurred;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Add comprehensive RabbitMQ message logging
        Queue::before(function (JobProcessing $event) {
            Log::info('🐰 RABBITMQ QUEUE: Job processing started', [
                'job_id' => $event->job->getJobId(),
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
                'job_class' => $event->job->resolveName(),
                'attempts' => $event->job->attempts(),
                'timestamp' => now()->toISOString(),
                'payload_size' => strlen(serialize($event->job->payload())),
                'memory_usage' => memory_get_usage(true)
            ]);
        });

        Queue::after(function (JobProcessed $event) {
            Log::info('🐰 RABBITMQ QUEUE: Job processed successfully', [
                'job_id' => $event->job->getJobId(),
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
                'job_class' => $event->job->resolveName(),
                'execution_time' => $event->job->resolveName() === 'App\Jobs\SimulateMatchJob' ? 
                    (microtime(true) - LARAVEL_START) : null,
                'memory_usage' => memory_get_usage(true),
                'peak_memory' => memory_get_peak_usage(true),
                'timestamp' => now()->toISOString()
            ]);
        });

        Queue::failing(function (JobFailed $event) {
            Log::error('🐰 RABBITMQ QUEUE: Job failed', [
                'job_id' => $event->job->getJobId(),
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
                'job_class' => $event->job->resolveName(),
                'attempts' => $event->job->attempts(),
                'exception' => $event->exception->getMessage(),
                'trace' => $event->exception->getTraceAsString(),
                'memory_usage' => memory_get_usage(true),
                'timestamp' => now()->toISOString()
            ]);
        });

        Queue::exceptionOccurred(function (JobExceptionOccurred $event) {
            Log::error('🐰 RABBITMQ QUEUE: Job exception occurred', [
                'job_id' => $event->job->getJobId(),
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
                'job_class' => $event->job->resolveName(),
                'attempts' => $event->job->attempts(),
                'exception' => $event->exception->getMessage(),
                'trace' => $event->exception->getTraceAsString(),
                'memory_usage' => memory_get_usage(true),
                'timestamp' => now()->toISOString()
            ]);
        });
    }
}
