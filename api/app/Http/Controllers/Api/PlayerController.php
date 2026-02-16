<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use App\Models\Team;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class PlayerController extends Controller
{
    /**
     * Display a listing of players.
     *
     * @OA\Get(
     *     path="/players",
     *     operationId="listPlayers",
     *     tags={"Players"},
     *     summary="List all players with optional filters",
     *     description="Returns a paginated list of players. Supports filtering by team, position, nationality, name search, age range, and market value range.",
     *     @OA\Parameter(name="team_id", in="query", description="Filter by team ID", required=false, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="position_id", in="query", description="Filter by primary position ID", required=false, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="nationality", in="query", description="Filter by nationality", required=false, @OA\Schema(type="string")),
     *     @OA\Parameter(name="search", in="query", description="Search by first or last name", required=false, @OA\Schema(type="string")),
     *     @OA\Parameter(name="min_age", in="query", description="Minimum player age", required=false, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="max_age", in="query", description="Maximum player age", required=false, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="min_value", in="query", description="Minimum market value", required=false, @OA\Schema(type="number")),
     *     @OA\Parameter(name="max_value", in="query", description="Maximum market value", required=false, @OA\Schema(type="number")),
     *     @OA\Parameter(name="sort_by", in="query", description="Sort field (default: market_value)", required=false, @OA\Schema(type="string", enum={"market_value", "rating", "first_name", "last_name"})),
     *     @OA\Parameter(name="sort_order", in="query", description="Sort direction (default: desc)", required=false, @OA\Schema(type="string", enum={"asc", "desc"})),
     *     @OA\Parameter(name="per_page", in="query", description="Results per page (default: 15)", required=false, @OA\Schema(type="integer")),
     *     @OA\Response(
     *         response=200,
     *         description="Paginated list of players retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Paginated player data"),
     *             @OA\Property(property="message", type="string", example="Players retrieved successfully")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = Player::with(['team', 'primaryPosition', 'attributes']);

        // Filter by team if provided
        if ($request->has('team_id')) {
            $query->where('team_id', $request->team_id);
        }

        // Filter by position if provided
        if ($request->has('position_id')) {
            $query->where('primary_position_id', $request->position_id);
        }

        // Filter by nationality if provided
        if ($request->has('nationality')) {
            $query->where('nationality', $request->nationality);
        }

        // Search by name
        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('first_name', 'like', '%' . $request->search . '%')
                  ->orWhere('last_name', 'like', '%' . $request->search . '%');
            });
        }

        // Filter by age range
        if ($request->has('min_age')) {
            $query->whereRaw('(strftime("%Y", "now") - strftime("%Y", date_of_birth)) >= ?', [$request->min_age]);
        }
        if ($request->has('max_age')) {
            $query->whereRaw('(strftime("%Y", "now") - strftime("%Y", date_of_birth)) <= ?', [$request->max_age]);
        }

        // Filter by market value range
        if ($request->has('min_value')) {
            $query->where('market_value', '>=', $request->min_value);
        }
        if ($request->has('max_value')) {
            $query->where('market_value', '<=', $request->max_value);
        }

        // Sort options
        $sortBy = $request->get('sort_by', 'market_value');
        $sortOrder = $request->get('sort_order', 'desc');

        if ($sortBy === 'rating') {
            $query->join('player_attributes', 'players.id', '=', 'player_attributes.player_id')
                  ->orderBy('player_attributes.current_ability', $sortOrder);
        } else {
            $query->orderBy($sortBy, $sortOrder);
        }

        $players = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $players,
            'message' => 'Players retrieved successfully'
        ]);
    }

    /**
     * Store a newly created player.
     *
     * @OA\Post(
     *     path="/players",
     *     operationId="createPlayer",
     *     tags={"Players"},
     *     summary="Create a new player",
     *     description="Creates a new player with the provided details. Validates shirt number uniqueness within the team.",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"first_name", "last_name", "date_of_birth", "nationality", "preferred_foot", "height_cm", "weight_kg", "primary_position_id", "market_value", "wage_per_week"},
     *             @OA\Property(property="first_name", type="string", maxLength=100, example="Cristiano"),
     *             @OA\Property(property="last_name", type="string", maxLength=100, example="Ronaldo"),
     *             @OA\Property(property="date_of_birth", type="string", format="date", example="1985-02-05"),
     *             @OA\Property(property="nationality", type="string", maxLength=100, example="Portuguese"),
     *             @OA\Property(property="preferred_foot", type="string", enum={"left", "right", "both"}, example="right"),
     *             @OA\Property(property="height_cm", type="integer", minimum=140, maximum=220, example=187),
     *             @OA\Property(property="weight_kg", type="integer", minimum=40, maximum=150, example=83),
     *             @OA\Property(property="team_id", type="integer", nullable=true, description="Team ID (null for free agent)", example=1),
     *             @OA\Property(property="primary_position_id", type="integer", description="Primary position ID", example=10),
     *             @OA\Property(property="secondary_positions", type="array", @OA\Items(type="integer"), nullable=true, description="Array of secondary position IDs"),
     *             @OA\Property(property="market_value", type="number", minimum=0, example=75000000),
     *             @OA\Property(property="wage_per_week", type="number", minimum=0, example=500000),
     *             @OA\Property(property="contract_start", type="string", format="date", nullable=true, example="2024-01-01"),
     *             @OA\Property(property="contract_end", type="string", format="date", nullable=true, example="2026-06-30"),
     *             @OA\Property(property="shirt_number", type="integer", minimum=1, maximum=99, nullable=true, example=7),
     *             @OA\Property(property="is_injured", type="boolean", example=false),
     *             @OA\Property(property="injury_return_date", type="string", format="date", nullable=true)
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Player created successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Created player with team and position"),
     *             @OA\Property(property="message", type="string", example="Player created successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error or shirt number already taken",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Shirt number already taken by another player in this team")
     *         )
     *     )
     * )
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'date_of_birth' => 'required|date|before:today',
            'nationality' => 'required|string|max:100',
            'preferred_foot' => 'required|in:left,right,both',
            'height_cm' => 'required|integer|min:140|max:220',
            'weight_kg' => 'required|integer|min:40|max:150',
            'team_id' => 'nullable|exists:teams,id',
            'primary_position_id' => 'required|exists:positions,id',
            'secondary_positions' => 'nullable|array',
            'secondary_positions.*' => 'exists:positions,id',
            'market_value' => 'required|numeric|min:0',
            'wage_per_week' => 'required|numeric|min:0',
            'contract_start' => 'nullable|date',
            'contract_end' => 'nullable|date|after:contract_start',
            'shirt_number' => 'nullable|integer|min:1|max:99',
            'is_injured' => 'boolean',
            'injury_return_date' => 'nullable|date|after:today',
        ]);

        // Check shirt number uniqueness within team
        if ($validated['team_id'] && $validated['shirt_number']) {
            $existingPlayer = Player::where('team_id', $validated['team_id'])
                ->where('shirt_number', $validated['shirt_number'])
                ->first();

            if ($existingPlayer) {
                return response()->json([
                    'success' => false,
                    'message' => 'Shirt number already taken by another player in this team'
                ], 422);
            }
        }

        $player = Player::create($validated);
        $player->load(['team', 'primaryPosition']);

        return response()->json([
            'success' => true,
            'data' => $player,
            'message' => 'Player created successfully'
        ], 201);
    }

    /**
     * Display the specified player.
     *
     * @OA\Get(
     *     path="/players/{player}",
     *     operationId="getPlayer",
     *     tags={"Players"},
     *     summary="Get a specific player",
     *     description="Returns a single player with team, position, attributes, and tactical position relationships.",
     *     @OA\Parameter(
     *         name="player",
     *         in="path",
     *         description="Player ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Player retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Player with team, position, attributes, and tactical positions"),
     *             @OA\Property(property="message", type="string", example="Player retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Player not found"
     *     )
     * )
     */
    public function show(Player $player): JsonResponse
    {
        $player->load([
            'team.league',
            'primaryPosition',
            'attributes',
            'tacticalPositions.tactic.formation'
        ]);

        return response()->json([
            'success' => true,
            'data' => $player,
            'message' => 'Player retrieved successfully'
        ]);
    }

    /**
     * Update the specified player.
     *
     * @OA\Put(
     *     path="/players/{player}",
     *     operationId="updatePlayer",
     *     tags={"Players"},
     *     summary="Update an existing player",
     *     description="Updates a player's details. All fields are optional (uses 'sometimes' validation). Validates shirt number uniqueness within the team.",
     *     @OA\Parameter(
     *         name="player",
     *         in="path",
     *         description="Player ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="first_name", type="string", maxLength=100),
     *             @OA\Property(property="last_name", type="string", maxLength=100),
     *             @OA\Property(property="date_of_birth", type="string", format="date"),
     *             @OA\Property(property="nationality", type="string", maxLength=100),
     *             @OA\Property(property="preferred_foot", type="string", enum={"left", "right", "both"}),
     *             @OA\Property(property="height_cm", type="integer", minimum=140, maximum=220),
     *             @OA\Property(property="weight_kg", type="integer", minimum=40, maximum=150),
     *             @OA\Property(property="team_id", type="integer", nullable=true),
     *             @OA\Property(property="primary_position_id", type="integer"),
     *             @OA\Property(property="secondary_positions", type="array", @OA\Items(type="integer"), nullable=true),
     *             @OA\Property(property="market_value", type="number", minimum=0),
     *             @OA\Property(property="wage_per_week", type="number", minimum=0),
     *             @OA\Property(property="contract_start", type="string", format="date", nullable=true),
     *             @OA\Property(property="contract_end", type="string", format="date", nullable=true),
     *             @OA\Property(property="shirt_number", type="integer", minimum=1, maximum=99, nullable=true),
     *             @OA\Property(property="is_injured", type="boolean"),
     *             @OA\Property(property="injury_return_date", type="string", format="date", nullable=true)
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Player updated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Updated player with team, position, and attributes"),
     *             @OA\Property(property="message", type="string", example="Player updated successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Player not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error or shirt number already taken",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Shirt number already taken by another player in this team")
     *         )
     *     )
     * )
     */
    public function update(Request $request, Player $player): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'date_of_birth' => 'sometimes|date|before:today',
            'nationality' => 'sometimes|string|max:100',
            'preferred_foot' => 'sometimes|in:left,right,both',
            'height_cm' => 'sometimes|integer|min:140|max:220',
            'weight_kg' => 'sometimes|integer|min:40|max:150',
            'team_id' => 'nullable|exists:teams,id',
            'primary_position_id' => 'sometimes|exists:positions,id',
            'secondary_positions' => 'nullable|array',
            'secondary_positions.*' => 'exists:positions,id',
            'market_value' => 'sometimes|numeric|min:0',
            'wage_per_week' => 'sometimes|numeric|min:0',
            'contract_start' => 'nullable|date',
            'contract_end' => 'nullable|date|after:contract_start',
            'shirt_number' => 'nullable|integer|min:1|max:99',
            'is_injured' => 'boolean',
            'injury_return_date' => 'nullable|date|after:today',
        ]);

        // Check shirt number uniqueness within team if changing
        if (isset($validated['team_id']) && isset($validated['shirt_number'])) {
            $existingPlayer = Player::where('team_id', $validated['team_id'])
                ->where('shirt_number', $validated['shirt_number'])
                ->where('id', '!=', $player->id)
                ->first();

            if ($existingPlayer) {
                return response()->json([
                    'success' => false,
                    'message' => 'Shirt number already taken by another player in this team'
                ], 422);
            }
        }

        $player->update($validated);
        $player->load(['team', 'primaryPosition', 'attributes']);

        return response()->json([
            'success' => true,
            'data' => $player,
            'message' => 'Player updated successfully'
        ]);
    }

    /**
     * Remove the specified player.
     *
     * @OA\Delete(
     *     path="/players/{player}",
     *     operationId="deletePlayer",
     *     tags={"Players"},
     *     summary="Delete a player",
     *     description="Permanently deletes a player from the system.",
     *     @OA\Parameter(
     *         name="player",
     *         in="path",
     *         description="Player ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Player deleted successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Player deleted successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Player not found"
     *     )
     * )
     */
    public function destroy(Player $player): JsonResponse
    {
        $player->delete();

        return response()->json([
            'success' => true,
            'message' => 'Player deleted successfully'
        ]);
    }

    /**
     * Get player attributes in detail.
     *
     * @OA\Get(
     *     path="/players/{player}/attributes",
     *     operationId="getPlayerAttributes",
     *     tags={"Players"},
     *     summary="Get detailed player attributes",
     *     description="Returns the player's attributes grouped into technical, mental, physical, and goalkeeping categories, along with overall ability ratings.",
     *     @OA\Parameter(
     *         name="player",
     *         in="path",
     *         description="Player ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Player attributes retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="player", type="object", description="Player with primary position"),
     *                 @OA\Property(property="overall_ratings", type="object",
     *                     @OA\Property(property="current_ability", type="number", example=15.5),
     *                     @OA\Property(property="potential_ability", type="number", example=18.0)
     *                 ),
     *                 @OA\Property(property="technical", type="object", description="Technical attributes (finishing, first_touch, free_kick_taking, heading, long_shots, passing, technique, dribbling)"),
     *                 @OA\Property(property="mental", type="object", description="Mental attributes (aggression, anticipation, composure, concentration, decisions, determination, leadership, positioning, teamwork, vision, work_rate)"),
     *                 @OA\Property(property="physical", type="object", description="Physical attributes (acceleration, agility, balance, jumping_reach, natural_fitness, pace, stamina, strength)"),
     *                 @OA\Property(property="goalkeeping", type="object", description="Goalkeeping attributes (aerial_reach, command_of_area, handling, kicking, one_on_ones, reflexes, rushing_out, throwing)")
     *             ),
     *             @OA\Property(property="message", type="string", example="Player attributes retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Player or attributes not found",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Player attributes not found")
     *         )
     *     )
     * )
     */
    public function attributes(Player $player): JsonResponse
    {
        $attributes = $player->attributes;

        if (!$attributes) {
            return response()->json([
                'success' => false,
                'message' => 'Player attributes not found'
            ], 404);
        }

        $technicalAttributes = [
            'finishing' => $attributes->finishing,
            'first_touch' => $attributes->first_touch,
            'free_kick_taking' => $attributes->free_kick_taking,
            'heading' => $attributes->heading,
            'long_shots' => $attributes->long_shots,
            'passing' => $attributes->passing,
            'technique' => $attributes->technique,
            'dribbling' => $attributes->dribbling,
        ];

        $mentalAttributes = [
            'aggression' => $attributes->aggression,
            'anticipation' => $attributes->anticipation,
            'composure' => $attributes->composure,
            'concentration' => $attributes->concentration,
            'decisions' => $attributes->decisions,
            'determination' => $attributes->determination,
            'leadership' => $attributes->leadership,
            'positioning' => $attributes->positioning,
            'teamwork' => $attributes->teamwork,
            'vision' => $attributes->vision,
            'work_rate' => $attributes->work_rate,
        ];

        $physicalAttributes = [
            'acceleration' => $attributes->acceleration,
            'agility' => $attributes->agility,
            'balance' => $attributes->balance,
            'jumping_reach' => $attributes->jumping_reach,
            'natural_fitness' => $attributes->natural_fitness,
            'pace' => $attributes->pace,
            'stamina' => $attributes->stamina,
            'strength' => $attributes->strength,
        ];

        $goalkeepingAttributes = [
            'aerial_reach' => $attributes->aerial_reach,
            'command_of_area' => $attributes->command_of_area,
            'handling' => $attributes->handling,
            'kicking' => $attributes->kicking,
            'one_on_ones' => $attributes->one_on_ones,
            'reflexes' => $attributes->reflexes,
            'rushing_out' => $attributes->rushing_out,
            'throwing' => $attributes->throwing,
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'player' => $player->load(['primaryPosition']),
                'overall_ratings' => [
                    'current_ability' => $attributes->current_ability,
                    'potential_ability' => $attributes->potential_ability,
                ],
                'technical' => $technicalAttributes,
                'mental' => $mentalAttributes,
                'physical' => $physicalAttributes,
                'goalkeeping' => $goalkeepingAttributes,
            ],
            'message' => 'Player attributes retrieved successfully'
        ]);
    }

    /**
     * Transfer player to another team.
     *
     * @OA\Post(
     *     path="/players/{player}/transfer",
     *     operationId="transferPlayer",
     *     tags={"Players"},
     *     summary="Transfer a player to another team",
     *     description="Transfers a player to a new team, updating their contract details, wage, and shirt number. Validates shirt number availability in the destination team.",
     *     @OA\Parameter(
     *         name="player",
     *         in="path",
     *         description="Player ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"new_team_id", "transfer_fee", "new_wage", "contract_length_years"},
     *             @OA\Property(property="new_team_id", type="integer", description="Destination team ID", example=2),
     *             @OA\Property(property="transfer_fee", type="number", minimum=0, description="Transfer fee amount", example=50000000),
     *             @OA\Property(property="new_wage", type="number", minimum=0, description="New weekly wage", example=300000),
     *             @OA\Property(property="contract_length_years", type="integer", minimum=1, maximum=10, description="Contract duration in years", example=4),
     *             @OA\Property(property="shirt_number", type="integer", minimum=1, maximum=99, nullable=true, description="Shirt number at new team", example=9)
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Player transferred successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="player", type="object", description="Updated player with new team and position"),
     *                 @OA\Property(property="transfer_details", type="object",
     *                     @OA\Property(property="from_team", type="string", example="SL Benfica"),
     *                     @OA\Property(property="to_team", type="string", example="FC Porto"),
     *                     @OA\Property(property="transfer_fee", type="number", example=50000000),
     *                     @OA\Property(property="new_wage", type="number", example=300000),
     *                     @OA\Property(property="contract_length", type="string", example="4 years")
     *                 )
     *             ),
     *             @OA\Property(property="message", type="string", example="Player transferred successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Player or destination team not found"
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error or shirt number already taken in new team",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Shirt number already taken in the new team")
     *         )
     *     )
     * )
     */
    public function transfer(Request $request, Player $player): JsonResponse
    {
        $validated = $request->validate([
            'new_team_id' => 'required|exists:teams,id',
            'transfer_fee' => 'required|numeric|min:0',
            'new_wage' => 'required|numeric|min:0',
            'contract_length_years' => 'required|integer|min:1|max:10',
            'shirt_number' => 'nullable|integer|min:1|max:99',
        ]);

        $newTeam = Team::find($validated['new_team_id']);
        $oldTeam = $player->team;

        // Check shirt number availability
        if ($validated['shirt_number']) {
            $existingPlayer = Player::where('team_id', $validated['new_team_id'])
                ->where('shirt_number', $validated['shirt_number'])
                ->first();

            if ($existingPlayer) {
                return response()->json([
                    'success' => false,
                    'message' => 'Shirt number already taken in the new team'
                ], 422);
            }
        }

        // Update player details
        $player->update([
            'team_id' => $validated['new_team_id'],
            'wage_per_week' => $validated['new_wage'],
            'contract_start' => now(),
            'contract_end' => now()->addYears($validated['contract_length_years']),
            'shirt_number' => $validated['shirt_number'],
        ]);

        $player->load(['team', 'primaryPosition']);

        return response()->json([
            'success' => true,
            'data' => [
                'player' => $player,
                'transfer_details' => [
                    'from_team' => $oldTeam->name ?? 'Free Agent',
                    'to_team' => $newTeam->name,
                    'transfer_fee' => $validated['transfer_fee'],
                    'new_wage' => $validated['new_wage'],
                    'contract_length' => $validated['contract_length_years'] . ' years',
                ]
            ],
            'message' => 'Player transferred successfully'
        ]);
    }

    /**
     * Get players by position.
     *
     * @OA\Get(
     *     path="/positions/{position}/players",
     *     operationId="getPlayersByPosition",
     *     tags={"Players"},
     *     summary="Get all players for a specific position",
     *     description="Returns a list of players whose primary position matches the given position, ordered by market value descending.",
     *     @OA\Parameter(
     *         name="position",
     *         in="path",
     *         description="Position ID",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Players retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="position", type="object", description="Position details"),
     *                 @OA\Property(property="players", type="array", @OA\Items(type="object",
     *                     @OA\Property(property="id", type="integer"),
     *                     @OA\Property(property="full_name", type="string"),
     *                     @OA\Property(property="team", type="object"),
     *                     @OA\Property(property="age", type="integer"),
     *                     @OA\Property(property="nationality", type="string"),
     *                     @OA\Property(property="market_value", type="number"),
     *                     @OA\Property(property="current_ability", type="number")
     *                 ))
     *             ),
     *             @OA\Property(property="message", type="string", example="Players retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Position not found"
     *     )
     * )
     */
    public function byPosition(Position $position): JsonResponse
    {
        $players = $position->primaryPlayers()
            ->with(['team', 'attributes'])
            ->orderBy('market_value', 'desc')
            ->get()
            ->map(function ($player) {
                return [
                    'id' => $player->id,
                    'full_name' => $player->full_name,
                    'team' => $player->team,
                    'age' => $player->age,
                    'nationality' => $player->nationality,
                    'market_value' => $player->market_value,
                    'current_ability' => $player->attributes->current_ability ?? 0,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'position' => $position,
                'players' => $players
            ],
            'message' => 'Players retrieved successfully'
        ]);
    }
}
