<?php



/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Match routes


// Team routes
use App\Http\Controllers\Api\LeagueController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\PositionController;
use App\Http\Controllers\Api\FormationController;
use App\Http\Controllers\Api\TacticController;
use App\Http\Controllers\Api\MatchSimulatorController;
use App\Models\GameMatch;
use App\Models\Team;
use App\Models\Formation;
use App\Services\MatchSimulationService;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\MatchController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TimeController;
use App\Http\Controllers\Api\SimulationStreamController;

Route::prefix('v1')->group(function () {
    
    // Authentication routes (public)
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::get('auth/available-teams', [AuthController::class, 'availableTeams']);
    
    // Protected authentication routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('auth/profile', [AuthController::class, 'profile']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/regenerate-calendars', [AuthController::class, 'regenerateCalendars']);
        Route::get('auth/calendar-stats', [AuthController::class, 'calendarStats']);
        
        // Time progression routes (require authentication)
        Route::prefix('time')->group(function () {
            Route::post('advance-day', [TimeController::class, 'advanceDay']);
            Route::post('advance-to-match', [TimeController::class, 'advanceToMatch']);
            Route::get('current-date', [TimeController::class, 'getCurrentDate']);
        });
    });

    // Test route
    Route::get('test', function() {
        return response()->json(['message' => 'API is working']);
    });

    // OpenAI test route
    Route::get('test-openai', function() {
        try {
            $openAIService = app(App\Services\OpenAIService::class);

            if (!$openAIService->isAvailable()) {
                return response()->json(['error' => 'OpenAI API key not configured'], 500);
            }

            $prompt = "Generate a simple test response saying 'Hello from OpenAI!'";
            $response = $openAIService->generateText($prompt);

            return response()->json([
                'success' => true,
                'message' => 'OpenAI is working',
                'response' => $response
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    Route::prefix('matches')->group(function () {
        Route::get('/league', [MatchController::class, 'getLeagueMatches']);
        Route::get('/team', [MatchController::class, 'getTeamMatches']);
        Route::get('/upcoming', [MatchController::class, 'getUpcomingMatches']);
        Route::get('/{id}', [MatchController::class, 'getMatchDetails']);
        Route::post('/{id}/simulate', [MatchController::class, 'simulateMatch']);
        Route::get('/{id}/ai-key-events', [MatchController::class, 'generateKeyEvents']);
        Route::get('/{id}/ai-commentary', [MatchController::class, 'generateCommentary']);
        Route::post('/{id}/ai-event-positions', [MatchController::class, 'generateEventPositions']);
        Route::post('/{id}/ai-events-positions-batch', [MatchController::class, 'generateEventsPositionsBatch']);
    });

    // Simple match test route
    Route::post('matches/test-create', function() {
        try {
            // Get random teams from the database (ensure different teams) with their tactics
            $homeTeam = Team::with(['primaryTactic.formation', 'tactics.formation'])->inRandomOrder()->first();

            if (!$homeTeam) {
                return response()->json(['error' => 'No teams found in database'], 404);
            }

            $awayTeam = Team::with(['primaryTactic.formation', 'tactics.formation'])
                ->where('id', '!=', $homeTeam->id)
                ->inRandomOrder()
                ->first();

            if (!$awayTeam) {
                return response()->json(['error' => 'Not enough teams in database'], 404);
            }

            // Get formations from team tactics (primary tactic first, then any available tactic)
            $homeFormation = null;
            $awayFormation = null;
            
            // Try to get home team's primary tactic formation (from pivot table)
            $homePrimaryTactic = $homeTeam->tactics()->wherePivot('is_primary', true)->with('formation')->first();
            if ($homePrimaryTactic && $homePrimaryTactic->formation) {
                $homeFormation = $homePrimaryTactic->formation;
            } else {
                // Fallback to first available tactic for home team
                $homeTactic = $homeTeam->tactics()->with('formation')->first();
                $homeFormation = $homeTactic ? $homeTactic->formation : Formation::first();
            }
            
            // Try to get away team's primary tactic formation (from pivot table)
            $awayPrimaryTactic = $awayTeam->tactics()->wherePivot('is_primary', true)->with('formation')->first();
            if ($awayPrimaryTactic && $awayPrimaryTactic->formation) {
                $awayFormation = $awayPrimaryTactic->formation;
            } else {
                // Fallback to first available tactic for away team
                $awayTactic = $awayTeam->tactics()->with('formation')->first();
                $awayFormation = $awayTactic ? $awayTactic->formation : Formation::first();
            }

            $match = GameMatch::create([
                'home_team_id' => $homeTeam->id,
                'away_team_id' => $awayTeam->id,
                'league_id' => $homeTeam->league_id,
                'match_date' => now(),
                'home_formation_id' => $homeFormation->id,
                'away_formation_id' => $awayFormation->id,
                'stadium' => $homeTeam->stadium_name ?? 'Stadium',
                'weather' => collect(['Clear', 'Cloudy', 'Rainy', 'Sunny'])->random(),
                'temperature' => rand(5, 30),
                'status' => 'scheduled'
            ]);

            // Load team relationships
            $match->load(['homeTeam', 'awayTeam', 'league']);

            return response()->json([
                'success' => true,
                'match' => $match,
                'message' => 'Match created successfully'
            ]);
        } catch (Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Match simulation route
    Route::post('matches/{match}/simulate', function(GameMatch $match, MatchSimulationService $simulationService) {
        try {
            if ($match->status !== 'scheduled') {
                return response()->json(['error' => 'Match has already been played or is in progress'], 400);
            }

            $events = $simulationService->simulateMatch($match);

            // Reload match with events
            $match->load([
                'homeTeam',
                'awayTeam',
                'league',
                'events' => function($query) {
                    $query->orderBy('minute');
                }
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'match' => $match,
                    'events' => $events
                ],
                'message' => 'Match simulated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Get match tactics route
    Route::get('matches/{match}/tactics', function(GameMatch $match) {
        try {
            $match->load(['homeTeam', 'awayTeam', 'homeFormation', 'awayFormation']);

            // Get primary tactics for both teams
            $homeTactics = $match->homeTeam->tactics()
                ->with(['formation', 'teams'])
                ->wherePivot('is_primary', true)
                ->first();

            $awayTactics = $match->awayTeam->tactics()
                ->with(['formation', 'teams'])
                ->wherePivot('is_primary', true)
                ->first();

            // If no primary tactic, get the first available tactic
            if (!$homeTactics) {
                $homeTactics = $match->homeTeam->tactics()
                    ->with(['formation', 'teams'])
                    ->first();
            }

            if (!$awayTactics) {
                $awayTactics = $match->awayTeam->tactics()
                    ->with(['formation', 'teams'])
                    ->first();
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'match' => $match,
                    'home_tactics' => $homeTactics,
                    'away_tactics' => $awayTactics,
                    'home_formation' => $match->homeFormation,
                    'away_formation' => $match->awayFormation,
                ],
                'message' => 'Match tactics retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Get match lineups route
    Route::get('matches/{match}/lineups', function(GameMatch $match) {
        try {
            $match->load(['homeTeam', 'awayTeam', 'homeFormation', 'awayFormation']);

            // Get lineups for both teams
            $homeLineup = $match->homeTeam->players()
                ->with(['primaryPosition', 'attributes'])
                ->orderBy('shirt_number')
                ->get()
                ->map(function ($player) {
                    return [
                        'id' => $player->id,
                        'full_name' => $player->full_name,
                        'shirt_number' => $player->shirt_number,
                        'position' => $player->primaryPosition ? [
                            'id' => $player->primaryPosition->id,
                            'name' => $player->primaryPosition->name,
                            'short_name' => $player->primaryPosition->short_name,
                            'category' => $player->primaryPosition->category,
                        ] : null,
                        'age' => $player->age,
                        'nationality' => $player->nationality,
                        'current_ability' => $player->attributes->current_ability ?? 0,
                        'is_injured' => $player->is_injured,
                        'is_starting' => true, // For now, assume all players are starting
                    ];
                });

            $awayLineup = $match->awayTeam->players()
                ->with(['primaryPosition', 'attributes'])
                ->orderBy('shirt_number')
                ->get()
                ->map(function ($player) {
                    return [
                        'id' => $player->id,
                        'full_name' => $player->full_name,
                        'shirt_number' => $player->shirt_number,
                        'position' => $player->primaryPosition ? [
                            'id' => $player->primaryPosition->id,
                            'name' => $player->primaryPosition->name,
                            'short_name' => $player->primaryPosition->short_name,
                            'category' => $player->primaryPosition->category,
                        ] : null,
                        'age' => $player->age,
                        'nationality' => $player->nationality,
                        'current_ability' => $player->attributes->current_ability ?? 0,
                        'is_injured' => $player->is_injured,
                        'is_starting' => true, // For now, assume all players are starting
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'match' => $match,
                    'home_lineup' => $homeLineup,
                    'away_lineup' => $awayLineup,
                    'home_formation' => $match->homeFormation,
                    'away_formation' => $match->awayFormation,
                ],
                'message' => 'Match lineups retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Update match tactics during match
    Route::patch('matches/{match}/tactics', function(GameMatch $match, Request $request) {
        try {
            // Debug: Log the incoming request data
            Log::info('Match tactics update request:', [
                'request_data' => $request->all(),
                'custom_positions_type' => gettype($request->input('custom_positions')),
                'custom_positions_value' => $request->input('custom_positions')
            ]);
            
            $validated = $request->validate([
                'team_type' => 'required|in:home,away',
                'formation_id' => 'sometimes|exists:formations,id',
                'custom_positions' => 'sometimes|array',
                'player_assignments' => 'sometimes|array',
                'substitutions' => 'sometimes|array',
                'mentality' => 'sometimes|in:very_defensive,defensive,balanced,attacking,very_attacking',
                'team_instructions' => 'sometimes|in:control_possession,direct_passing,short_passing,mixed',
                'pressing' => 'sometimes|in:never,rarely,sometimes,often,always',
                'tempo' => 'sometimes|in:very_slow,slow,standard,fast,very_fast',
                'width' => 'sometimes|in:very_narrow,narrow,standard,wide,very_wide',
                'offside_trap' => 'boolean',
                'play_out_of_defence' => 'boolean',
                'use_offside_trap' => 'boolean',
                'close_down_more' => 'boolean',
                'tackle_harder' => 'boolean',
                'get_stuck_in' => 'boolean',
            ]);

            $team = $validated['team_type'] === 'home' ? $match->homeTeam : $match->awayTeam;
            $currentMinute = $match->events()->max('minute') ?? 0;

            // Find or create match tactic record
            $matchTactic = \App\Models\MatchTactic::updateOrCreate(
                [
                    'match_id' => $match->id,
                    'team_type' => $validated['team_type']
                ],
                [
                    'team_id' => $team->id,
                    'formation_id' => $validated['formation_id'] ?? null,
                    'custom_positions' => $validated['custom_positions'] ?? null,
                    'player_assignments' => $validated['player_assignments'] ?? null,
                    'mentality' => $validated['mentality'] ?? null,
                    'team_instructions' => $validated['team_instructions'] ?? null,
                    'pressing' => $validated['pressing'] ?? null,
                    'tempo' => $validated['tempo'] ?? null,
                    'width' => $validated['width'] ?? null,
                    'offside_trap' => $validated['offside_trap'] ?? null,
                    'play_out_of_defence' => $validated['play_out_of_defence'] ?? null,
                    'use_offside_trap' => $validated['use_offside_trap'] ?? null,
                    'close_down_more' => $validated['close_down_more'] ?? null,
                    'tackle_harder' => $validated['tackle_harder'] ?? null,
                    'get_stuck_in' => $validated['get_stuck_in'] ?? null,
                    'applied_at_minute' => $currentMinute,
                ]
            );

            // Handle substitutions
            if (isset($validated['substitutions'])) {
                foreach ($validated['substitutions'] as $substitution) {
                    $matchTactic->addSubstitution(
                        $substitution['player_out_id'],
                        $substitution['player_in_id'],
                        $substitution['minute'] ?? $currentMinute
                    );

                    // Create match event for the substitution
                    $playerIn = \App\Models\Player::find($substitution['player_in_id']);
                    $playerOut = \App\Models\Player::find($substitution['player_out_id']);
                    
                    if ($playerIn && $playerOut) {
                        $match->events()->create([
                            'minute' => $substitution['minute'] ?? $currentMinute,
                            'event_type' => 'substitution',
                            'team_type' => $validated['team_type'],
                            'player_name' => $playerIn->full_name,
                            'description' => $playerIn->full_name . ' replaces ' . $playerOut->full_name,
                            'x_coordinate' => 50,
                            'y_coordinate' => 50,
                            'commentary' => 'Tactical substitution by the manager.',
                        ]);
                    }
                }
            }

            $match->load(['homeTeam', 'awayTeam', 'homeFormation', 'awayFormation']);

            return response()->json([
                'success' => true,
                'data' => $match,
                'message' => 'Match tactics updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Regenerate match events from a specific minute
    Route::post('matches/{match}/regenerate-events', function(GameMatch $match, Request $request, MatchSimulationService $simulationService) {
        try {
            $validated = $request->validate([
                'from_minute' => 'required|integer|min:1|max:90',
                'current_score' => 'required|array',
                'current_score.home' => 'required|integer|min:0',
                'current_score.away' => 'required|integer|min:0',
                'existing_events' => 'sometimes|array',
                'tactical_changes' => 'sometimes|array',
            ]);

            $fromMinute = $validated['from_minute'];
            $currentScore = $validated['current_score'];
            $existingEvents = $validated['existing_events'] ?? [];
            $tacticalChanges = $validated['tactical_changes'] ?? [];

            // Get current match state
            $match->load(['homeTeam', 'awayTeam', 'homeFormation', 'awayFormation', 'events']);

            // Load match tactics if they exist
            $homeMatchTactic = \App\Models\MatchTactic::where('match_id', $match->id)
                ->where('team_type', 'home')
                ->first();
            $awayMatchTactic = \App\Models\MatchTactic::where('match_id', $match->id)
                ->where('team_type', 'away')
                ->first();

            // Remove future events (after from_minute)
            $match->events()->where('minute', '>', $fromMinute)->delete();

            // Get events that already happened (up to from_minute)
            $pastEvents = $match->events()->where('minute', '<=', $fromMinute)->orderBy('minute')->get();

            // Create match context for regeneration
            $matchContext = [
                'match' => $match,
                'current_minute' => $fromMinute,
                'home_score' => $currentScore['home'],
                'away_score' => $currentScore['away'],
                'past_events' => $pastEvents,
                'tactical_changes' => $tacticalChanges,
                'home_match_tactic' => $homeMatchTactic,
                'away_match_tactic' => $awayMatchTactic,
                'momentum' => $simulationService->calculateMomentum($pastEvents, $currentScore),
                'fatigue_level' => $simulationService->calculateFatigue($fromMinute),
            ];

            // Generate new events for remaining time
            $newEvents = $simulationService->regenerateEventsFromMinute($matchContext);

            // Reload match with all events
            $match->load([
                'homeTeam',
                'awayTeam',
                'league',
                'events' => function($query) {
                    $query->orderBy('minute');
                }
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'match' => $match,
                    'new_events' => $newEvents,
                    'regenerated_from_minute' => $fromMinute,
                ],
                'message' => 'Match events regenerated successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Complete match route
    Route::post('matches/{match}/complete', function(GameMatch $match) {
        try {
            if ($match->status !== 'in_progress') {
                return response()->json(['error' => 'Match is not in progress'], 400);
            }

            $match->update(['status' => 'completed']);

            return response()->json([
                'success' => true,
                'message' => 'Match completed successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Reset match route - allows re-simulating a match
    Route::post('matches/{match}/reset', function(GameMatch $match) {
        try {
            // Delete all events for this match
            $match->events()->delete();
            
            // Delete match tactics
            \App\Models\MatchTactic::where('match_id', $match->id)->delete();
            
            // Reset match to scheduled status
            $match->update([
                'status' => 'scheduled',
                'home_score' => 0,
                'away_score' => 0
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Match reset successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // League routes
    Route::apiResource('leagues', LeagueController::class);
    Route::get('leagues/{league}/standings', [LeagueController::class, 'standings']);

    // Team routes
    Route::apiResource('teams', TeamController::class);
    Route::get('teams/{team}/squad', [TeamController::class, 'squad']);
    Route::post('teams/{team}/assign-tactic', [TeamController::class, 'assignTactic']);
    Route::get('teams/{team}/tactics', [TeamController::class, 'tactics']);

    // Player routes
    Route::apiResource('players', PlayerController::class);
    Route::get('players/{player}/attributes', [PlayerController::class, 'attributes']);
    Route::post('players/{player}/transfer', [PlayerController::class, 'transfer']);

    // Position routes
    Route::apiResource('positions', PositionController::class);
    Route::get('positions/category/grouped', [PositionController::class, 'groupedByCategory']);

    // Formation routes
    Route::apiResource('formations', FormationController::class);
    
    // Detect formation from positions
    Route::post('formations/detect', function(Request $request, MatchSimulationService $simulationService) {
        try {
            $validated = $request->validate([
                'positions' => 'required|array',
                'positions.*.x' => 'required|numeric|min:0|max:100',
                'positions.*.y' => 'required|numeric|min:0|max:100',
                'positions.*.position' => 'sometimes|string',
            ]);

            $result = $simulationService->detectFormation($validated['positions']);

            return response()->json([
                'success' => true,
                'data' => $result,
                'message' => 'Formation detected successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });
    Route::get('formations/{formation}/visualization', [FormationController::class, 'visualization']);
    Route::get('formations/{formation}/sample-instructions', [FormationController::class, 'sampleInstructions']);
    Route::get('formations/style/grouped', [FormationController::class, 'groupedByStyle']);

    // Detect formation from positions
    Route::post('formations/detect', function(Request $request, MatchSimulationService $simulationService) {
        try {
            $validated = $request->validate([
                'positions' => 'required|array',
                'positions.*.x' => 'required|numeric|min:0|max:100',
                'positions.*.y' => 'required|numeric|min:0|max:100',
                'positions.*.position' => 'sometimes|string',
            ]);

            $detection = $simulationService->detectFormation($validated['positions']);

            return response()->json([
                'success' => true,
                'data' => $detection,
                'message' => 'Formation detected successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });

    // Tactic routes
    Route::apiResource('tactics', TacticController::class);
    Route::post('tactics/{tactic}/assign-team', [TacticController::class, 'assignTeam']);
    Route::get('tactics/{tactic}/analysis', [TacticController::class, 'analysis']);



    // Tick-based simulation (new engine)
    Route::post('matches/{match}/simulate-stream', [SimulationStreamController::class, 'simulateStream']);
    Route::get('matches/{match}/simulate-instant', [SimulationStreamController::class, 'simulateInstant']);

    // Match Simulator routes
    Route::prefix('simulator')->group(function () {
        Route::post('simulate', [MatchSimulatorController::class, 'simulateMatch']);
        Route::post('simulate-realtime', [MatchSimulatorController::class, 'simulateRealTimeMatch']);
        Route::post('simulate-streaming', [MatchSimulatorController::class, 'simulateStreamingMatch']);
        Route::post('simulate-async', [MatchSimulatorController::class, 'simulateMatchAsync']);
        Route::get('status/{jobId}', [MatchSimulatorController::class, 'getSimulationStatus']);
        Route::get('stream/{jobId}', [MatchSimulatorController::class, 'streamSimulationUpdates']);
        Route::get('health', [MatchSimulatorController::class, 'health']);
        Route::get('options', [MatchSimulatorController::class, 'getOptions']);
    });

    // Statistics routes
    Route::prefix('stats')->group(function () {
        Route::get('overview', [LeagueController::class, 'overview']);
        Route::get('players/top-rated', [PlayerController::class, 'topRated']);
        Route::get('teams/most-valuable', [TeamController::class, 'mostValuable']);
    });

    // Utility routes
    Route::prefix('utils')->group(function () {
        Route::get('countries', [PlayerController::class, 'countries']);
        Route::get('nationalities', [PlayerController::class, 'nationalities']);
        Route::get('tactical-options', [TacticController::class, 'tacticalOptions']);
    });

});
