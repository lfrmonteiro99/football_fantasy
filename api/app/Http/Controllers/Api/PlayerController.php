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
