<?php

namespace App\Services;

use OpenAI;
use Illuminate\Support\Facades\Log;
use GuzzleHttp\Client as GuzzleClient;

class OpenAIService
{
    private string $model;
    private $client;

    public function __construct()
    {
        $this->model = config('services.openai.model', 'gpt-3.5-turbo');
        $apiKey = config('services.openai.api_key');
        if (!empty($apiKey)) {
            // Configure OpenAI client with Guzzle timeouts to avoid hanging requests
            $factory = OpenAI::factory()->withApiKey($apiKey);
            try {
                $http = new GuzzleClient([
                    'timeout' => 60.0,          // total request timeout
                    'connect_timeout' => 10.0,  // connection handshake timeout
                ]);
                $factory = $factory->withHttpClient($http);
            } catch (\Throwable $e) {
                // Fallback to default client if Guzzle not available
            }
            $this->client = $factory->make();
        }
    }

    /**
     * Generate text using the OpenAI API
     */
    public function generateText(string $prompt): string
    {
        if (!$this->client) {
            throw new \Exception('OpenAI API key not configured');
        }

        try {
            // Extend script time just for this call (does not change php.ini)
            @set_time_limit(120);
            // Sanitize prompt to avoid control chars / encoding issues
            $sanitized = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $prompt);
            $sanitized = @iconv('UTF-8', 'UTF-8//IGNORE', $sanitized) ?: $sanitized;
            $t0 = microtime(true);
            $response = $this->client->chat()->create([
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are a football match simulator. Output must be valid JSON only. Do NOT include markdown, code fences, comments, or any extra prose. Return a single JSON structure as instructed.'
                    ],
                    [
                        'role' => 'user',
                        'content' => (string) $sanitized
                    ]
                ],
                'max_tokens' => 4096, // 🔧 FIX: Prevent truncation!
                'temperature' => 0.7,
            ]);
            $t1 = microtime(true);

            if (!isset($response->choices[0]->message->content)) {
                throw new \Exception('Invalid response format from OpenAI API');
            }

            return $response->choices[0]->message->content;

        } catch (\Exception $e) {
            throw $e;
        }
    }

    /**
     * Generate JSON using the OpenAI API
     */
    public function generateJson(string $prompt): array
    {
        if (!$this->client) {
            throw new \Exception('OpenAI API key not configured');
        }

        try {
            @set_time_limit(120);
            $t0 = microtime(true);

            $response = $this->client->chat()->create([
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are a football match simulator. Always return a single valid JSON object that follows the schema in the user’s request. Never return text outside JSON.'
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt
                    ]
                ],
                'response_format' => ['type' => 'json_object'], // 👈 forces strict JSON
                'max_tokens' => 4096, // 🔧 FIX: Prevent truncation!
                'temperature' => 0.7,
            ]);

            $t1 = microtime(true);

            $content = $response->choices[0]->message->content ?? null;
            if (!$content) {
                throw new \Exception('Invalid response format from OpenAI API');
            }

            // Log raw response for debugging
            Log::info('OpenAI Raw Response', [
                'content_length' => strlen($content),
                'content_preview' => substr($content, 0, 500),
                'content_suffix' => substr($content, -200)
            ]);
            
            // ROBUST JSON PARSING - NEVER FAIL!
            $decoded = $this->parseJsonRobustly($content);
            
            if ($decoded === null) {
                Log::warning('All JSON parsing attempts failed, creating minimal structure', [
                    'raw_content' => $content
                ]);
                // Return minimal valid structure so we don't crash
                return ['events' => []];
            }

            if (!is_array($decoded)) {
                throw new \Exception("Invalid events JSON returned: " . substr($content, 0, 200));
            }

            return $decoded;

        } catch (\Exception $e) {
            throw $e;
        }
    }

    /**
     * Robust JSON parsing that handles ANY OpenAI response format
     */
    private function parseJsonRobustly(string $content): ?array
    {
        // Strategy 1: Direct JSON decode
        $decoded = json_decode($content, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            Log::info('JSON parsing success: Direct decode');
            return $decoded;
        }

        // Strategy 2: Clean whitespace and try again
        $cleaned = trim(preg_replace('/\s+/', ' ', $content));
        $decoded = json_decode($cleaned, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            Log::info('JSON parsing success: After whitespace cleaning');
            return $decoded;
        }

        // Strategy 3: Extract JSON from markdown code blocks
        if (preg_match('/```(?:json)?\s*(\{.*\})\s*```/s', $content, $matches)) {
            $decoded = json_decode($matches[1], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                Log::info('JSON parsing success: Extracted from markdown');
                return $decoded;
            }
        }

        // Strategy 4: Find first { to last } and extract
        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if ($start !== false && $end !== false && $end > $start) {
            $jsonStr = substr($content, $start, $end - $start + 1);
            $decoded = json_decode($jsonStr, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                Log::info('JSON parsing success: Extracted JSON block');
                return $decoded;
            }
        }

        // Strategy 5: Fix common JSON issues
        $fixed = $this->fixCommonJsonIssues($content);
        if ($fixed !== $content) {
            $decoded = json_decode($fixed, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                Log::info('JSON parsing success: After fixing common issues');
                return $decoded;
            }
        }

        // Strategy 6: Try to extract array of events even if wrapper is broken
        if (preg_match('/\[.*\]/s', $content, $matches)) {
            $decoded = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                Log::info('JSON parsing success: Extracted array only');
                return ['events' => $decoded];
            }
        }

        Log::error('All JSON parsing strategies failed', [
            'content_preview' => substr($content, 0, 200),
            'last_error' => json_last_error_msg()
        ]);
        
        return null;
    }

    /**
     * Fix common JSON formatting issues
     */
    private function fixCommonJsonIssues(string $content): string
    {
        // Remove BOM and invisible characters
        $content = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $content);
        
        // Fix trailing commas
        $content = preg_replace('/,(\s*[}\]])/', '$1', $content);
        
        // Fix missing quotes around keys
        $content = preg_replace('/(\w+)(\s*:)/', '"$1"$2', $content);
        
        // Fix single quotes to double quotes
        $content = str_replace("'", '"', $content);
        
        // Fix escaped quotes issues
        $content = preg_replace('/\\\"/', '"', $content);
        
        return $content;
    }

    /**
     * Check if the OpenAI API is available
     */
    public function isAvailable(): bool
    {
        $apiKey = config('services.openai.api_key');
        return !empty($apiKey) && $apiKey !== 'your_openai_api_key_here' && $this->client !== null;
    }
} 