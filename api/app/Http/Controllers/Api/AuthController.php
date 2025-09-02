<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Team;
use App\Services\CalendarGenerationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    protected CalendarGenerationService $calendarService;

    public function __construct(CalendarGenerationService $calendarService)
    {
        $this->calendarService = $calendarService;
    }

    /**
     * Register a new user with team selection
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'managed_team_id' => 'required|exists:teams,id|unique:users,managed_team_id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if team is already managed
        $existingManager = User::where('managed_team_id', $request->managed_team_id)->first();
        if ($existingManager) {
            return response()->json([
                'success' => false,
                'message' => 'This team is already being managed by another user'
            ], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'managed_team_id' => $request->managed_team_id,
        ]);

        // Load the managed team relationship
        $user->load('managedTeam.league');

        // Generate calendars for all leagues for this new manager
        try {
            $calendarResults = $this->calendarService->generateCalendarsForNewManager($user);
            
            Log::info("Generated calendars for new manager {$user->name}", [
                'user_id' => $user->id,
                'calendar_results' => $calendarResults
            ]);
            
        } catch (\Exception $e) {
            Log::error("Failed to generate calendars for new manager {$user->name}: " . $e->getMessage(), [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
            
            // Don't fail registration if calendar generation fails, just log it
            $calendarResults = ['error' => 'Calendar generation failed: ' . $e->getMessage()];
        }

        // Create API token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'User registered successfully',
            'data' => [
                'user' => $user,
                'token' => $token,
                'token_type' => 'Bearer',
                'calendar_generation' => $calendarResults
            ]
        ], 201);
    }

    /**
     * Login user
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        // Load the managed team relationship
        $user->load('managedTeam.league');

        // Create API token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => $user,
                'token' => $token,
                'token_type' => 'Bearer'
            ]
        ]);
    }

    /**
     * Get authenticated user profile
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('managedTeam.league');

        return response()->json([
            'success' => true,
            'data' => $user
        ]);
    }

    /**
     * Logout user
     */
    public function logout(Request $request): JsonResponse
    {
        // Revoke the current token
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ]);
    }

    /**
     * Get available teams for management (teams without managers)
     */
    public function availableTeams(): JsonResponse
    {
        $availableTeams = Team::with('league')
            ->whereDoesntHave('manager') // Teams without managers
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $availableTeams,
            'message' => 'Available teams retrieved successfully'
        ]);
    }

    /**
     * Regenerate calendars for the authenticated manager
     */
    public function regenerateCalendars(Request $request): JsonResponse
    {
        $user = $request->user();
        
        try {
            $calendarResults = $this->calendarService->regenerateCalendarsForManager($user);
            
            Log::info("Regenerated calendars for manager {$user->name}", [
                'user_id' => $user->id,
                'calendar_results' => $calendarResults
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Calendars regenerated successfully',
                'data' => $calendarResults
            ]);
            
        } catch (\Exception $e) {
            Log::error("Failed to regenerate calendars for manager {$user->name}: " . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to regenerate calendars: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get calendar statistics for the authenticated manager
     */
    public function calendarStats(Request $request): JsonResponse
    {
        $user = $request->user();
        
        try {
            $stats = $this->calendarService->getManagerCalendarStats($user);
            
            return response()->json([
                'success' => true,
                'data' => $stats,
                'message' => 'Calendar statistics retrieved successfully'
            ]);
            
        } catch (\Exception $e) {
            Log::error("Failed to get calendar stats for manager {$user->name}: " . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to get calendar statistics: ' . $e->getMessage()
            ], 500);
        }
    }
}