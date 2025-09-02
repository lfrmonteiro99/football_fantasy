<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'organization' => env('OPENAI_ORGANIZATION'),
    ],

    'match_simulator' => [
        'base_url' => env('MATCH_SIMULATOR_BASE_URL', 'http://localhost:8001'),
        'urls' => explode(',', env('MATCH_SIMULATOR_URLS', 'http://localhost:8001')),
        'timeout' => env('MATCH_SIMULATOR_TIMEOUT', 300),
        'max_concurrent' => env('MATCH_SIMULATOR_MAX_CONCURRENT', 3),
        'health_check_interval' => env('MATCH_SIMULATOR_HEALTH_CHECK', 60), // seconds
        'retry_attempts' => env('MATCH_SIMULATOR_RETRY_ATTEMPTS', 3),
        'retry_delay' => env('MATCH_SIMULATOR_RETRY_DELAY', 1000),
        'load_balancer' => env('MATCH_SIMULATOR_LOAD_BALANCER', 'round_robin'), // round_robin, least_connections, random
    ],

];
