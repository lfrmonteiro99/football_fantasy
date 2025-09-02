<?php

namespace App\Services;

use App\Models\GameMatch;
use App\Models\Team;
use App\Models\Player;
use App\Models\Formation;
use App\Models\MatchEvent;
use Illuminate\Support\Facades\Log;

class MatchSimulationService
{
    private $openAIService;

    public function __construct(OpenAIService $openAIService)
    {
        $this->openAIService = $openAIService;
    }

    public function simulateMatch(GameMatch $match): array
    {
        $homeTeam = $match->homeTeam;
        $awayTeam = $match->awayTeam;
        
        // Load team tactics with custom positions if they exist
        $homeTactic = $homeTeam->tactics()->where('is_primary', true)->first();
        $awayTactic = $awayTeam->tactics()->where('is_primary', true)->first();
        
        // Check if OpenAI API is available
        if ($this->openAIService->isAvailable()) {
            try {
                return $this->simulateWithAI($match, $homeTeam, $awayTeam, $homeTactic, $awayTactic);
            } catch (\Exception $e) {
                
                Log::error('OpenAI API simulation failed, falling back to manual simulation: ' . $e->getMessage());
                return $this->simulateWithFallback($match, $homeTeam, $awayTeam, $homeTactic, $awayTactic);
            }
        } else {
            Log::info('OpenAI API not configured, using fallback simulation');
            return $this->simulateWithFallback($match, $homeTeam, $awayTeam, $homeTactic, $awayTactic);
        }
    }

    /**
     * Generate exactly 20 key events using OpenAI per specified schema; returns the raw array (no DB writes)
     */
    public function generateKeyEvents(GameMatch $match): array
    {
        $tStart = microtime(true);
        $match->loadMissing(['homeTeam.players.attributes', 'awayTeam.players.attributes']);
        $homeTeam = $match->homeTeam;
        $awayTeam = $match->awayTeam;

        if (!$this->openAIService->isAvailable()) {
            throw new \Exception('OpenAI API not configured');
        }

        $mapPlayers = function ($players) {
            $out = [];
            foreach ($players as $p) {
                $attr = $p->attributes;
                $scale = function ($v, $def = 50) { $vv = is_numeric($v) ? floatval($v) : floatval($def); return max(0.0, min(1.0, $vv / 100.0)); };
                $out[] = [
                    'id' => intval($p->id),
                    'name' => $p->name ?? ("Player " . $p->id),
                    'role' => $p->primaryPosition->name ?? ($p->position ?? 'Player'),
                    'attributes' => [
                        'passing' => $scale($attr->passing ?? 60),
                        'dribbling' => $scale($attr->dribbling ?? 60),
                        'shooting' => $scale($attr->shooting ?? 60),
                        'speed' => $scale($attr->speed ?? 60),
                        'strength' => $scale($attr->strength ?? 60),
                    ],
                ];
            }
            return $out;
        };

        $home = [
            'name' => $homeTeam->name,
            'formation' => $homeTeam->formation,
            'tactic' => [ 'style' => 'balanced', 'press' => 'mid' ],
            'players' => $mapPlayers($homeTeam->players),
        ];
        $away = [
            'name' => $awayTeam->name,
            'formation' => $awayTeam->formation,
            'tactic' => [ 'style' => 'balanced', 'press' => 'mid' ],
            'players' => $mapPlayers($awayTeam->players),
        ];

        $context = [
            'MATCH_INFO' => [
                'duration_minutes' => 90,
                'pitch_size' => [100, 100],
                'teams' => [ 'home' => $home, 'away' => $away ],
            ],
        ];

        $instructions =
        "You are a football/soccer match simulator AI.\n\n" .
        "MATCH_INFO:\n" . json_encode($context['MATCH_INFO'], JSON_PRETTY_PRINT) . "\n\n" .
        "TASK:\n" .
        "Simulate a full 90-minute football match between \"{$homeTeam->name}\" and \"{$awayTeam->name}\".\n\n" .
        "Generate exactly 20 TOP-LEVEL events distributed across the ENTIRE 90-minute match.\n\n" .
        "TIME DISTRIBUTION REQUIREMENTS:\n" .
        "- Events MUST span from 00:00 to 90:00 (full match duration)\n" .
        "- Spread events realistically: early (0-15min), mid-first (15-45min), second half (45-90min)\n" .
        "- Example good timestamps: 03:12, 18:45, 34:20, 52:15, 67:30, 84:50\n" .
        "- DO NOT cluster all events in the first few minutes\n\n" .
        "Each TOP-LEVEL event MUST include:\n" .
        "- time: Match timestamp in MM:SS format (00:00 to 90:00),\n" .
        "- event_type: one of [pass, dribble, shot_on_goal, goal, interception, tackle_success, foul, clearance, save, throw_in, corner, free_kick],\n" .
        "- description: cinematic commentary narrating ALL the sub_events (mentioning players, flow, and emotions),\n" .
        "- tactical_context: 2 sentences on team strategy (counterattack, pressing, buildup, etc.),\n" .
        "- score: current score as {home:int, away:int},\n" .
        "- sub_events: sequential atomic actions forming the event.\n\n" .
        "SUB_EVENT FORMAT:\n" .
        "- action: [pass, dribble, shot_on_goal, goal, save, interception, tackle, foul, clearance, run with ball],\n" .
        "- from_player: player ID starting the action or null,\n" .
        "- to_player: player ID receiving the action or null,\n" .
        "- players_involved: array of IDs of all players in this action,\n" .
        "- ball_start: {x:float, y:float},\n" .
        "- ball_end: {x:float, y:float}.\n\n" .
        "RULES FOR SUB_EVENTS:\n" .
        "1. Use ONLY the 11 starting players per team (ignore substitutes).\n" .
        "2. Complex events MUST have multiple sub_events (e.g., pass → dribble → shot → goal or save).\n" .
        "   - goal, shot_on_goal, save: MUST have at least 3 sub_events.\n" .
        "   - corner, free_kick: MUST have at least 2 sub_events.\n" .
        "   - foul, clearance, throw_in: MAY have 1–2 sub_events.\n" .
        "3. Ensure continuity: ball_end of one sub_event = ball_start of the next.\n" .
        "4. Commentary must reflect the FULL sequence of sub_events.\n\n" .
        "STRICT OUTPUT:\n" .
        "Return ONLY a single MINIFIED JSON array of exactly 20 events (no markdown, no code fences, no line breaks).";



        $tPrompt = microtime(true);
        Log::info('AIKeyEvents: prompt_ready', [
            'match_id' => $match->id,
            'prompt_bytes' => strlen($instructions),
            'prep_ms' => (int)((microtime(true) - $tStart) * 1000)
        ]);

        $events = $this->openAIService->generateJson($instructions);

        // Return an array to avoid type errors; empty array signals FE to handle gracefully
        return is_array($events) ? $events : [];
    }

    /**
     * Generate 20 commentary events (no positions), minimal context
     */
    public function generateCommentary(GameMatch $match): array
    {
        $tStart = microtime(true);
        // Load detailed context (players with attributes, primary tactics with custom positions/assignments)
        $match->loadMissing([
            'homeTeam.players.primaryPosition',
            'homeTeam.players.attributes',
            'awayTeam.players.primaryPosition',
            'awayTeam.players.attributes',
        ]);
        $homeTeam = $match->homeTeam; $awayTeam = $match->awayTeam;

        $homeTactic = $homeTeam->tactics()->wherePivot('is_primary', true)->first();
        $awayTactic = $awayTeam->tactics()->wherePivot('is_primary', true)->first();

        if (!$this->openAIService->isAvailable()) {
            throw new \Exception('OpenAI API not configured');
        }

        $scale = function ($v, $def = 50) { $vv = is_numeric($v) ? floatval($v) : floatval($def); return max(0.0, min(1.0, $vv / 100.0)); };
        $mapPlayers = function ($players) use ($scale) {
            $out = [];
            foreach ($players as $p) {
                $attr = $p->attributes;
                $out[] = [
                    'id' => (int)$p->id,
                    'name' => $p->name ?? ("Player ".$p->id),
                    'role' => $p->primaryPosition->name ?? ($p->position ?? 'Player'),
                    'attributes' => [
                        'passing' => $scale($attr->passing ?? 60),
                        'dribbling' => $scale($attr->dribbling ?? 60),
                        'shooting' => $scale($attr->shooting ?? 60),
                        'speed' => $scale($attr->speed ?? 60),
                        'strength' => $scale($attr->strength ?? 60),
                    ],
                ];
            }
            return $out;
        };

        $context = [
            'home' => [
                'name' => $homeTeam->name,
                'players' => $mapPlayers($homeTeam->players),
            ],
            'away' => [
                'name' => $awayTeam->name,
                'players' => $mapPlayers($awayTeam->players),
            ],
        ];

        $instructions = "You are a football match simulator AI.\n\n" .
            "CONTEXT (use for realism; DO NOT echo it back):\n" . json_encode($context, JSON_UNESCAPED_SLASHES) . "\n\n" .
            "TASK: Simulate a full 90-minute match between \"{$homeTeam->name}\" (home) and \"{$awayTeam->name}\" (away).\n" .
            "Generate EXACTLY 20 key commentary events distributed realistically across the FULL 90 minutes.\n" .
            "Use players, their attributes, and any tactic custom_positions/player_assignments to keep commentary realistic.\n\n" .
            "TIME DISTRIBUTION: Events must be spread across 90 minutes (00:00 to 90:00). Examples of good timing:\n" .
            "- Early: 03:15, 08:42, 12:30\n" .
            "- Mid-first half: 18:25, 23:10, 35:45\n" .
            "- Second half: 52:20, 61:30, 73:15, 84:50\n" .
            "- Late: 87:30, 89:45\n\n" .
            "Each event must include ONLY:\n" .
            "- time: Match time in MM:SS format (00:00 to 90:00)\n" .
            "- event_type: One of (kickoff, pass, dribble, interception, tackle_success, foul, yellow_card, red_card, free_kick, corner, throw_in, shot_on_goal, save, goal, offside, substitution, half_time, full_time)\n" .
            "- description: Detailed explanation of what happened\n" .
            "- score: Current score {home:int, away:int}\n\n" .
            "OUTPUT RULES: Return a single MINIFIED JSON array (exactly 20 elements). NO markdown, NO code fences, NO extra text. Valid JSON only.";

        Log::info('AICommentary: prompt_ready', [
            'match_id' => $match->id,
            'prompt_bytes' => strlen($instructions)
        ]);

        $tCall0 = microtime(true);
        $response = $this->openAIService->generateText($instructions);
        Log::info('AICommentary: openai_call_ms', [
            'match_id' => $match->id,
            'ms' => (int)((microtime(true) - $tCall0) * 1000)
        ]);

        $response = $this->cleanAIResponse($response ?? '');
        $response = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $response);
        $response = @iconv('UTF-8', 'UTF-8//IGNORE', $response) ?: $response;

        $events = json_decode($response, true);
        if (!is_array($events)) {
            // Fallback bracket extraction
            $s = strpos($response, '['); $e = strrpos($response, ']');
            if ($s !== false && $e !== false && $e > $s) {
                $candidate = substr($response, $s, $e - $s + 1);
                $candidate = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $candidate);
                $candidate = @iconv('UTF-8', 'UTF-8//IGNORE', $candidate) ?: $candidate;
                $events = json_decode($candidate, true);
            }
        }
        if (is_array($events) && count($events) > 20) {
            $events = array_slice($events, 0, 20);
        }
        Log::info('AICommentary: total_ms', [
            'match_id' => $match->id,
            'total_ms' => (int)((microtime(true) - $tStart) * 1000),
            'events_count' => is_array($events) ? count($events) : 0,
        ]);
        return is_array($events) ? $events : [];
    }

    /**
 * Generate positions for a single commentary event
 */
public function generateEventPositions(GameMatch $match, array $event): array
{
    $tStart = microtime(true);

    $match->loadMissing([
        'homeTeam.players.primaryPosition',
        'homeTeam.players.attributes',
        'awayTeam.players.primaryPosition',
        'awayTeam.players.attributes',
    ]);

    $homeTeam = $match->homeTeam;
    $awayTeam = $match->awayTeam;

    $homeTactic = $homeTeam->tactics()->wherePivot('is_primary', true)->first();
    $awayTactic = $awayTeam->tactics()->wherePivot('is_primary', true)->first();

    if (!$this->openAIService->isAvailable()) {
        throw new \Exception('OpenAI API not configured');
    }
    
    $time = data_get($event, 'time', '00:00');
    $etype = data_get($event, 'event_type', 'pass');
    $desc = data_get($event, 'description', '');
    $score = data_get($event, 'score', ['home' => 0, 'away' => 0]);

    $instructions = "Generate football positions for event: {$etype} at {$time}\n" .
        "Return JSON: {players_before:[{id,x,y}], players_after:[{id,x,y}], ball_before:{x,y}, ball_after:{x,y}}\n" .
        "22 players, IDs 1-22, positions 0-100. JSON only.";

    $response = $this->openAIService->generateJson($instructions);
    $response = $this->cleanAIResponse($response ?? '');
    $response = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $response);
    $response = @iconv('UTF-8', 'UTF-8//IGNORE', $response) ?: $response;
    $obj = json_decode($response, true);
    if (!is_array($obj)) {
        // Try extract object between first '{' and last '}'
        $s = strpos($response, '{'); $e = strrpos($response, '}');
        if ($s !== false && $e !== false && $e > $s) {
            $cand = substr($response, $s, $e - $s + 1);
            $cand = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $cand);
            $cand = @iconv('UTF-8', 'UTF-8//IGNORE', $cand) ?: $cand;
            $obj = json_decode($cand, true);
        }
    }

    // Log the result
    Log::info('AIEventPositions: result', [
        'match_id' => $match->id,
        'event_time' => $time,
        'event_type' => $etype,
        'total_ms' => (int)((microtime(true) - $tStart) * 1000),
        'has_positions' => is_array($obj) && isset($obj['players_before']) && isset($obj['players_after'])
    ]);

    // Fallback if needed
    if (!is_array($obj) || !isset($obj['players_before']) || !isset($obj['players_after'])) {
        $obj = $this->generateFallbackPositions($event);
    }

    return is_array($obj) ? $obj : [];
}

    /**
     * Batch generate positions for multiple commentary events (up to 10). Returns array keyed by index.
     */
    public function generateEventsPositionsBatch(GameMatch $match, array $subEvents): array
    {
        $tStart = microtime(true);
        $match->loadMissing([
            'homeTeam.players.primaryPosition',
            'homeTeam.players.attributes',
            'awayTeam.players.primaryPosition',
            'awayTeam.players.attributes',
        ]);

        $results = [];

        // Build compact team context once
        $homeTeam = $match->homeTeam; $awayTeam = $match->awayTeam;
        // Minimal player context: only id and role (no attributes)
        $mapPlayers = function ($players) {
            $out = [];
            foreach ($players as $p) {
                $out[] = [
                    'id' => (int)$p->id,
                    'role' => $p->primaryPosition->name ?? ($p->position ?? 'Player'),
                ];
            }
            return $out;
        };

        $teamContext = [
            'home' => ['name' => $homeTeam->name, 'players' => $mapPlayers($homeTeam->players)],
            'away' => ['name' => $awayTeam->name, 'players' => $mapPlayers($awayTeam->players)],
        ];

        $home = [
            'name' => $homeTeam->name,
            'formation' => $homeTeam->formation ?? '4-4-2',
            'tactic' => [ 'style' => 'balanced', 'press' => 'mid' ],
            'players' => $mapPlayers($homeTeam->players),
        ];
        $away = [
            'name' => $awayTeam->name,
            'formation' => $awayTeam->formation ?? '4-4-2',
            'tactic' => [ 'style' => 'balanced', 'press' => 'mid' ],
            'players' => $mapPlayers($awayTeam->players),
        ];

        $context = [
            'MATCH_INFO' => [
                'duration_minutes' => 90,
                'pitch_size' => [100, 100],
                'teams' => [ 'home' => $home, 'away' => $away ],
            ],
        ];

        // Structured log of prompt parts (context + events)
        Log::info("\n#### AI EVENTS POSITIONS BATCH - CONTEXT (match_id={$match->id}) ####\n" . json_encode($teamContext, JSON_PRETTY_PRINT));

        // Prepare events payload with both description + sub_events
        $eventsPayload = [];
        foreach ($subEvents as $ev) {
            $eventsPayload[] = [
                'time' => $ev['time'],
                'event_type' => $ev['event_type'],
                'description' => $ev['description'],
                'sub_events' => $ev['sub_events'], // variable-length sequence
            ];
        }

        // Simplified but focused tactical prompt
        $instructions =
            "Generate realistic football player positions. CRITICAL: Return EXACTLY 22 players (11 home + 11 away) for each event.\n\n" .
            
            "PITCH: 100x100. Home goal at x=0, Away goal at x=100.\n\n" .
            
            "FORMATIONS:\n" .
            "Home (defend x=0): GK x=5, Defenders x=10-25, Midfield x=30-60, Attack x=50-80\n" .
            "Away (defend x=100): GK x=95, Defenders x=75-90, Midfield x=40-70, Attack x=20-50\n\n" .
            
            "PLAYER IDs (USE ALL 22):\n" .
            "Home: 533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560\n" .
            "Away: 477,478,479,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499,500,501,502,503,504\n\n" .
            
            "EVENTS:\n" . json_encode($eventsPayload) . "\n\n" .
            
            "RULES:\n" .
            "1. EXACTLY 22 unique player IDs per event (11 from each team)\n" .
            "2. GOALS: Ball must reach x=0 or x=100 (goal line)\n" .
            "3. SHOTS: Ball moves toward goal (x increases or decreases)\n" .
            "4. Realistic formations - no random scattered positions\n\n" .
            
            "Return JSON: {\"events\": [{\"time\": \"MM:SS\", \"event_type\": \"type\", \"ball_before\": {\"x\": X, \"y\": Y}, \"ball_after\": {\"x\": X, \"y\": Y}, \"players_before\": [{\"id\": ID, \"x\": X, \"y\": Y}, ...22 players], \"players_after\": [{\"id\": ID, \"x\": X, \"y\": Y}, ...22 players]}]}";

        Log::info("\n#### AI EVENTS POSITIONS BATCH - SIMPLIFIED PROMPT (match_id={$match->id}) ####\n" . $instructions);

        try {
            // Quick test to verify OpenAI is working
            Log::info('AIEventPositions: testing_openai_connection', [
                'match_id' => $match->id,
                'api_available' => $this->openAIService->isAvailable()
            ]);
            
            Log::info('AIEventPositions: calling_openai', [
                'match_id' => $match->id,
                'events_count' => count($subEvents),
                'prompt_length' => strlen($instructions)
            ]);
            
            $response = $this->openAIService->generateJson($instructions);
            
            Log::info('AIEventPositions: openai_response_received', [
                'match_id' => $match->id,
                'response_type' => gettype($response),
                'response_keys' => is_array($response) ? array_keys($response) : 'N/A'
            ]);
            
            // Extract events array from the response object
            $positions = [];
            if (is_array($response) && isset($response['events']) && is_array($response['events'])) {
                $positions = $response['events'];
            } elseif (is_array($response)) {
                // Fallback: if it's already an array, use it directly
                $positions = $response;
            }
            
            // Log the raw response for debugging
            Log::info('AIEventPositions: raw_openai_response', [
                'match_id' => $match->id,
                'response_type' => gettype($response),
                'response_preview' => is_string($response) ? substr($response, 0, 500) : json_encode($response),
                'response_length' => is_string($response) ? strlen($response) : (is_array($response) ? count($response) : 'N/A'),
                'events_extracted' => count($positions)
            ]);

            // Process the response
            if (is_array($positions) && count($positions) > 0) {
                Log::info('AIEventPositions: processing_array_response', [
                    'match_id' => $match->id,
                    'response_count' => count($positions),
                    'response_keys' => array_keys($positions)
                ]);
                
                // Process each AI response item
                foreach ($positions as $eventIdx => $item) {
                    $originalEvent = $subEvents[$eventIdx] ?? [];
                    
                    // Validate the simplified format
                    $ballBefore = data_get($item, 'ball_before');
                    $ballAfter = data_get($item, 'ball_after');
                    $playersBefore = data_get($item, 'players_before');
                    $playersAfter = data_get($item, 'players_after');
                    
                    // Enhanced validation with fixes
                    $valid = 
                        is_array($ballBefore) && isset($ballBefore['x'], $ballBefore['y']) &&
                        is_array($ballAfter) && isset($ballAfter['x'], $ballAfter['y']) &&
                        is_array($playersBefore) && count($playersBefore) >= 20 &&
                        is_array($playersAfter) && count($playersAfter) >= 20;
                        
                    if ($valid) {
                        // Fix 1: Limit to exactly 22 players (remove duplicates/extras)
                        $playersBefore = $this->limitToExactly22Players($playersBefore);
                        $playersAfter = $this->limitToExactly22Players($playersAfter);
                        
                        // Fix 2: Validate and fix ball movement logic
                        $eventType = data_get($originalEvent, 'event_type', 'pass');
                        $ballAfter = $this->validateBallMovement($ballBefore, $ballAfter, $eventType);
                        
                        Log::info('AIEventPositions: data_cleaned', [
                            'match_id' => $match->id,
                            'idx' => $eventIdx,
                            'players_before_fixed' => count($playersBefore),
                            'players_after_fixed' => count($playersAfter),
                            'ball_movement_fixed' => $ballAfter !== data_get($item, 'ball_after')
                        ]);
                        // Success - preserve sub_events and provide both formats
                        $results[$eventIdx] = [
                            'time' => data_get($item, 'time', $originalEvent['time'] ?? '00:00'),
                            'event_type' => data_get($item, 'event_type', $originalEvent['event_type'] ?? 'pass'),
                            'ball_before' => $ballBefore,
                            'ball_after' => $ballAfter,
                            'players_before' => $playersBefore,
                            'players_after' => $playersAfter,
                            'sub_events' => $originalEvent['sub_events'] ?? [], // Preserve original sub_events
                        ];
                        
                        Log::info('AIEventPositions: validation_success', [
                            'match_id' => $match->id,
                            'idx' => $eventIdx,
                            'players_before_count' => count($playersBefore),
                            'players_after_count' => count($playersAfter),
                            'sub_events_count' => count($originalEvent['sub_events'] ?? []),
                            'ball_before' => $ballBefore,
                            'ball_after' => $ballAfter
                        ]);
                    } else {
                        // PARTIAL DATA RESCUE - Extract whatever we can use!
                        $rescuedData = $this->rescuePartialAIData($item, $originalEvent);
                        
                        if ($rescuedData) {
                            $results[$eventIdx] = $rescuedData;
                            Log::info('AIEventPositions: partial_data_rescued', [
                                'match_id' => $match->id,
                                'idx' => $eventIdx,
                                'rescued_ball' => isset($rescuedData['ball_before']),
                                'rescued_players' => count($rescuedData['players_before'] ?? [])
                            ]);
                        } else {
                            $results[$eventIdx] = null;
                            
                            Log::warning('AIEventPositions: validation_failed', [
                                'match_id' => $match->id,
                                'idx' => $eventIdx,
                                'ball_before_valid' => is_array($ballBefore) && isset($ballBefore['x'], $ballBefore['y']),
                                'ball_after_valid' => is_array($ballAfter) && isset($ballAfter['x'], $ballAfter['y']),
                                'players_before_count' => is_array($playersBefore) ? count($playersBefore) : 'N/A',
                                'players_after_count' => is_array($playersAfter) ? count($playersAfter) : 'N/A',
                                'raw_item' => $item
                            ]);
                        }
                    }
                }
            } else {
                Log::error('AIEventPositions: invalid_response_type', [
                    'match_id' => $match->id,
                    'expected_type' => 'array',
                    'actual_type' => gettype($positions),
                    'response' => $positions
                ]);
            }
            
        } catch (\Throwable $e) {
            Log::error('AIEventPositions: error', [
                'match_id' => $match->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // If AI fails, fallback all
            Log::info('AIEventPositions: using_fallbacks_for_all_events', [
                'match_id' => $match->id,
                'event_count' => count($subEvents)
            ]);
        }

        // Generate fallbacks for any missing events
        foreach ($subEvents as $idx => $event) {
            if (!isset($results[$idx])) {
                Log::info('AIEventPositions: generating_fallback_for_event', [
                    'match_id' => $match->id,
                    'idx' => $idx,
                    'event_time' => $event['time'],
                    'event_type' => $event['event_type']
                ]);
                
                $fallbackPositions = $this->generateFallbackPositions($event);
                // Preserve sub_events from original event
                $results[$idx] = array_merge($fallbackPositions, [
                    'sub_events' => $event['sub_events'] ?? []
                ]);
            }
        }

        Log::info('AIEventPositions: final_results_summary', [
            'match_id' => $match->id,
            'total_events' => count($subEvents),
            'results_count' => count($results),
            'results_keys' => array_keys($results),
            'total_ms' => (int)((microtime(true) - $tStart) * 1000)
        ]);

        return $results;
    }

    // The rest of this function continues below; stray helpers removed.

/**
 * Helper to pretty-print players array in prompt
 */
private function prettyPrintPlayers(array $players): string
{
    return json_encode($players, JSON_PRETTY_PRINT);
}


    /**
     * Generate fallback positions when AI fails
     */
    /**
     * Limit players array to exactly 22 players (remove duplicates and extras)
     */
    private function limitToExactly22Players(array $players): array
    {
        // Remove duplicates by ID
        $uniquePlayers = [];
        $seenIds = [];
        
        foreach ($players as $player) {
            $id = data_get($player, 'id');
            if ($id && !in_array($id, $seenIds)) {
                $uniquePlayers[] = $player;
                $seenIds[] = $id;
            }
        }
        
        // Limit to exactly 22 players
        return array_slice($uniquePlayers, 0, 22);
    }
    
    /**
     * Validate and fix ball movement logic
     */
    private function validateBallMovement(array $ballBefore, array $ballAfter, string $eventType): array
    {
        $xBefore = $ballBefore['x'] ?? 50;
        $yBefore = $ballBefore['y'] ?? 50;
        $xAfter = $ballAfter['x'] ?? 50;
        $yAfter = $ballAfter['y'] ?? 50;
        
        // Fix unrealistic ball movements
        switch ($eventType) {
            case 'shot_on_goal':
                // Shots should move toward goal (increase x for home team shooting at away goal)
                if ($xAfter <= $xBefore) {
                    // Fix: shot should go forward toward goal
                    $xAfter = min(95, $xBefore + rand(15, 35)); // Move toward away goal
                    Log::info('Fixed backwards shot', [
                        'before' => "{$xBefore},{$yBefore}",
                        'after_fixed' => "{$xAfter},{$yAfter}"
                    ]);
                }
                break;
                
            case 'save':
                // Saves happen near the goal line
                if ($xAfter < 85 && $xAfter > 15) {
                    // Fix: save should be near a goal
                    $xAfter = $xBefore > 50 ? rand(90, 95) : rand(5, 10); // Near appropriate goal
                    Log::info('Fixed save position', [
                        'before' => "{$xBefore},{$yBefore}",
                        'after_fixed' => "{$xAfter},{$yAfter}"
                    ]);
                }
                break;
                
            case 'goal':
                // Goals should end at the goal line
                $xAfter = $xBefore > 50 ? 100 : 0; // At the goal line
                break;
        }
        
        return ['x' => $xAfter, 'y' => $yAfter];
    }

    /**
     * Rescue partial data from malformed AI responses
     */
    private function rescuePartialAIData(array $item, array $originalEvent): ?array
    {
        $rescued = [];
        
        // Try to extract ball positions from anywhere in the response
        $ballBefore = null;
        $ballAfter = null;
        
        // Look for ball data in various formats
        if (isset($item['ball_before']) && is_array($item['ball_before'])) {
            $ballBefore = $item['ball_before'];
        } elseif (isset($item['ball']) && is_array($item['ball'])) {
            $ballBefore = $item['ball'];
        } elseif (isset($originalEvent['sub_events'][0]['ball_start'])) {
            $ballBefore = $originalEvent['sub_events'][0]['ball_start'];
        }
        
        if (isset($item['ball_after']) && is_array($item['ball_after'])) {
            $ballAfter = $item['ball_after'];
        } elseif (isset($originalEvent['sub_events'][0]['ball_end'])) {
            $ballAfter = $originalEvent['sub_events'][0]['ball_end'];
        } else {
            $ballAfter = $ballBefore; // Use same position if no after position
        }
        
        // Try to extract player positions
        $playersBefore = [];
        $playersAfter = [];
        
        if (isset($item['players_before']) && is_array($item['players_before'])) {
            $playersBefore = $item['players_before'];
        } elseif (isset($item['players']) && is_array($item['players'])) {
            $playersBefore = $item['players'];
        }
        
        if (isset($item['players_after']) && is_array($item['players_after'])) {
            $playersAfter = $item['players_after'];
        } else {
            $playersAfter = $playersBefore; // Use same positions if no after positions
        }
        
        // Validate rescued data
        $validBall = is_array($ballBefore) && isset($ballBefore['x'], $ballBefore['y']) &&
                    is_array($ballAfter) && isset($ballAfter['x'], $ballAfter['y']);
        
        $validPlayers = is_array($playersBefore) && count($playersBefore) >= 10 && // At least 10 players
                       is_array($playersAfter) && count($playersAfter) >= 10;
        
        if ($validBall || $validPlayers) {
            // Use rescued data or fallback for missing parts
            if (!$validBall) {
                $ballBefore = ['x' => 50, 'y' => 50];
                $ballAfter = ['x' => 55, 'y' => 50];
            }
            
            if (!$validPlayers) {
                // Generate minimal player positions
                $playersBefore = $this->generateMinimalPlayerPositions();
                $playersAfter = $this->generateMinimalPlayerPositions(true);
            }
            
            return [
                'ball_before' => $ballBefore,
                'ball_after' => $ballAfter,
                'players_before' => $playersBefore,
                'players_after' => $playersAfter,
                'sub_events' => $originalEvent['sub_events'] ?? [],
                'is_partial_rescue' => true
            ];
        }
        
        return null;
    }
    
    /**
     * Generate minimal player positions for rescue scenarios
     */
    private function generateMinimalPlayerPositions(bool $withMovement = false): array
    {
        $players = [];
        
        // Home team (left side) - basic 4-4-2
        $homePositions = [
            [5, 50], [15, 20], [15, 40], [15, 60], [15, 80],
            [30, 25], [30, 45], [30, 65], [30, 85],
            [45, 35], [45, 65]
        ];
        
        // Away team (right side) - basic 4-4-2
        $awayPositions = [
            [95, 50], [85, 20], [85, 40], [85, 60], [85, 80],
            [70, 25], [70, 45], [70, 65], [70, 85],
            [55, 35], [55, 65]
        ];
        
        $allPositions = array_merge($homePositions, $awayPositions);
        
        for ($i = 0; $i < 22; $i++) {
            $pos = $allPositions[$i] ?? [50, 50];
            $moveX = $withMovement ? rand(-3, 3) : 0;
            $moveY = $withMovement ? rand(-2, 2) : 0;
            
            $players[] = [
                'id' => 1000 + $i,
                'x' => max(0, min(100, $pos[0] + $moveX)),
                'y' => max(0, min(100, $pos[1] + $moveY))
            ];
        }
        
        return $players;
    }

    private function generateFallbackPositions(array $event): array
    {
        $eventType = data_get($event, 'event_type', 'pass');
        $time = data_get($event, 'time', '00:00');
        
        // Parse time to get minute
        $minute = 0;
        if (preg_match('/(\d+):(\d+)/', $time, $matches)) {
            $minute = intval($matches[1]);
        }
        
        // Generate basic 4-4-2 formation positions
        $players = [];
        
        // Home team (left side) - players 1-11
        $homePositions = [
            [10, 50], [10, 20], [10, 40], [10, 60], [10, 80], // defenders
            [25, 25], [25, 45], [25, 65], [25, 85], // midfielders
            [40, 30], [40, 70], // forwards
        ];
        
        // Away team (right side) - players 12-22
        $awayPositions = [
            [90, 50], [90, 20], [90, 40], [90, 60], [90, 80], // defenders
            [75, 25], [75, 45], [75, 65], [75, 85], // midfielders
            [60, 30], [60, 70], // forwards
        ];
        
        // Add some variation based on event type and time
        $variation = sin($minute * 0.1) * 5;
        
        for ($i = 0; $i < 11; $i++) {
            $players[] = [
                'id' => $i + 1,
                'x' => max(0, min(100, $homePositions[$i][0] + $variation)),
                'y' => max(0, min(100, $homePositions[$i][1] + $variation))
            ];
        }
        
        for ($i = 0; $i < 11; $i++) {
            $players[] = [
                'id' => $i + 12,
                'x' => max(0, min(100, $awayPositions[$i][0] - $variation)),
                'y' => max(0, min(100, $awayPositions[$i][1] + $variation))
            ];
        }
        
        // Ball position based on event type
        $ballX = 50;
        $ballY = 50;
        
        if ($eventType === 'goal') {
            $ballX = 90; // Ball in goal
        } elseif ($eventType === 'shot_on_goal') {
            $ballX = 85; // Ball near goal
        } elseif ($eventType === 'pass' || $eventType === 'dribble') {
            $ballX = 40 + ($minute % 30); // Ball moving
        }
        
        // Create movement by generating slightly different "after" positions
        $playersAfter = [];
        foreach ($players as $player) {
            $moveX = rand(-3, 3); // Small random movement
            $moveY = rand(-2, 2);
            $playersAfter[] = [
                'id' => $player['id'],
                'x' => max(0, min(100, $player['x'] + $moveX)),
                'y' => max(0, min(100, $player['y'] + $moveY))
            ];
        }
        
        // Ball movement based on event type
        $ballAfterX = $ballX;
        $ballAfterY = $ballY;
        
        if ($eventType === 'pass') {
            $ballAfterX = min(100, $ballX + 10); // Ball moves forward
        } elseif ($eventType === 'shot_on_goal') {
            $ballAfterX = min(100, $ballX + 5); // Ball moves toward goal
        } elseif ($eventType === 'dribble') {
            $ballAfterX = min(100, $ballX + 8); // Ball dribbled forward
            $ballAfterY = max(0, min(100, $ballY + rand(-3, 3))); // Some sideways movement
        }
        
        return [
            'players_before' => $players,
            'players_after' => $playersAfter,
            'ball_before' => ['x' => $ballX, 'y' => $ballY],
            'ball_after' => ['x' => $ballAfterX, 'y' => $ballAfterY]
        ];
    }

    private function simulateWithAI(GameMatch $match, Team $homeTeam, Team $awayTeam, $homeTactic = null, $awayTactic = null): array
    {
        // Build simplified context similar to regeneration
        $homeStrength = $this->calculateTeamStrength($homeTeam);
        $awayStrength = $this->calculateTeamStrength($awayTeam);
        
        // Get formations
        $homeFormation = $match->homeFormation;
        $awayFormation = $match->awayFormation;
        
        // Determine team management roles
        $teamRoles = $this->getTeamManagementRoles($homeTeam, $awayTeam);
        $userTeam = $teamRoles['user_managed'];
        $aiTeam = $teamRoles['ai_managed'];
        $userTeamType = $teamRoles['user_team_type'];
        $aiTeamType = $teamRoles['ai_team_type'];
        
        // Build tactical context
        $tacticalContext = '';
        if ($homeTactic && $homeTactic->custom_positions) {
            $tacticalContext .= "\n{$homeTeam->name} has custom tactical positions.\n";
        }
        if ($awayTactic && $awayTactic->custom_positions) {
            $tacticalContext .= "\n{$awayTeam->name} has custom tactical positions.\n";
        }
        
        // Add tactical analysis if custom positions exist
        $tacticalAnalysis = '';
        if ($homeTactic && $homeTactic->custom_positions) {
            $homeAnalysis = $this->analyzeTacticalSetup($homeTactic, $homeTeam->name);
            $tacticalAnalysis .= "\n{$homeTeam->name} Tactical Analysis:\n{$homeAnalysis}\n";
        }
        if ($awayTactic && $awayTactic->custom_positions) {
            $awayAnalysis = $this->analyzeTacticalSetup($awayTactic, $awayTeam->name);
            $tacticalAnalysis .= "\n{$awayTeam->name} Tactical Analysis:\n{$awayAnalysis}\n";
        }
        
        // Build team rosters
        $homeRoster = $this->buildTeamRoster($homeTeam, $homeTactic);
        $awayRoster = $this->buildTeamRoster($awayTeam, $awayTactic);
        
        $prompt = "Simulate a football match between {$homeTeam->name} (home) and {$awayTeam->name} (away).

Match Context:
- Home Team: {$homeTeam->name} (Strength: {$homeStrength}) - USER MANAGED TEAM
- Away Team: {$awayTeam->name} (Strength: {$awayStrength}) - AI MANAGED TEAM
- Home Formation: {$homeFormation->display_name}
- Away Formation: {$awayFormation->display_name}
- Stadium: {$match->stadium}
- Weather: {$match->weather}, {$match->temperature}°C{$tacticalContext}{$tacticalAnalysis}

TEAM ROSTERS:{$homeRoster}{$awayRoster}

CRITICAL RULES - MUST FOLLOW:
- Players sent off (red card) CANNOT participate in any events after being sent off
- Substituted players CANNOT participate in any events after being substituted  
- Players with yellow cards can still play but are at risk of second yellow = red
- Each player can only be involved in one event per minute
- ONLY use player names from the provided team rosters above - DO NOT invent player names

TEAM MANAGEMENT RULES:
- {$userTeam->name} (USER MANAGED): Generate events (goals, cards, etc.) but DO NOT make tactical decisions (substitutions, formation changes)
- {$aiTeam->name} (AI MANAGED): Generate events AND can make tactical decisions (substitutions, formation changes) as needed
- Only the AI-managed team ({$aiTeam->name}) can make substitutions or tactical changes during the match
- The user-managed team ({$userTeam->name}) events should be generated based on their current setup and player performance

Generate match events for the full 90 minutes.

For each event, provide:
- minute (1-90)
        - type (goal, yellow_card, red_card, substitution, corner, free_kick, penalty, offside, foul)
        - team (home or away)
- player_name (MUST be a real player name from the team rosters above)
- description (brief summary)
- x_coordinate (0-100)
- y_coordinate (0-100)
- sub_events: Array of 3-6 commentary steps

Consider tactical setup and its impact on team performance.

Return ONLY a valid JSON array of events. No additional text.";

        // Debug: Log the complete prompt for Leicester City vs Arsenal match
        if (str_contains($homeTeam->name, 'Leicester') || str_contains($awayTeam->name, 'Leicester') || 
            str_contains($homeTeam->name, 'Arsenal') || str_contains($awayTeam->name, 'Arsenal')) {
            Log::info('AI Prompt for Leicester vs Arsenal match:', [
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name,
                'complete_prompt' => $prompt
            ]);
        }

        $response = $this->openAIService->generateText($prompt);
        
        // Debug: Log the AI response for troubleshooting
        Log::info('AI Response:', ['response' => $response]);
        
        // Clean the response by removing markdown code blocks
        $response = $this->cleanAIResponse($response);
        
        // Try to parse the AI response
        $events = json_decode($response, true);
        
        if (!is_array($events) || empty($events)) {
            Log::error('AI Response parsing failed:', [
                'response' => $response,
                'json_error' => json_last_error_msg(),
                'decoded' => $events
            ]);
            throw new \Exception('Invalid AI response format');
        }
        
        return $this->processAndSaveEvents($match, $events, $homeTeam, $awayTeam);
    }

    private function simulateWithFallback(GameMatch $match, Team $homeTeam, Team $awayTeam, $homeTactic = null, $awayTactic = null): array
    {
        $events = [];
        $homeScore = 0;
        $awayScore = 0;
        
        // Get team strengths (simplified calculation)
        $homeStrength = $this->calculateTeamStrength($homeTeam);
        $awayStrength = $this->calculateTeamStrength($awayTeam);
        
        // Apply tactical effects if custom positions exist
        if ($homeTactic && $homeTactic->custom_positions) {
            $homeStrength += $this->calculateMatchTacticEffect($homeTactic);
        }
        if ($awayTactic && $awayTactic->custom_positions) {
            $awayStrength += $this->calculateMatchTacticEffect($awayTactic);
        }
        
        // Home advantage
        $homeStrength *= 1.1;
        
        // Match state tracking
        $matchState = [
            'home_cards' => ['yellow' => 0, 'red' => 0],
            'away_cards' => ['yellow' => 0, 'red' => 0],
            'home_substitutions' => 0,
            'away_substitutions' => 0,
            'intensity' => 'normal', // low, normal, high
            'momentum' => 'neutral', // home, away, neutral
        ];
        
        // Generate events for different periods
        $events = array_merge(
            $this->generatePeriodEvents($homeTeam, $awayTeam, $homeStrength, $awayStrength, 1, 45, $matchState, $homeScore, $awayScore),
            $this->generatePeriodEvents($homeTeam, $awayTeam, $homeStrength, $awayStrength, 46, 90, $matchState, $homeScore, $awayScore)
        );
        
        // Add injury time events if needed
        if (rand(1, 100) <= 70) {
            $injuryTime = rand(1, 5);
            $injuryEvents = $this->generatePeriodEvents($homeTeam, $awayTeam, $homeStrength, $awayStrength, 91, 90 + $injuryTime, $matchState, $homeScore, $awayScore);
            $events = array_merge($events, $injuryEvents);
        }
        
        // Sort events by minute
        usort($events, function($a, $b) {
            return $a['minute'] <=> $b['minute'];
        });
        
        // Calculate final scores from events
        foreach ($events as $event) {
            if ($event['type'] === 'goal') {
                if ($event['team'] === 'home') {
                    $homeScore++;
                } else {
                    $awayScore++;
                }
            }
        }
        
        // Ensure we have at least one significant event
        if (empty($events) || ($homeScore === 0 && $awayScore === 0 && rand(1, 100) <= 30)) {
            $events[] = $this->generateLateGoal($homeTeam, $awayTeam, $homeStrength, $awayStrength);
            if ($events[count($events) - 1]['team'] === 'home') {
                $homeScore++;
            } else {
                $awayScore++;
            }
        }
        
        return $this->processAndSaveEvents($match, $events, $homeTeam, $awayTeam, $homeScore, $awayScore);
    }

    private function getRandomEventType(): string
    {
        $eventTypes = [
            'goal' => 15,
            'yellow_card' => 20,
            'substitution' => 20,
            'corner' => 15,
            'free_kick' => 10,
            'foul' => 10,
            'offside' => 5,
            'red_card' => 3,
            'penalty' => 2
        ];
        
        $rand = rand(1, 100);
        $cumulative = 0;
        
        foreach ($eventTypes as $type => $probability) {
            $cumulative += $probability;
            if ($rand <= $cumulative) {
                return $type;
            }
        }
        
        return 'foul'; // fallback
    }

    private function generateEventDescription(string $eventType, string $playerName, string $teamName): string
    {
        $descriptions = [
            'goal' => [
                "{$playerName} finds the back of the net with a brilliant finish!",
                "What a strike from {$playerName}! The crowd erupts!",
                "{$playerName} slots it home beautifully for {$teamName}!",
                "Clinical finish by {$playerName} gives {$teamName} the lead!",
                "{$playerName} with a moment of magic to score!"
            ],
            'yellow_card' => [
                "{$playerName} picks up a yellow card for a reckless challenge",
                "The referee shows {$playerName} a yellow card",
                "{$playerName} goes into the book for dissent",
                "Yellow card for {$playerName} after a late tackle",
                "{$playerName} cautioned for unsporting behavior"
            ],
            'red_card' => [
                "{$playerName} sees red! What a moment of madness!",
                "Straight red card for {$playerName}! The referee had no choice",
                "{$playerName} is sent off for a dangerous tackle",
                "Second yellow means {$playerName} is heading for an early bath"
            ],
            'substitution' => [
                "{$playerName} is brought on to make an impact",
                "Tactical substitution as {$playerName} enters the fray",
                "{$playerName} comes on for the final push",
                "Fresh legs as {$playerName} joins the action"
            ],
            'corner' => [
                "{$playerName} wins a corner kick for {$teamName}",
                "Corner kick earned by {$playerName} after good work",
                "{$playerName} forces a corner with a dangerous cross"
            ],
            'free_kick' => [
                "{$playerName} earns a free kick in a dangerous position",
                "Free kick to {$teamName} after {$playerName} is fouled",
                "{$playerName} wins a set piece opportunity"
            ],
            'penalty' => [
                "Penalty! {$playerName} is brought down in the box!",
                "{$playerName} wins a crucial penalty for {$teamName}",
                "The referee points to the spot after {$playerName} is fouled"
            ],
            'offside' => [
                "{$playerName} is caught offside, flag goes up",
                "Offside against {$playerName}, good timing by the defense",
                "{$playerName} strayed just offside, close call"
            ],
            'foul' => [
                "{$playerName} commits a foul, referee blows the whistle",
                "Foul by {$playerName} stops the attacking move",
                "{$playerName} brings down the opponent, free kick awarded"
            ]
        ];
        
        $eventDescriptions = $descriptions[$eventType] ?? ["{$playerName} involved in a {$eventType}"];
        return $eventDescriptions[array_rand($eventDescriptions)];
    }

    private function generateEventCoordinates(string $eventType, bool $isHomeTeam): array
    {
        // Generate realistic coordinates based on event type and team
        switch ($eventType) {
            case 'goal':
                return [
                    'x' => $isHomeTeam ? rand(80, 100) : rand(0, 20),
                    'y' => rand(30, 70)
                ];
            case 'corner':
                return [
                    'x' => $isHomeTeam ? rand(85, 100) : rand(0, 15),
                    'y' => rand(0, 15) > 7 ? rand(0, 10) : rand(90, 100)
                ];
            case 'penalty':
                return [
                    'x' => $isHomeTeam ? rand(88, 100) : rand(0, 12),
                    'y' => rand(40, 60)
                ];
            default:
                return [
                    'x' => rand(20, 80),
                    'y' => rand(20, 80)
                ];
        }
    }

    private function generateRandomPlayerName(): string
    {
        $firstNames = ['John', 'David', 'Michael', 'James', 'Robert', 'William', 'Richard', 'Charles', 'Joseph', 'Thomas', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth'];
        $lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
        
        return $firstNames[array_rand($firstNames)] . ' ' . $lastNames[array_rand($lastNames)];
    }

    private function calculateTeamStrength(Team $team): float
    {
        // Simple team strength calculation based on player abilities
        $totalAbility = $team->players()->with('attributes')->get()->sum(function ($player) {
            return $player->attributes ? $player->attributes->current_ability : 50;
        });
        $playerCount = $team->players()->count();
        
        return $playerCount > 0 ? ($totalAbility / $playerCount) : 50;
    }

    private function buildMatchContext(Team $homeTeam, Team $awayTeam, GameMatch $match, $homeTactic = null, $awayTactic = null): string
    {
        $homeStrength = $this->calculateTeamStrength($homeTeam);
        $awayStrength = $this->calculateTeamStrength($awayTeam);
        
        // Get formations and starting XI
        $homeFormation = $match->homeFormation;
        $awayFormation = $match->awayFormation;
        $homeStartingXI = $this->getStartingXI($homeTeam, $homeFormation);
        $awayStartingXI = $this->getStartingXI($awayTeam, $awayFormation);
        
        // Get tactical setup
        $homeTactics = $this->getTacticalSetup($homeTeam, $homeFormation);
        $awayTactics = $this->getTacticalSetup($awayTeam, $awayFormation);
        
        $context = "MATCH: {$homeTeam->name} vs {$awayTeam->name} at {$match->stadium}\n";
        $context .= "Weather: {$match->weather}, {$match->temperature}°C\n\n";
        
        $context .= "HOME TEAM: {$homeTeam->name} (Strength: {$homeStrength})\n";
        $context .= "Formation: {$homeFormation->display_name} ({$homeFormation->name})\n";
        $context .= "Tactics: {$homeTactics}\n";
        
        // Add custom positions information for home team
        if ($homeTactic && $homeTactic->custom_positions) {
            $context .= "CUSTOM POSITIONS: Modified formation with custom player positions\n";
            foreach ($homeTactic->custom_positions as $index => $position) {
                $context .= "- Position " . ($index + 1) . ": ({$position['x']}, {$position['y']}) - {$position['position']}\n";
            }
        }
        
        $context .= "STARTING XI:\n{$homeStartingXI}\n\n";
        
        $context .= "AWAY TEAM: {$awayTeam->name} (Strength: {$awayStrength})\n";
        $context .= "Formation: {$awayFormation->display_name} ({$awayFormation->name})\n";
        $context .= "Tactics: {$awayTactics}\n";
        
        // Add custom positions information for away team
        if ($awayTactic && $awayTactic->custom_positions) {
            $context .= "CUSTOM POSITIONS: Modified formation with custom player positions\n";
            foreach ($awayTactic->custom_positions as $index => $position) {
                $context .= "- Position " . ($index + 1) . ": ({$position['x']}, {$position['y']}) - {$position['position']}\n";
            }
        }
        
        $context .= "STARTING XI:\n{$awayStartingXI}\n\n";
        
        $context .= "INSTRUCTIONS:\n";
        $context .= "- Use ONLY players from the starting XI for events (unless substituted)\n";
        $context .= "- Consider player positions and formations when selecting players for events\n";
        $context .= "- Goalkeepers for saves, defenders for tackles, midfielders for passing, forwards for goals\n";
        $context .= "- Respect tactical setup and player roles\n";
        $context .= "- If custom positions are specified, consider how they affect team coordination and effectiveness\n";
        $context .= "- Custom positions may create defensive gaps or attacking opportunities - reflect this in events\n";
        $context .= "- Substitutions bring in bench players\n";
        
        // Add specific tactical analysis
        $context .= "\nTACTICAL ANALYSIS:\n";
        
        // Analyze home team tactics
        if ($homeTactic && $homeTactic->custom_positions) {
            $homeAnalysis = $this->analyzeTacticalSetup($homeTactic, $homeTeam->name);
            $context .= "HOME TEAM ({$homeTeam->name}) TACTICAL ANALYSIS:\n{$homeAnalysis}\n";
        }
        
        // Analyze away team tactics
        if ($awayTactic && $awayTactic->custom_positions) {
            $awayAnalysis = $this->analyzeTacticalSetup($awayTactic, $awayTeam->name);
            $context .= "AWAY TEAM ({$awayTeam->name}) TACTICAL ANALYSIS:\n{$awayAnalysis}\n";
        }
        
        return $context;
    }
    
    private function getStartingXI(Team $team, Formation $formation): string
    {
        $startingXI = "";
        $players = $team->players()->with(['primaryPosition', 'attributes'])->get();
        
        // Get formation positions
        $formationPositions = $formation->positions;
        
        // Group players by position category for selection
        $playersByCategory = [
            'goalkeeper' => $players->filter(fn($p) => $p->primaryPosition?->category === 'goalkeeper')
                                   ->sortByDesc(fn($p) => $p->attributes?->current_ability ?? 0),
            'defender' => $players->filter(fn($p) => $p->primaryPosition?->category === 'defender')
                                 ->sortByDesc(fn($p) => $p->attributes?->current_ability ?? 0),
            'midfielder' => $players->filter(fn($p) => $p->primaryPosition?->category === 'midfielder')
                                   ->sortByDesc(fn($p) => $p->attributes?->current_ability ?? 0),
            'forward' => $players->filter(fn($p) => $p->primaryPosition?->category === 'forward')
                                ->sortByDesc(fn($p) => $p->attributes?->current_ability ?? 0),
        ];
        
        // Select starting XI based on formation positions
        $selectedPlayers = [];
        $playerIndex = ['goalkeeper' => 0, 'defender' => 0, 'midfielder' => 0, 'forward' => 0];
        
        foreach ($formationPositions as $pos) {
            $position = $pos['position'];
            $category = $this->getPositionCategory($position);
            
            if ($category && isset($playersByCategory[$category])) {
                $availablePlayers = $playersByCategory[$category];
                $player = $availablePlayers->skip($playerIndex[$category])->first();
                
                if ($player) {
                    $ability = $player->attributes ? round($player->attributes->current_ability, 0) : 50;
                    $selectedPlayers[] = [
                        'name' => $this->getPlayerFullName($player),
                        'position' => $position,
                        'ability' => $ability,
                        'category' => $category
                    ];
                    $playerIndex[$category]++;
                }
            }
        }
        
        // Format starting XI by position
        $lineup = ['GK' => [], 'DEF' => [], 'MID' => [], 'FWD' => []];
        
        foreach ($selectedPlayers as $player) {
            switch ($player['category']) {
                case 'goalkeeper':
                    $lineup['GK'][] = "{$player['name']} ({$player['position']}, {$player['ability']})";
                    break;
                case 'defender':
                    $lineup['DEF'][] = "{$player['name']} ({$player['position']}, {$player['ability']})";
                    break;
                case 'midfielder':
                    $lineup['MID'][] = "{$player['name']} ({$player['position']}, {$player['ability']})";
                    break;
                case 'forward':
                    $lineup['FWD'][] = "{$player['name']} ({$player['position']}, {$player['ability']})";
                    break;
            }
        }
        
        foreach ($lineup as $line => $players) {
            if (!empty($players)) {
                $startingXI .= "{$line}: " . implode(', ', $players) . "\n";
            }
        }
        
        return $startingXI;
    }
    
    private function getPositionCategory(string $position): ?string
    {
        $positionMap = [
            'GK' => 'goalkeeper',
            'CB' => 'defender',
            'LB' => 'defender',
            'RB' => 'defender',
            'WB' => 'defender',
            'SW' => 'defender',
            'DM' => 'midfielder',
            'CM' => 'midfielder',
            'AM' => 'midfielder',
            'LM' => 'midfielder',
            'RM' => 'midfielder',
            'ST' => 'forward',
            'CF' => 'forward',
            'LW' => 'forward',
            'RW' => 'forward',
            'F9' => 'forward',
        ];
        
        return $positionMap[$position] ?? null;
    }
    
    private function getTacticalSetup(Team $team, Formation $formation): string
    {
        // For now, return basic tactical info based on formation
        // In a full implementation, this would come from the team's tactics
        $style = $formation->style;
        $mentality = $this->getMentalityFromFormation($formation);
        
        return "Style: {$style}, Mentality: {$mentality}, Pressing: Standard";
    }
    
    private function getMentalityFromFormation(Formation $formation): string
    {
        // Determine mentality based on formation structure
        if ($formation->forwards_count >= 3) {
            return 'Attacking';
        } elseif ($formation->defenders_count >= 5) {
            return 'Defensive';
        } else {
            return 'Balanced';
        }
    }
     
     private function processAndSaveEvents(GameMatch $match, array $events, Team $homeTeam, Team $awayTeam, ?int $homeScore = null, ?int $awayScore = null): array
    {
        $homeGoals = 0;
        $awayGoals = 0;
        $savedEvents = [];
        
        foreach ($events as $eventData) {
            // Count goals if not provided
            if ($eventData['type'] === 'goal') {
                if ($eventData['team'] === 'home') {
                    $homeGoals++;
                } else {
                    $awayGoals++;
                }
            }
            
            // Validate and fix player name
            $team = $eventData['team'] === 'home' ? $homeTeam : $awayTeam;
            $validPlayerName = $this->getValidPlayerName($eventData['player_name'], $team);
            
            // Log if player name was invalid
            if ($validPlayerName !== $eventData['player_name']) {
                Log::warning('Invalid player name replaced', [
                    'original' => $eventData['player_name'],
                    'replaced_with' => $validPlayerName,
                    'team' => $team->name,
                    'event_type' => $eventData['type']
                ]);
            }
            
            // Use description as commentary if commentary is not provided (for OpenAI events)
            $commentary = $eventData['commentary'] ?? $eventData['description'];
            
            // Create match event
            $matchEvent = MatchEvent::create([
                'match_id' => $match->id,
                'minute' => $eventData['minute'],
                'event_type' => $eventData['type'],
                'team_type' => $eventData['team'], // 'home' or 'away'
                'player_name' => $validPlayerName,
                'description' => $eventData['description'],
                'x_coordinate' => $eventData['x_coordinate'],
                'y_coordinate' => $eventData['y_coordinate'],
                'commentary' => $commentary,
                'sub_events' => $eventData['sub_events'] ?? null
            ]);
            
            $savedEvents[] = $matchEvent;
        }
        
        // Use provided scores or calculated ones
        $finalHomeScore = $homeScore ?? $homeGoals;
        $finalAwayScore = $awayScore ?? $awayGoals;
        
        // Update match with final score but keep status as in_progress for frontend timer
        $match->update([
            'home_score' => $finalHomeScore,
            'away_score' => $finalAwayScore,
            'status' => 'in_progress'
        ]);
        
        return $savedEvents;
    }

    private function generatePeriodEvents(Team $homeTeam, Team $awayTeam, float $homeStrength, float $awayStrength, int $startMinute, int $endMinute, array &$matchState, int &$homeScore, int &$awayScore): array
    {
        $events = [];
        $totalStrength = $homeStrength + $awayStrength;
        
        // Determine number of events based on period (simplified)
        $numEvents = rand(3, 6);
        
        // Generate all possible minutes and shuffle them
        $availableMinutes = range($startMinute, $endMinute);
        shuffle($availableMinutes);
        
        for ($i = 0; $i < min($numEvents, count($availableMinutes)); $i++) {
            $minute = $availableMinutes[$i];
            
            // Determine which team (influenced by momentum and strength)
            $momentumInfluence = $this->getMomentumInfluence($matchState['momentum']);
            $adjustedHomeStrength = $homeStrength * $momentumInfluence['home'];
            $adjustedAwayStrength = $awayStrength * $momentumInfluence['away'];
            $adjustedTotal = $adjustedHomeStrength + $adjustedAwayStrength;
            
            $isHomeTeam = (rand(1, 100) / 100) < ($adjustedHomeStrength / $adjustedTotal);
            $team = $isHomeTeam ? 'home' : 'away';
            $teamModel = $isHomeTeam ? $homeTeam : $awayTeam;
            $oppositionTeam = $isHomeTeam ? $awayTeam : $homeTeam;
            
            // Determine event type with contextual probabilities (considering team type)
            $eventType = $this->getContextualEventType($minute, $matchState, $homeScore, $awayScore, $team);
            
            // Get player (simplified)
            $player = $teamModel->players()->inRandomOrder()->first();
            $playerName = $player ? $this->getPlayerFullName($player) : $this->generateRandomPlayerName();
            
            // Use improved player selection that tracks player states
            $pastEvents = $matchState['past_events'] ?? [];
            $playerName = $this->getRandomAvailablePlayer($teamModel, $pastEvents, $eventType);
            
            // Generate detailed event description and commentary
            $eventDetails = $this->generateDetailedEvent($eventType, $playerName, $teamModel, $oppositionTeam, $minute, $matchState);
            
            // Update match state based on event
            $this->updateMatchState($matchState, $eventType, $team, $minute, $homeScore, $awayScore);
            
            // Update scores if goal
            if ($eventType === 'goal') {
                if ($team === 'home') {
                    $homeScore++;
                } else {
                    $awayScore++;
                }
            }
            
            $events[] = [
                'minute' => $minute,
                'type' => $eventType,
                'team' => $team,
                'player_name' => $playerName,
                'description' => $eventDetails['description'],
                'commentary' => $eventDetails['commentary'],
                'sub_events' => $eventDetails['sub_events'] ?? null,
                'x_coordinate' => $eventDetails['coordinates']['x'],
                'y_coordinate' => $eventDetails['coordinates']['y']
            ];
            
            // Debug: Log the event being created
            Log::info('Creating event:', [
                'minute' => $minute,
                'type' => $eventType,
                'team' => $team,
                'player_name' => $playerName,
                'x_coordinate' => $eventDetails['coordinates']['x'],
                'y_coordinate' => $eventDetails['coordinates']['y']
            ]);
        }
        
        return $events;
    }

    private function getContextualEventType(int $minute, array $matchState, int $homeScore, int $awayScore, string $teamType = 'away'): string
    {
        $probabilities = [
            'goal' => 8,
            'yellow_card' => 12,
            'red_card' => 1,
            'substitution' => 10,
            'corner' => 15,
            'free_kick' => 20,
            'offside' => 12,
            'save' => 8,
            'shot_blocked' => 10,
            'foul' => 4
        ];
        
        // Only allow substitutions for AI-managed team (away team)
        if ($teamType === 'home') {
            $probabilities['substitution'] = 0; // User-managed team cannot make substitutions via AI
        }
        
        // Adjust probabilities based on context
        if ($minute > 80) {
            $probabilities['goal'] += 3; // More goals in final minutes
            $probabilities['yellow_card'] += 5; // More cards due to desperation
        }
        
        if ($minute > 60 && $matchState['home_substitutions'] < 3) {
            // Only increase substitution probability for AI-managed team
            if ($teamType === 'away') {
            $probabilities['substitution'] += 5;
            }
        }
        
        if (abs($homeScore - $awayScore) >= 2) {
            $probabilities['goal'] -= 2; // Less likely when one team is dominating
            $probabilities['yellow_card'] += 3; // More frustration
        }
        
        if ($matchState['intensity'] === 'high') {
            $probabilities['foul'] += 3;
            $probabilities['yellow_card'] += 3;
        }
        
        return $this->getRandomEventFromProbabilities($probabilities);
    }

    private function getRandomEventFromProbabilities(array $probabilities): string
    {
        $total = array_sum($probabilities);
        $rand = rand(1, $total);
        $current = 0;
        
        foreach ($probabilities as $event => $probability) {
            $current += $probability;
            if ($rand <= $current) {
                return $event;
            }
        }
        
        return 'foul'; // fallback
    }

    private function getMomentumInfluence(string $momentum): array
    {
        switch ($momentum) {
            case 'home':
                return ['home' => 1.2, 'away' => 0.8];
            case 'away':
                return ['home' => 0.8, 'away' => 1.2];
            default:
                return ['home' => 1.0, 'away' => 1.0];
        }
    }

    private function getContextualPlayer(Team $team, string $eventType, $tactic = null): ?Player
    {
        // Get all players once to avoid multiple queries
        $players = $team->players()->get();
        
        if ($players->isEmpty()) {
            return null;
        }
        
        switch ($eventType) {
            case 'goal':
            case 'shot_blocked':
                // Prefer forwards and attacking midfielders
                $attackingPlayers = $players->filter(function($player) use ($tactic) {
                    if ($tactic) {
                        $tacticalPosition = $this->getPlayerTacticalPosition($player, $tactic);
                        return $tacticalPosition && in_array($tacticalPosition, ['ST', 'CF', 'LW', 'RW', 'AM']);
                    }
                    return $player->primaryPosition && in_array($player->primaryPosition->name, ['Striker', 'Attacking Midfielder', 'Winger']);
                });
                return $attackingPlayers->isNotEmpty() ? $attackingPlayers->random() : $players->random();
                    
            case 'save':
                // Prefer goalkeepers
                $goalkeepers = $players->filter(function($player) use ($tactic) {
                    if ($tactic) {
                        $tacticalPosition = $this->getPlayerTacticalPosition($player, $tactic);
                        return $tacticalPosition === 'GK';
                    }
                    return $player->primaryPosition && $player->primaryPosition->name === 'Goalkeeper';
                });
                return $goalkeepers->isNotEmpty() ? $goalkeepers->random() : $players->random();
                    
            case 'yellow_card':
            case 'red_card':
            case 'foul':
                // Prefer defenders and defensive midfielders
                $defensivePlayers = $players->filter(function($player) use ($tactic) {
                    if ($tactic) {
                        $tacticalPosition = $this->getPlayerTacticalPosition($player, $tactic);
                        return $tacticalPosition && in_array($tacticalPosition, ['CB', 'LB', 'RB', 'WB', 'DM']);
                    }
                    return $player->primaryPosition && in_array($player->primaryPosition->name, ['Centre-Back', 'Full-Back', 'Defensive Midfielder']);
                });
                return $defensivePlayers->isNotEmpty() ? $defensivePlayers->random() : $players->random();
                    
            default:
                return $players->random();
        }
    }

    private function generateDetailedEvent(string $eventType, string $playerName, Team $team, Team $oppositionTeam, int $minute, array $matchState): array
    {
        $coordinates = $this->generateEventCoordinates($eventType, $team->name === $team->name);
        
        // Ensure coordinates are always set
        if (!isset($coordinates['x']) || !isset($coordinates['y'])) {
            Log::warning('Invalid coordinates generated, using defaults', [
                'eventType' => $eventType,
                'coordinates' => $coordinates
            ]);
            $coordinates = ['x' => rand(20, 80), 'y' => rand(20, 80)];
        }
        
        switch ($eventType) {
            case 'goal':
                return [
                    'description' => $this->generateGoalDescription($playerName, $team->name, $minute),
                    'commentary' => $this->generateGoalCommentary($playerName, $team->name, $minute, $matchState),
                    'sub_events' => $this->generateGoalSubEvents($playerName, $team->name, $oppositionTeam->name, $minute),
                    'coordinates' => $coordinates
                ];
                
            case 'yellow_card':
                return [
                    'description' => $this->generateCardDescription($playerName, 'yellow', $minute),
                    'commentary' => $this->generateCardCommentary($playerName, 'yellow', $minute),
                    'sub_events' => $this->generateCardSubEvents($playerName, 'yellow', $team->name, $oppositionTeam->name),
                    'coordinates' => $coordinates
                ];
                
            case 'red_card':
                return [
                    'description' => $this->generateCardDescription($playerName, 'red', $minute),
                    'commentary' => $this->generateCardCommentary($playerName, 'red', $minute),
                    'sub_events' => $this->generateCardSubEvents($playerName, 'red', $team->name, $oppositionTeam->name),
                    'coordinates' => $coordinates
                ];
                
            case 'substitution':
                return [
                    'description' => $this->generateSubstitutionDescription($playerName, $team->name),
                    'commentary' => $this->generateSubstitutionCommentary($playerName, $team->name, $minute),
                    'coordinates' => $coordinates
                ];
                
            case 'save':
                return [
                    'description' => $this->generateSaveDescription($playerName, $oppositionTeam->name),
                    'commentary' => $this->generateSaveCommentary($playerName, $oppositionTeam->name, $minute),
                    'coordinates' => $coordinates
                ];
                
            case 'corner':
                return [
                    'description' => $this->generateCornerDescription($playerName, $team->name),
                    'commentary' => $this->generateCornerCommentary($playerName, $team->name, $minute),
                    'coordinates' => $coordinates
                ];
                
            case 'free_kick':
                return [
                    'description' => $this->generateFreeKickDescription($playerName, $team->name),
                    'commentary' => $this->generateFreeKickCommentary($playerName, $team->name, $minute),
                    'coordinates' => $coordinates
                ];
                
            case 'offside':
                return [
                    'description' => $this->generateOffsideDescription($playerName),
                    'commentary' => $this->generateOffsideCommentary($playerName, $minute),
                    'coordinates' => $coordinates
                ];
                
            case 'shot_blocked':
                return [
                    'description' => $this->generateShotBlockedDescription($playerName, $team->name),
                    'commentary' => $this->generateShotBlockedCommentary($playerName, $team->name, $minute),
                    'coordinates' => $coordinates
                ];
                
            case 'foul':
                return [
                    'description' => $this->generateFoulDescription($playerName, $oppositionTeam->name),
                    'commentary' => $this->generateFoulCommentary($playerName, $minute),
                    'coordinates' => $coordinates
                ];
                
            default:
                return [
                    'description' => "{$playerName} is involved in the action",
                    'commentary' => "An incident involving {$playerName} in the {$minute}th minute",
                    'coordinates' => $coordinates
                ];
        }
    }

    private function generateGoalDescription(string $playerName, string $teamName, int $minute): string
    {
        $descriptions = [
            "GOAL! {$playerName} finds the back of the net with a brilliant finish for {$teamName}!",
            "{$playerName} slots it home beautifully for {$teamName}!",
            "Clinical finish by {$playerName} gives {$teamName} the lead!",
            "{$playerName} with a moment of magic to score for {$teamName}!",
            "What a strike! {$playerName} hammers it into the top corner for {$teamName}!",
            "{$playerName} pounces on the loose ball and scores for {$teamName}!",
            "Brilliant individual effort from {$playerName} results in a goal for {$teamName}!",
            "{$playerName} with a composed finish to put {$teamName} ahead!",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateGoalCommentary(string $playerName, string $teamName, int $minute, array $matchState): string
    {
        $timeContext = $minute <= 15 ? "early" : ($minute >= 75 ? "late" : "");
        $intensity = $matchState['intensity'] === 'high' ? "in this intense encounter" : "";
        
        $commentaries = [
            "What a finish from {$playerName}! The {$teamName} striker shows great composure {$timeContext} in the match {$intensity}.",
            "{$playerName} breaks the deadlock with a superb goal! The crowd erupts as {$teamName} take the lead.",
            "Magnificent strike from {$playerName}! That's exactly what {$teamName} needed {$timeContext} in this contest.",
            "{$playerName} finds the target with a well-taken goal! The {$teamName} fans are in raptures.",
            "Clinical finishing from {$playerName}! {$teamName} capitalize on their pressure with a crucial goal.",
            "What a moment for {$playerName}! The ball sits up perfectly and the {$teamName} player doesn't miss.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateCardDescription(string $playerName, string $cardType, int $minute): string
    {
        if ($cardType === 'yellow') {
            $descriptions = [
                "The referee shows {$playerName} a yellow card for a reckless challenge",
                "{$playerName} goes into the book for dissent",
                "Yellow card for {$playerName} after a late tackle",
                "{$playerName} is cautioned for time-wasting",
                "The referee has no choice but to book {$playerName}",
            ];
        } else {
            $descriptions = [
                "Straight red card for {$playerName}! The referee had no choice",
                "{$playerName} is sent off for a dangerous tackle!",
                "Red card! {$playerName} sees red for violent conduct",
                "{$playerName} is dismissed after receiving a second yellow card",
                "The referee reaches for the red card - {$playerName} is off!",
            ];
        }
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateCardCommentary(string $playerName, string $cardType, int $minute): string
    {
        if ($cardType === 'yellow') {
            $commentaries = [
                "{$playerName} will need to be careful now, already on a yellow card.",
                "A justified booking for {$playerName} there. The referee got that decision right.",
                "That's a yellow card that {$playerName} can't really complain about.",
                "{$playerName} goes into the referee's book. A moment of indiscipline there.",
            ];
        } else {
            $commentaries = [
                "That's a game-changing moment! {$playerName} leaves his team with 10 men.",
                "What a turning point in the match! {$playerName} is sent off in the {$minute}th minute.",
                "The referee had no alternative there. {$playerName} has let his team down.",
                "Disaster for {$playerName} and his team! That red card changes everything.",
            ];
        }
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateSubstitutionDescription(string $playerName, string $teamName): string
    {
        $descriptions = [
            "Tactical substitution as {$playerName} enters the fray for {$teamName}",
            "{$playerName} is brought on to make an impact for {$teamName}",
            "Fresh legs as {$playerName} joins the action for {$teamName}",
            "{$playerName} comes on to try and change the game for {$teamName}",
            "Strategic change as {$playerName} is introduced for {$teamName}",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateSubstitutionCommentary(string $playerName, string $teamName, int $minute): string
    {
        $commentaries = [
            "{$teamName} make a tactical change as {$playerName} enters the fray. Can they make the difference?",
            "Fresh legs for {$teamName} as {$playerName} comes on. The manager looking to change the dynamic.",
            "{$playerName} gets the call from the bench. {$teamName} looking to inject some energy into their play.",
            "A strategic substitution by {$teamName} as {$playerName} is introduced to the match.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateSaveDescription(string $playerName, string $oppositionTeam): string
    {
        $descriptions = [
            "Brilliant save by {$playerName} to deny {$oppositionTeam}!",
            "{$playerName} makes a crucial stop to keep {$oppositionTeam} at bay",
            "What a save! {$playerName} shows great reflexes",
            "{$playerName} pulls off a spectacular save to frustrate {$oppositionTeam}",
            "Outstanding goalkeeping from {$playerName} to prevent a certain goal",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateSaveCommentary(string $playerName, string $oppositionTeam, int $minute): string
    {
        $commentaries = [
            "What a save from {$playerName}! That looked destined for the top corner.",
            "{$playerName} shows why they're considered one of the best keepers around with that save.",
            "Incredible reflexes from {$playerName}! {$oppositionTeam} thought they had scored there.",
            "{$playerName} keeps their team in the game with a world-class save.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateCornerDescription(string $playerName, string $teamName): string
    {
        $descriptions = [
            "{$playerName} forces a corner with a dangerous cross for {$teamName}",
            "Corner kick for {$teamName} after {$playerName}'s effort is deflected",
            "{$playerName} wins a corner for {$teamName} with a threatening attack",
            "Good work from {$playerName} earns {$teamName} a corner kick",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateCornerCommentary(string $playerName, string $teamName, int $minute): string
    {
        $commentaries = [
            "{$teamName} have a good opportunity here from the corner. {$playerName} did well to win it.",
            "Corner kick for {$teamName}. These set pieces can be crucial in tight matches.",
            "{$playerName} forces the corner with some good play down the flank. Dangerous moment for {$teamName}.",
            "Another corner for {$teamName}. They'll be looking to capitalize on this set piece opportunity.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateFreeKickDescription(string $playerName, string $teamName): string
    {
        $descriptions = [
            "{$playerName} earns a free kick in a dangerous position for {$teamName}",
            "Free kick for {$teamName} after {$playerName} is fouled",
            "{$playerName} wins a promising free kick for {$teamName}",
            "Good work from {$playerName} results in a free kick for {$teamName}",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateFreeKickCommentary(string $playerName, string $teamName, int $minute): string
    {
        $commentaries = [
            "{$teamName} have a free kick in a promising position. {$playerName} did well to win it.",
            "Free kick for {$teamName} in a dangerous area. This could be a good opportunity.",
            "{$playerName} draws the foul and earns {$teamName} a set piece chance.",
            "That's a well-won free kick by {$playerName}. {$teamName} will be looking to capitalize.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateOffsideDescription(string $playerName): string
    {
        $descriptions = [
            "{$playerName} is caught offside, flag goes up",
            "Offside flag raised against {$playerName}",
            "{$playerName} strays into an offside position",
            "The linesman's flag is up - {$playerName} was offside",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateOffsideCommentary(string $playerName, int $minute): string
    {
        $commentaries = [
            "{$playerName} was just a fraction too early there. Good call by the linesman.",
            "Offside against {$playerName}. The timing of that run was just slightly off.",
            "{$playerName} caught in an offside position. The defensive line did well to catch them out.",
            "The flag is up against {$playerName}. A well-timed offside trap by the defense.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateShotBlockedDescription(string $playerName, string $teamName): string
    {
        $descriptions = [
            "{$playerName}'s shot is blocked by a brave defender",
            "Great defending to block {$playerName}'s effort for {$teamName}",
            "{$playerName} sees their shot blocked at the crucial moment",
            "Heroic defending denies {$playerName} a clear shooting chance",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateShotBlockedCommentary(string $playerName, string $teamName, int $minute): string
    {
        $commentaries = [
            "{$playerName} got the shot away but it's blocked by some resolute defending.",
            "Great block! {$playerName} thought they had a clear sight of goal there.",
            "{$playerName} pulls the trigger but the defense stands firm to block the shot.",
            "Excellent defending to deny {$playerName} there. That was goal-bound.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function generateFoulDescription(string $playerName, string $oppositionTeam): string
    {
        $descriptions = [
            "{$playerName} commits a foul and gives away a free kick",
            "Foul by {$playerName} stops a promising {$oppositionTeam} attack",
            "{$playerName} brings down the {$oppositionTeam} player",
            "The referee blows for a foul by {$playerName}",
        ];
        
        return $descriptions[array_rand($descriptions)];
    }

    private function generateFoulCommentary(string $playerName, int $minute): string
    {
        $commentaries = [
            "{$playerName} commits the foul there. Perhaps a tactical decision to stop the attack.",
            "Foul by {$playerName}. The referee was quick to blow the whistle.",
            "{$playerName} brings down the opponent. A clear foul in the referee's eyes.",
            "The referee stops play for a foul by {$playerName}. A fair decision.",
        ];
        
        return $commentaries[array_rand($commentaries)];
    }

    private function updateMatchState(array &$matchState, string $eventType, string $team, int $minute, int $homeScore, int $awayScore): void
    {
        // Update cards
        if ($eventType === 'yellow_card') {
            $matchState[$team . '_cards']['yellow']++;
        } elseif ($eventType === 'red_card') {
            $matchState[$team . '_cards']['red']++;
        }
        
        // Update substitutions
        if ($eventType === 'substitution') {
            $matchState[$team . '_substitutions']++;
        }
        
        // Update intensity based on events and score
        if ($eventType === 'goal' || $eventType === 'red_card') {
            $matchState['intensity'] = 'high';
        } elseif ($minute > 80 && abs($homeScore - $awayScore) <= 1) {
            $matchState['intensity'] = 'high';
        }
        
        // Update momentum
        if ($eventType === 'goal') {
            $matchState['momentum'] = $team;
        } elseif ($eventType === 'red_card') {
            $matchState['momentum'] = $team === 'home' ? 'away' : 'home';
        }
    }

    private function generateLateGoal(Team $homeTeam, Team $awayTeam, float $homeStrength, float $awayStrength): array
    {
        $totalStrength = $homeStrength + $awayStrength;
        $isHomeTeam = (rand(1, 100) / 100) < ($homeStrength / $totalStrength);
        $team = $isHomeTeam ? 'home' : 'away';
        $teamModel = $isHomeTeam ? $homeTeam : $awayTeam;
        
        $player = $teamModel->players()->inRandomOrder()->first();
        $playerName = $player ? $this->getPlayerFullName($player) : $this->generateRandomPlayerName();
        $minute = rand(85, 90);
        
        return [
            'minute' => $minute,
            'type' => 'goal',
            'team' => $team,
            'player_name' => $playerName,
            'description' => "LATE DRAMA! {$playerName} scores a crucial late goal for {$teamModel->name}!",
            'commentary' => "What a moment! {$playerName} strikes late to give {$teamModel->name} a vital goal in the {$minute}th minute!",
            'x_coordinate' => rand(80, 100),
            'y_coordinate' => rand(25, 75)
        ];
    }

    private function generateGoalSubEvents(string $playerName, string $teamName, string $oppositionTeamName, int $minute): array
    {
        $subEvents = [];
        
        // Generate different types of goal scenarios
        $goalTypes = ['team_goal', 'individual_goal', 'counter_attack', 'set_piece'];
        $goalType = $goalTypes[array_rand($goalTypes)];
        
        switch ($goalType) {
            case 'team_goal':
                $subEvents[] = "{$playerName} receives the ball in midfield and looks up to assess his options";
                $subEvents[] = "A perfectly weighted pass finds a teammate in space on the right wing";
                $subEvents[] = "The winger beats his defender with a delicious feint and advances toward the penalty area";
                $subEvents[] = "A dangerous cross is whipped in, causing chaos in the {$oppositionTeamName} defense";
                $subEvents[] = "{$playerName} reacts quickest to the loose ball and strikes it cleanly past the goalkeeper!";
                $subEvents[] = "The {$teamName} players celebrate wildly as {$playerName} is mobbed by his teammates";
                break;
                
            case 'individual_goal':
                $subEvents[] = "{$playerName} picks up the ball in his own half and starts a determined run forward";
                $subEvents[] = "He skips past the first challenge with ease, his pace causing problems for the defense";
                $subEvents[] = "Two {$oppositionTeamName} defenders converge on him but {$playerName} finds a way through";
                $subEvents[] = "Now in the penalty area, {$playerName} steadies himself and picks his spot";
                $subEvents[] = "A clinical finish finds the bottom corner, giving the goalkeeper no chance!";
                $subEvents[] = "{$playerName} wheels away in celebration, having created something from nothing";
                break;
                
            case 'counter_attack':
                $subEvents[] = "{$teamName} win the ball back and immediately look to break forward";
                $subEvents[] = "{$playerName} receives the ball and has space to run into as {$oppositionTeamName} are caught out";
                $subEvents[] = "A quick one-two with a teammate leaves the defense scrambling to get back";
                $subEvents[] = "{$playerName} is through on goal with just the keeper to beat";
                $subEvents[] = "He keeps his composure and slots it home with a precise finish!";
                $subEvents[] = "A lightning-quick counter-attack ends with {$playerName} celebrating another goal";
                break;
                
            case 'set_piece':
                $subEvents[] = "{$teamName} win a free kick in a dangerous position just outside the area";
                $subEvents[] = "{$playerName} stands over the ball, eyeing up the goalkeeper's positioning";
                $subEvents[] = "The wall is set, the goalkeeper adjusts his position, the crowd holds its breath";
                $subEvents[] = "{$playerName} takes a few steps back and prepares for his run-up";
                $subEvents[] = "He strikes it beautifully, the ball curling around the wall and into the top corner!";
                $subEvents[] = "What a strike! {$playerName} has found the perfect spot with a magnificent free kick";
                break;
        }
        
        return $subEvents;
    }

    private function generateCardSubEvents(string $playerName, string $cardType, string $teamName, string $oppositionTeamName): array
    {
        $subEvents = [];
        
        // Generate different types of card scenarios
        $cardScenarios = ['aggressive_tackle', 'dissent', 'simulation', 'time_wasting', 'unsporting_behavior'];
        $scenario = $cardScenarios[array_rand($cardScenarios)];
        
        switch ($scenario) {
            case 'aggressive_tackle':
                $subEvents[] = "{$playerName} chases down an opponent who is breaking away with the ball";
                $subEvents[] = "The {$oppositionTeamName} player tries to shield the ball but {$playerName} goes in hard";
                $subEvents[] = "It's a late challenge that catches the opponent on the ankle";
                $subEvents[] = "The {$oppositionTeamName} player goes down in pain as the referee blows his whistle";
                $subEvents[] = "The referee reaches for his pocket and shows {$playerName} a {$cardType} card";
                if ($cardType === 'yellow') {
                    $subEvents[] = "{$playerName} accepts the booking and helps his opponent back to his feet";
                }
                break;
                
            case 'dissent':
                $subEvents[] = "The referee makes a decision that doesn't go {$teamName}'s way";
                $subEvents[] = "{$playerName} immediately protests the decision, gesturing wildly at the official";
                $subEvents[] = "The referee tries to calm {$playerName} down but he continues to argue";
                $subEvents[] = "Other players try to pull {$playerName} away but he's still complaining";
                $subEvents[] = "The referee has had enough and shows {$playerName} a {$cardType} card for dissent";
                $subEvents[] = "{$playerName} finally walks away, shaking his head in disbelief";
                break;
                
            case 'simulation':
                $subEvents[] = "{$playerName} goes down in the penalty area under a challenge";
                $subEvents[] = "He appeals for a penalty, looking directly at the referee";
                $subEvents[] = "The referee waves play on, indicating no foul was committed";
                $subEvents[] = "{$playerName} continues to protest from the ground";
                $subEvents[] = "After reviewing the incident, the referee decides it was simulation";
                $subEvents[] = "{$playerName} is shown a {$cardType} card for diving";
                break;
                
            case 'time_wasting':
                $subEvents[] = "{$playerName} takes his time over a throw-in, slowly walking to retrieve the ball";
                $subEvents[] = "The {$oppositionTeamName} players urge him to hurry up as time is running out";
                $subEvents[] = "{$playerName} continues to delay, adjusting his socks and boots";
                $subEvents[] = "The referee approaches and tells {$playerName} to speed up";
                $subEvents[] = "When {$playerName} continues to waste time, the referee loses patience";
                $subEvents[] = "A {$cardType} card is shown for time-wasting";
                break;
                
            case 'unsporting_behavior':
                $subEvents[] = "{$playerName} and an opponent compete for a loose ball";
                $subEvents[] = "After the challenge, {$playerName} makes a gesture that angers his opponent";
                $subEvents[] = "The two players square up to each other, exchanging words";
                $subEvents[] = "Other players rush in to separate them before things escalate";
                $subEvents[] = "The referee intervenes and calls both players over";
                $subEvents[] = "{$playerName} is shown a {$cardType} card for unsporting behavior";
                break;
        }
        
        return $subEvents;
    }

    /**
     * Regenerate events from a specific minute with new tactical context
     */
    public function regenerateEventsFromMinute(array $matchContext): array
    {
        $match = $matchContext['match'];
        $currentMinute = $matchContext['current_minute'];
        $homeScore = $matchContext['home_score'];
        $awayScore = $matchContext['away_score'];
        $pastEvents = $matchContext['past_events'];
        $tacticalChanges = $matchContext['tactical_changes'] ?? [];
        $momentum = $matchContext['momentum'] ?? 'balanced';
        $fatigueLevel = $matchContext['fatigue_level'] ?? 'low';

        $homeTeam = $match->homeTeam;
        $awayTeam = $match->awayTeam;

        // Calculate remaining time
        $remainingMinutes = 90 - $currentMinute;
        
        if ($remainingMinutes <= 0) {
            return [];
        }

        // Try AI-powered regeneration first
        if ($this->openAIService->isAvailable()) {
            try {
                return $this->regenerateWithAI($matchContext);
            } catch (\Exception $e) {
                Log::warning('AI event regeneration failed, falling back to programmatic: ' . $e->getMessage());
            }
        }

        // Fallback to programmatic generation
        return $this->regenerateWithFallback($matchContext);
    }

    /**
     * Regenerate events using AI with tactical context
     */
    private function regenerateWithAI(array $matchContext): array
    {
        $match = $matchContext['match'];
        $currentMinute = $matchContext['current_minute'];
        $homeScore = $matchContext['home_score'];
        $awayScore = $matchContext['away_score'];
        $pastEvents = $matchContext['past_events'];
        $tacticalChanges = $matchContext['tactical_changes'] ?? [];

        $homeTeam = $match->homeTeam;
        $awayTeam = $match->awayTeam;

        // Get team tactics
        $homeTactic = $homeTeam->tactics()->where('is_primary', true)->first();
        $awayTactic = $awayTeam->tactics()->where('is_primary', true)->first();

        // Determine team management roles
        $teamRoles = $this->getTeamManagementRoles($homeTeam, $awayTeam);
        $userTeam = $teamRoles['user_managed'];
        $aiTeam = $teamRoles['ai_managed'];
        $userTeamType = $teamRoles['user_team_type'];
        $aiTeamType = $teamRoles['ai_team_type'];

        // Build context for AI including tactical changes
        $tacticalContext = '';
        if (!empty($tacticalChanges)) {
            $tacticalContext = "\n\nTactical Changes Made:\n";
            foreach ($tacticalChanges as $change) {
                $teamName = $change['team_type'] === 'home' ? $homeTeam->name : $awayTeam->name;
                $tacticalContext .= "- {$teamName}: {$change['description']}\n";
            }
        }

        // Add detailed tactical information
        $homeMatchTactic = $matchContext['home_match_tactic'] ?? null;
        $awayMatchTactic = $matchContext['away_match_tactic'] ?? null;
        
        $detailedTacticalContext = '';
        if ($homeMatchTactic || $awayMatchTactic) {
            $detailedTacticalContext = "\n\nCurrent Tactical Setup:\n";
            
            if ($homeMatchTactic) {
                $detailedTacticalContext .= "\n{$homeTeam->name} (Home) Tactics:\n";
                if ($homeMatchTactic->custom_positions) {
                    $detailedTacticalContext .= "- Custom Formation: Modified positions\n";
                }
                if ($homeMatchTactic->player_assignments) {
                    $detailedTacticalContext .= "- Player Assignments: Custom player positions\n";
                }
                if ($homeMatchTactic->substitutions) {
                    $detailedTacticalContext .= "- Substitutions: " . count($homeMatchTactic->substitutions) . " made\n";
                }
            }
            
            if ($awayMatchTactic) {
                $detailedTacticalContext .= "\n{$awayTeam->name} (Away) Tactics:\n";
                if ($awayMatchTactic->custom_positions) {
                    $detailedTacticalContext .= "- Custom Formation: Modified positions\n";
                }
                if ($awayMatchTactic->player_assignments) {
                    $detailedTacticalContext .= "- Player Assignments: Custom player positions\n";
                }
                if ($awayMatchTactic->substitutions) {
                    $detailedTacticalContext .= "- Substitutions: " . count($awayMatchTactic->substitutions) . " made\n";
                }
            }
        }

        // Build past events summary
        $pastEventsSummary = '';
        if (!empty($pastEvents)) {
            $pastEventsSummary = "\n\nKey Past Events:\n";
            $keyEvents = array_slice($pastEvents->toArray(), -5); // Last 5 events
            foreach ($keyEvents as $event) {
                $pastEventsSummary .= "- Minute {$event['minute']}: {$event['description']}\n";
            }
        }

        // Build player state context
        $playerStateContext = $this->buildPlayerStateContext($pastEvents->toArray());

        // Build team rosters
        $homeRoster = $this->buildTeamRoster($homeTeam, $homeTactic);
        $awayRoster = $this->buildTeamRoster($awayTeam, $awayTactic);

        $prompt = "Continue simulating a football match between {$homeTeam->name} (home) and {$awayTeam->name} (away) from minute {$currentMinute} to 90.

Current Match State:
- Current Minute: {$currentMinute}
- Current Score: {$homeTeam->name} {$homeScore} - {$awayScore} {$awayTeam->name}
- Remaining Time: " . (90 - $currentMinute) . " minutes{$pastEventsSummary}{$tacticalContext}{$detailedTacticalContext}{$playerStateContext}

TEAM ROSTERS:{$homeRoster}{$awayRoster}

CRITICAL RULES - MUST FOLLOW:
- Players sent off (red card) CANNOT participate in any events after being sent off
- Substituted players CANNOT participate in any events after being substituted  
- Players with yellow cards can still play but are at risk of second yellow = red
- Each player can only be involved in one event per minute
- ONLY use player names from the provided team rosters above - DO NOT invent player names

TEAM MANAGEMENT RULES:
- {$userTeam->name} (USER MANAGED): Generate events (goals, cards, etc.) but DO NOT make tactical decisions (substitutions, formation changes)
- {$aiTeam->name} (AI MANAGED): Generate events AND can make tactical decisions (substitutions, formation changes) as needed
- Only the AI-managed team ({$aiTeam->name}) can make substitutions or tactical changes during the match
- The user-managed team ({$userTeam->name}) events should be generated based on their current setup and player performance
- If tactical changes were made by the user, reflect their impact on the user team's performance

Generate match events for the remaining time (minute " . ($currentMinute + 1) . " to 90).

For each event, provide:
- minute (between " . ($currentMinute + 1) . " and 90)
- type (goal, yellow_card, red_card, substitution, corner, free_kick, penalty, offside, foul)
- team (home or away)
- player_name (MUST be a real player name from the team rosters above)
- description (brief summary)
- x_coordinate (0-100)
- y_coordinate (0-100)
- sub_events: Array of 3-6 commentary steps

Consider tactical changes and their impact on team performance.

Return ONLY a valid JSON array of events. No additional text.";

        // Debug: Log the complete prompt for Leicester City vs Arsenal match
        if (str_contains($homeTeam->name, 'Leicester') || str_contains($awayTeam->name, 'Leicester') || 
            str_contains($homeTeam->name, 'Arsenal') || str_contains($awayTeam->name, 'Arsenal')) {
            Log::info('AI Regeneration Prompt for Leicester vs Arsenal match:', [
                'home_team' => $homeTeam->name,
                'away_team' => $awayTeam->name,
                'current_minute' => $currentMinute,
                'current_score' => "{$homeScore}-{$awayScore}",
                'complete_prompt' => $prompt
            ]);
        }
        
        $response = $this->openAIService->generateText($prompt);
        
        // Debug: Log the AI response for troubleshooting
        Log::info('AI Response:', ['response' => $response]);
        
        // Clean the response by removing markdown code blocks
        $response = $this->cleanAIResponse($response);
        
        // Try to parse the AI response
        $events = json_decode($response, true);
        
        if (!is_array($events) || empty($events)) {
            Log::error('AI Response parsing failed:', [
                'response' => $response,
                'json_error' => json_last_error_msg(),
                'decoded' => $events
            ]);
            throw new \Exception('Invalid AI response format for event regeneration');
        }

        // Validate and filter events to ensure they're in the correct time range
        $validEvents = [];
        foreach ($events as $event) {
            if (isset($event['minute']) && 
                $event['minute'] > $currentMinute && 
                $event['minute'] <= 90 &&
                isset($event['type']) && 
                isset($event['team']) && 
                isset($event['player_name'])) {
                $validEvents[] = $event;
            }
        }

        if (empty($validEvents)) {
            throw new \Exception('No valid events generated by AI');
        }

        return $this->processAndSaveEvents($match, $validEvents, $homeTeam, $awayTeam, $homeScore, $awayScore);
    }

    /**
     * Regenerate events using programmatic fallback
     */
    private function regenerateWithFallback(array $matchContext): array
    {
        $match = $matchContext['match'];
        $currentMinute = $matchContext['current_minute'];
        $homeScore = $matchContext['home_score'];
        $awayScore = $matchContext['away_score'];
        $pastEvents = $matchContext['past_events'];
        $tacticalChanges = $matchContext['tactical_changes'] ?? [];
        $momentum = $matchContext['momentum'] ?? 'balanced';
        $fatigueLevel = $matchContext['fatigue_level'] ?? 'low';

        $homeTeam = $match->homeTeam;
        $awayTeam = $match->awayTeam;

        // Calculate current team strengths considering fatigue and tactical changes
        $homeStrength = $this->calculateTeamStrength($homeTeam);
        $awayStrength = $this->calculateTeamStrength($awayTeam);

        // Apply tactical change effects
        foreach ($tacticalChanges as $change) {
            $effect = $this->getTacticalChangeEffect($change);
            if ($change['team_type'] === 'home') {
                $homeStrength += $effect;
            } else {
                $awayStrength += $effect;
            }
        }

        // Apply match-specific tactical effects
        $homeMatchTactic = $matchContext['home_match_tactic'] ?? null;
        $awayMatchTactic = $matchContext['away_match_tactic'] ?? null;
        
        if ($homeMatchTactic) {
            $homeStrength += $this->calculateMatchTacticEffect($homeMatchTactic);
        }
        if ($awayMatchTactic) {
            $awayStrength += $this->calculateMatchTacticEffect($awayMatchTactic);
        }

        // Initialize match state based on past events
        $matchState = [
            'intensity' => $this->calculateIntensity($pastEvents),
            'momentum' => $momentum,
            'fatigue_level' => $fatigueLevel,
            'home_confidence' => $this->calculateConfidence($homeScore, $awayScore, $currentMinute),
            'away_confidence' => $this->calculateConfidence($awayScore, $homeScore, $currentMinute),
            'home_cards' => ['yellow' => 0, 'red' => 0],
            'away_cards' => ['yellow' => 0, 'red' => 0],
            'home_substitutions' => 0,
            'away_substitutions' => 0,
            'past_events' => $pastEvents->toArray(), // Add past events for player tracking
        ];

        // Generate events for remaining time
        $newEvents = $this->generatePeriodEvents(
            $homeTeam,
            $awayTeam,
            $homeStrength,
            $awayStrength,
            $currentMinute + 1,
            90,
            $matchState,
            $homeScore,
            $awayScore
        );

        // Process and save the new events
        return $this->processAndSaveEvents($match, $newEvents, $homeTeam, $awayTeam, $homeScore, $awayScore);
    }

    /**
     * Calculate intensity based on past events
     */
    private function calculateIntensity($pastEvents): string
    {
        $intenseEvents = 0;
        $totalEvents = count($pastEvents);

        foreach ($pastEvents as $event) {
            if (in_array($event->event_type, ['goal', 'red_card', 'penalty'])) {
                $intenseEvents++;
            }
        }

        $intensityRatio = $totalEvents > 0 ? $intenseEvents / $totalEvents : 0;

        if ($intensityRatio > 0.3) return 'very_high';
        if ($intensityRatio > 0.2) return 'high';
        if ($intensityRatio > 0.1) return 'medium';
        return 'low';
    }

    /**
     * Calculate team confidence based on score and time
     */
    private function calculateConfidence(int $teamScore, int $opponentScore, int $minute): string
    {
        $scoreDifference = $teamScore - $opponentScore;
        $timeRemaining = 90 - $minute;
        
        if ($scoreDifference >= 2 && $timeRemaining < 30) return 'very_high';
        if ($scoreDifference >= 1 && $timeRemaining < 45) return 'high';
        if ($scoreDifference >= 0) return 'balanced';
        if ($scoreDifference >= -1 && $timeRemaining > 30) return 'low';
        return 'very_low';
    }

    /**
     * Analyze tactical setup and provide detailed analysis for AI context
     */
    private function analyzeTacticalSetup($tactic, string $teamName): string
    {
        $analysis = "";
        $hasGoalkeeper = false;
        $goalkeeperPosition = null;
        $defensiveGaps = [];
        $attackingOpportunities = [];
        
        if (!$tactic->custom_positions) {
            return "Standard formation - no custom positions.";
        }
        
        // Analyze goalkeeper position
        foreach ($tactic->custom_positions as $index => $position) {
            if ($position['position'] === 'GK') {
                $hasGoalkeeper = true;
                $goalkeeperPosition = $position;
                break;
            }
        }
        
        // Check if goalkeeper is in proper position (should be around y=50, x=10-20)
        if ($hasGoalkeeper) {
            if ($goalkeeperPosition['y'] < 30 || $goalkeeperPosition['y'] > 70 || $goalkeeperPosition['x'] > 30) {
                $analysis .= "⚠️ CRITICAL: Goalkeeper is out of position! GK at ({$goalkeeperPosition['x']}, {$goalkeeperPosition['y']}) - should be in goal area (x<30, y=30-70). This will lead to many goals conceded.\n";
            } else {
                $analysis .= "✅ Goalkeeper in proper position at ({$goalkeeperPosition['x']}, {$goalkeeperPosition['y']}).\n";
            }
        } else {
            $analysis .= "🚨 DISASTER: NO GOALKEEPER IN FORMATION! This team will concede many goals easily.\n";
        }
        
        // Analyze defensive structure
        $defenders = array_filter($tactic->custom_positions, fn($pos) => in_array($pos['position'], ['CB', 'LB', 'RB', 'WB']));
        if (count($defenders) < 3) {
            $analysis .= "⚠️ WEAK DEFENSE: Only " . count($defenders) . " defenders - vulnerable to attacks.\n";
        }
        
        // Check for defensive gaps (no defenders in certain areas)
        $leftDefense = array_filter($defenders, fn($pos) => $pos['y'] < 40);
        $centerDefense = array_filter($defenders, fn($pos) => $pos['y'] >= 40 && $pos['y'] <= 60);
        $rightDefense = array_filter($defenders, fn($pos) => $pos['y'] > 60);
        
        if (empty($leftDefense)) {
            $analysis .= "⚠️ DEFENSIVE GAP: No left-side defenders - vulnerable to attacks down the left.\n";
        }
        if (empty($centerDefense)) {
            $analysis .= "⚠️ DEFENSIVE GAP: No central defenders - extremely vulnerable through the middle.\n";
        }
        if (empty($rightDefense)) {
            $analysis .= "⚠️ DEFENSIVE GAP: No right-side defenders - vulnerable to attacks down the right.\n";
        }
        
        // Analyze attacking structure
        $forwards = array_filter($tactic->custom_positions, fn($pos) => in_array($pos['position'], ['ST', 'CF', 'LW', 'RW', 'F9']));
        if (count($forwards) > 0) {
            $analysis .= "✅ " . count($forwards) . " attacking players positioned.\n";
        }
        
        // Overall assessment
        if (!$hasGoalkeeper) {
            $analysis .= "🎯 PREDICTION: {$teamName} will concede 3-5 goals due to no goalkeeper.\n";
        } elseif (count($defenders) < 3) {
            $analysis .= "🎯 PREDICTION: {$teamName} will concede 2-3 goals due to weak defense.\n";
        } elseif (empty($centerDefense)) {
            $analysis .= "🎯 PREDICTION: {$teamName} will concede 2-3 goals due to central defensive gap.\n";
        }
        
        return $analysis;
    }

    /**
     * Calculate the effect of match-specific tactics on team strength
     */
    private function calculateMatchTacticEffect($matchTactic): float
    {
        $effect = 0.0;
        
        // Penalize teams with poor tactical setup
        if ($matchTactic->custom_positions) {
            // Check if goalkeeper exists and is in proper position
            $hasGoalkeeper = false;
            $hasProperGoalkeeper = false;
            
            foreach ($matchTactic->custom_positions as $position) {
                if ($position['position'] === 'GK') {
                    $hasGoalkeeper = true;
                    // Check if goalkeeper is in proper position (should be around y=50, x=10-20)
                    if ($position['y'] >= 30 && $position['y'] <= 70 && $position['x'] <= 30) {
                        $hasProperGoalkeeper = true;
                    }
                    break;
                }
            }
            
            if (!$hasGoalkeeper) {
                $effect -= 0.8; // Massive penalty for no goalkeeper
            } elseif (!$hasProperGoalkeeper) {
                $effect -= 0.5; // Large penalty for goalkeeper out of position
            }
            
            // Check defensive structure
            $defenders = array_filter($matchTactic->custom_positions, fn($pos) => in_array($pos['position'], ['CB', 'LB', 'RB', 'WB']));
            if (count($defenders) < 3) {
                $effect -= 0.4; // Large penalty for weak defense
            }
            
            // Check for defensive gaps
            $centerDefense = array_filter($defenders, fn($pos) => $pos['y'] >= 40 && $pos['y'] <= 60);
            if (empty($centerDefense)) {
                $effect -= 0.6; // Massive penalty for no central defense
            }
        }
        
        // Penalize for too many substitutions (tactical confusion)
        if ($matchTactic->substitutions && count($matchTactic->substitutions) > 3) {
            $effect -= 0.1 * (count($matchTactic->substitutions) - 3);
        }
        
        // Small bonus for tactical adjustments (shows active management)
        if ($matchTactic->custom_positions || $matchTactic->player_assignments) {
            $effect += 0.05;
        }
        
        return $effect;
    }

    /**
     * Calculate the effect of a tactical change on team strength
     */
    private function getTacticalChangeEffect(array $change): float
    {
        $baseEffect = 0.0;

        switch ($change['type']) {
            case 'formation':
                // Formation changes can have positive or negative effects
                $baseEffect = rand(-5, 5);
                break;
            case 'substitution':
                // Substitutions can refresh the team or bring in fresh legs
                $baseEffect = rand(2, 8);
                break;
            case 'mentality':
                // Mentality changes affect team approach
                $baseEffect = rand(-3, 3);
                break;
            case 'pressing':
                // Pressing changes affect defensive intensity
                $baseEffect = rand(-2, 4);
                break;
            default:
                $baseEffect = rand(-1, 1);
        }

        return $baseEffect;
    }

    /**
     * Calculate momentum based on recent events and score
     */
    public function calculateMomentum($pastEvents, $currentScore): string
    {
        if (empty($pastEvents)) {
            return 'balanced';
        }

        // Get last 10 events or all events if less than 10
        $recentEvents = array_slice($pastEvents->toArray(), -10);
        
        $homeEvents = 0;
        $awayEvents = 0;
        $homeGoals = 0;
        $awayGoals = 0;

        foreach ($recentEvents as $event) {
            if ($event['team_type'] === 'home') {
                $homeEvents++;
                if ($event['event_type'] === 'goal') {
                    $homeGoals++;
                }
            } else {
                $awayEvents++;
                if ($event['event_type'] === 'goal') {
                    $awayGoals++;
                }
            }
        }

        $scoreDiff = $currentScore['home'] - $currentScore['away'];
        $recentDiff = $homeEvents - $awayEvents;

        if ($scoreDiff >= 2 || ($recentDiff >= 3 && $homeGoals > $awayGoals)) {
            return 'home_dominant';
        } elseif ($scoreDiff <= -2 || ($recentDiff <= -3 && $awayGoals > $homeGoals)) {
            return 'away_dominant';
        } elseif ($scoreDiff >= 1 || $recentDiff >= 2) {
            return 'home_momentum';
        } elseif ($scoreDiff <= -1 || $recentDiff <= -2) {
            return 'away_momentum';
        }

        return 'balanced';
    }

    /**
     * Calculate fatigue level based on match minute
     */
    public function calculateFatigue(int $minute): string
    {
        if ($minute < 30) return 'low';
        if ($minute < 60) return 'medium';
        if ($minute < 75) return 'high';
        return 'very_high';
    }

    /**
     * Calculate event probability based on current match state
     */
    private function calculateEventProbability(string $eventType, array $matchState, int $homeScore, int $awayScore): float
    {
        $baseProbability = 0.1; // Base 10% chance for any event

        // Adjust based on intensity
        switch ($matchState['intensity']) {
            case 'very_high':
                $baseProbability *= 1.5;
                break;
            case 'high':
                $baseProbability *= 1.3;
                break;
            case 'low':
                $baseProbability *= 0.7;
                break;
        }

        // Adjust based on momentum
        switch ($matchState['momentum']) {
            case 'home_dominant':
            case 'away_dominant':
                $baseProbability *= 1.2;
                break;
            case 'home_momentum':
            case 'away_momentum':
                $baseProbability *= 1.1;
                break;
        }

        // Adjust based on fatigue
        switch ($matchState['fatigue_level']) {
            case 'very_high':
                $baseProbability *= 0.8;
                break;
            case 'high':
                $baseProbability *= 0.9;
                break;
        }

        // Event-specific adjustments
        switch ($eventType) {
            case 'goal':
                if (abs($homeScore - $awayScore) <= 1) {
                    $baseProbability *= 1.2; // More goals when close
                }
                break;
            case 'substitution':
                if ($matchState['fatigue_level'] === 'high' || $matchState['fatigue_level'] === 'very_high') {
                    $baseProbability *= 1.5;
                }
                break;
            case 'yellow_card':
            case 'red_card':
                if ($matchState['intensity'] === 'high' || $matchState['intensity'] === 'very_high') {
                    $baseProbability *= 1.3;
                }
                break;
        }

        return min($baseProbability, 0.8); // Cap at 80%
    }

    /**
     * Select team for event based on current state
     */
    private function selectTeam(array $matchState, float $homeStrength, float $awayStrength): string
    {
        $homeChance = 0.5; // Base 50-50

        // Adjust based on momentum
        switch ($matchState['momentum']) {
            case 'home_dominant':
                $homeChance = 0.7;
                break;
            case 'away_dominant':
                $homeChance = 0.3;
                break;
            case 'home_momentum':
                $homeChance = 0.6;
                break;
            case 'away_momentum':
                $homeChance = 0.4;
                break;
        }

        // Adjust based on team strength
        $strengthDiff = $homeStrength - $awayStrength;
        $homeChance += $strengthDiff * 0.01; // Small adjustment based on strength difference

        return rand(1, 100) <= ($homeChance * 100) ? 'home' : 'away';
    }

    /**
     * Select event type based on current match state
     */
    private function selectEventType(array $matchState, int $homeScore, int $awayScore): string
    {
        $eventTypes = [
            'goal' => 0.05,
            'yellow_card' => 0.15,
            'red_card' => 0.02,
            'substitution' => 0.08,
            'corner' => 0.20,
            'free_kick' => 0.25,
            'penalty' => 0.03,
            'offside' => 0.12,
            'foul' => 0.30,
            'save' => 0.15,
            'shot_blocked' => 0.10,
        ];

        // Adjust probabilities based on match state
        if ($matchState['intensity'] === 'very_high') {
            $eventTypes['goal'] *= 1.5;
            $eventTypes['yellow_card'] *= 1.3;
            $eventTypes['red_card'] *= 1.5;
        }

        if ($matchState['fatigue_level'] === 'high' || $matchState['fatigue_level'] === 'very_high') {
            $eventTypes['substitution'] *= 1.5;
            $eventTypes['foul'] *= 1.2;
        }

        // Normalize probabilities
        $total = array_sum($eventTypes);
        foreach ($eventTypes as $type => $prob) {
            $eventTypes[$type] = $prob / $total;
        }

        // Select event type
        $rand = rand(1, 100) / 100;
        $cumulative = 0;
        
        foreach ($eventTypes as $type => $prob) {
            $cumulative += $prob;
            if ($rand <= $cumulative) {
                return $type;
            }
        }

        return 'foul'; // Default fallback
    }

    /**
     * Detect formation from position coordinates
     */
    public function detectFormation(array $positions): array
    {
        // Count players in each area
        $defenders = 0;
        $midfielders = 0;
        $forwards = 0;

        foreach ($positions as $position) {
            $y = $position['y'];
            if ($y < 40) {
                $defenders++;
            } elseif ($y < 70) {
                $midfielders++;
            } else {
                $forwards++;
            }
        }

        // Identify formation based on player distribution
        $formation = $this->identifyFormation($defenders, $midfielders, $forwards);
        $confidence = $this->calculateFormationConfidence($positions, $formation);

        return [
            'formation' => $formation,
            'confidence' => $confidence,
            'defenders' => $defenders,
            'midfielders' => $midfielders,
            'forwards' => $forwards
        ];
    }

    /**
     * Identify formation name based on player counts
     */
    private function identifyFormation(int $defenders, int $midfielders, int $forwards): string
    {
        // Common formations
        $formations = [
            '4-4-2' => ['defenders' => 4, 'midfielders' => 4, 'forwards' => 2],
            '4-3-3' => ['defenders' => 4, 'midfielders' => 3, 'forwards' => 3],
            '4-2-3-1' => ['defenders' => 4, 'midfielders' => 5, 'forwards' => 1],
            '3-5-2' => ['defenders' => 3, 'midfielders' => 5, 'forwards' => 2],
            '3-4-3' => ['defenders' => 3, 'midfielders' => 4, 'forwards' => 3],
            '5-3-2' => ['defenders' => 5, 'midfielders' => 3, 'forwards' => 2],
            '4-5-1' => ['defenders' => 4, 'midfielders' => 5, 'forwards' => 1],
            '3-6-1' => ['defenders' => 3, 'midfielders' => 6, 'forwards' => 1],
        ];

        $bestMatch = '4-4-2'; // Default
        $bestScore = 0;

        foreach ($formations as $formation => $counts) {
            $score = 0;
            if (abs($counts['defenders'] - $defenders) <= 1) $score += 3;
            if (abs($counts['midfielders'] - $midfielders) <= 1) $score += 3;
            if (abs($counts['forwards'] - $forwards) <= 1) $score += 2;

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $formation;
            }
        }

        return $bestMatch;
    }

    /**
     * Calculate confidence in formation detection
     */
    private function calculateFormationConfidence(array $positions, string $formation): float
    {
        // Calculate how well positions are spread out
        $spread = $this->calculatePositionSpread($positions);
        
        // Base confidence on position spread and total players
        $baseConfidence = min(1.0, count($positions) / 11.0) * 0.8;
        
        // Adjust based on spread
        $spreadConfidence = min(1.0, $spread / 50.0) * 0.2;
        
        return $baseConfidence + $spreadConfidence;
    }

    /**
     * Calculate position spread across the field
     */
    private function calculatePositionSpread(array $positions): float
    {
        if (empty($positions)) {
            return 0.0;
        }

        $xCoords = array_column($positions, 'x');
        $yCoords = array_column($positions, 'y');

        $xSpread = max($xCoords) - min($xCoords);
        $ySpread = max($yCoords) - min($yCoords);

        return ($xSpread + $ySpread) / 2;
    }

    /**
     * Clean AI response by removing markdown code blocks
     */
    private function cleanAIResponse(string $response): string
    {
        // Remove markdown code blocks (```json ... ```)
        $response = preg_replace('/```json\s*/', '', $response);
        $response = preg_replace('/```\s*$/', '', $response);
        
        // Remove any leading/trailing whitespace
        $response = trim($response);
        
        return $response;
    }

    /**
     * Track player states throughout the match to prevent logical errors
     */
    private function buildPlayerStateContext(array $pastEvents): string
    {
        $playerStates = [];
        $sentOffPlayers = [];
        $substitutedPlayers = [];
        $yellowCardedPlayers = [];
        
        foreach ($pastEvents as $event) {
            $playerName = $event['player_name'] ?? '';
            $eventType = $event['event_type'] ?? '';
            $minute = $event['minute'] ?? 0;
            
            if ($eventType === 'red_card') {
                $sentOffPlayers[] = $playerName;
            } elseif ($eventType === 'substitution') {
                // Extract player names from substitution description
                if (preg_match('/(\w+)\s+replaces\s+(\w+)/', $event['description'] ?? '', $matches)) {
                    $playerIn = $matches[1];
                    $playerOut = $matches[2];
                    $substitutedPlayers[] = $playerOut;
                }
            } elseif ($eventType === 'yellow_card') {
                $yellowCardedPlayers[] = $playerName;
            }
        }
        
        $context = "\n\nPlayer State Tracking:\n";
        
        if (!empty($sentOffPlayers)) {
            $context .= "SENT OFF (cannot play): " . implode(', ', array_unique($sentOffPlayers)) . "\n";
        }
        
        if (!empty($substitutedPlayers)) {
            $context .= "SUBSTITUTED OUT: " . implode(', ', array_unique($substitutedPlayers)) . "\n";
        }
        
        if (!empty($yellowCardedPlayers)) {
            $context .= "YELLOW CARDED: " . implode(', ', array_unique($yellowCardedPlayers)) . "\n";
        }
        
        if (empty($sentOffPlayers) && empty($substitutedPlayers) && empty($yellowCardedPlayers)) {
            $context .= "All players available for selection.\n";
        }
        
        $context .= "\nCRITICAL RULES:\n";
        $context .= "- Players sent off (red card) CANNOT participate in any events after being sent off\n";
        $context .= "- Substituted players CANNOT participate in any events after being substituted\n";
        $context .= "- Players with yellow cards can still play but are at risk of second yellow = red\n";
        
        return $context;
    }

    /**
     * Get available players for events, excluding sent-off and substituted players
     */
    private function getAvailablePlayers(Team $team, array $pastEvents): array
    {
        $sentOffPlayers = [];
        $substitutedPlayers = [];
        
        foreach ($pastEvents as $event) {
            $playerName = $event['player_name'] ?? '';
            $eventType = $event['event_type'] ?? '';
            
            if ($eventType === 'red_card') {
                $sentOffPlayers[] = strtolower($playerName);
            } elseif ($eventType === 'substitution') {
                // Extract player names from substitution description
                if (preg_match('/(\w+)\s+replaces\s+(\w+)/', $event['description'] ?? '', $matches)) {
                    $playerOut = $matches[2];
                    $substitutedPlayers[] = strtolower($playerOut);
                }
            }
        }
        
        // Get team players and filter out unavailable ones
        $teamPlayers = $team->players ?? [];
        $availablePlayers = [];
        
        foreach ($teamPlayers as $player) {
            $playerName = strtolower($this->getPlayerFullName($player));
            if (!in_array($playerName, $sentOffPlayers) && !in_array($playerName, $substitutedPlayers)) {
                $availablePlayers[] = $player;
            }
        }
        
        return $availablePlayers;
    }

    /**
     * Get a random available player for an event
     */
    private function getRandomAvailablePlayer(Team $team, array $pastEvents, string $eventType = 'general'): string
    {
        $availablePlayers = $this->getAvailablePlayers($team, $pastEvents);
        
        if (empty($availablePlayers)) {
            // Fallback to generic player names if no available players
            $genericNames = [
                'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
                'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
                'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson'
            ];
            return $genericNames[array_rand($genericNames)];
        }
        
        $selectedPlayer = $availablePlayers[array_rand($availablePlayers)];
        return $this->getPlayerFullName($selectedPlayer);
    }

    /**
     * Determine which team is user-managed vs AI-managed
     * For now, we'll assume home team is user-managed and away team is AI-managed
     * This could be enhanced later to check user authentication and team ownership
     */
    private function getTeamManagementRoles(Team $homeTeam, Team $awayTeam): array
    {
        // TODO: In the future, this could check user authentication and team ownership
        // For now, assume home team is user-managed and away team is AI-managed
        return [
            'user_managed' => $homeTeam,
            'ai_managed' => $awayTeam,
            'user_team_type' => 'home',
            'ai_team_type' => 'away'
        ];
    }

    /**
     * Get a player's tactical position from the tactic's custom positions
     */
    private function getPlayerTacticalPosition(Player $player, $tactic): ?string
    {
        if (!$tactic || !$tactic->custom_positions || !$tactic->player_assignments) {
            return null;
        }
        
        $playerAssignments = $tactic->player_assignments;
        $customPositions = $tactic->custom_positions;
        
        // Find the index where this player is assigned
        $playerIndex = array_search($player->id, $playerAssignments);
        
        if ($playerIndex !== false && isset($customPositions[$playerIndex])) {
            return $customPositions[$playerIndex]['position'] ?? null;
        }
        
        return null;
    }

    /**
     * Build team roster information for AI prompts using tactical positions
     */
    private function buildTeamRoster(Team $team, $tactic = null): string
    {
        $players = $team->players()->get();
        
        if ($players->isEmpty()) {
            return "No players available for {$team->name}";
        }
        
        $roster = "\n{$team->name} Squad:\n";
        
        // Group players by tactical position if tactic is provided
        if ($tactic && $tactic->custom_positions && $tactic->player_assignments) {
            $positions = [];
            
            foreach ($players as $player) {
                $tacticalPosition = $this->getPlayerTacticalPosition($player, $tactic);
                $positionName = $tacticalPosition ?: 'Unassigned';
                
                if (!isset($positions[$positionName])) {
                    $positions[$positionName] = [];
                }
                $positions[$positionName][] = $player;
            }
            
            // Build roster by tactical position
            foreach ($positions as $position => $positionPlayers) {
                $roster .= "\n{$position}:\n";
                foreach ($positionPlayers as $player) {
                    $roster .= "- {$this->getPlayerFullName($player)} (#{$player->shirt_number}, {$player->nationality})\n";
                }
            }
        } else {
            // Fallback to primary position grouping
            $positions = [];
            foreach ($players as $player) {
                $positionName = $player->primaryPosition ? $player->primaryPosition->name : 'Unknown';
                if (!isset($positions[$positionName])) {
                    $positions[$positionName] = [];
                }
                $positions[$positionName][] = $player;
            }
            
            // Build roster by primary position
            foreach ($positions as $position => $positionPlayers) {
                $roster .= "\n{$position}:\n";
                foreach ($positionPlayers as $player) {
                    $roster .= "- {$this->getPlayerFullName($player)} (#{$player->shirt_number}, {$player->nationality})\n";
                }
            }
        }
        
        return $roster;
    }

    /**
     * Validate that a player name exists in the team roster
     */
    private function validatePlayerName(string $playerName, Team $team): bool
    {
        $players = $team->players()->get();
        $playerNames = $players->map(function($player) {
            return $this->getPlayerFullName($player);
        })->toArray();
        
        return in_array($playerName, $playerNames);
    }

    /**
     * Get a random real player name from the team if the provided name is invalid
     */
    private function getValidPlayerName(string $playerName, Team $team): string
    {
        if ($this->validatePlayerName($playerName, $team)) {
            return $playerName;
        }
        
        // If invalid, get a random real player
        $players = $team->players()->get();
        if ($players->isNotEmpty()) {
            return $this->getPlayerFullName($players->random());
        }
        
        // Fallback to generic name if no players found
        return 'Unknown Player';
    }

    /**
     * Get a player's full name safely
     */
    private function getPlayerFullName($player): string
    {
        if (is_object($player)) {
            // If it's a Player model instance
            if (method_exists($player, 'getFullNameAttribute')) {
                return $player->full_name;
            }
            // If it's a stdClass or array
            if (isset($player->full_name)) {
                return $player->full_name;
            }
            if (isset($player->first_name) && isset($player->last_name)) {
                return $player->first_name . ' ' . $player->last_name;
            }
        }
        
        // Fallback
        return 'Unknown Player';
    }
} 