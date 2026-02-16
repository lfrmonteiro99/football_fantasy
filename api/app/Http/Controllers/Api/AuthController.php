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
     *
     * @OA\Post(
     *     path="/auth/register",
     *     operationId="register",
     *     tags={"Auth"},
     *     summary="Register a new user with team selection",
     *     description="Creates a new user account, assigns a managed team, generates league calendars, and returns an API token.",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name","email","password","password_confirmation","managed_team_id"},
     *             @OA\Property(property="name", type="string", maxLength=255, example="John Doe"),
     *             @OA\Property(property="email", type="string", format="email", maxLength=255, example="john@example.com"),
     *             @OA\Property(property="password", type="string", format="password", minLength=8, example="secret123"),
     *             @OA\Property(property="password_confirmation", type="string", format="password", example="secret123"),
     *             @OA\Property(property="managed_team_id", type="integer", example=1)
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="User registered successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="User registered successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="user", type="object", description="The created user with managedTeam.league loaded"),
     *                 @OA\Property(property="token", type="string", example="1|abc123tokenstring"),
     *                 @OA\Property(property="token_type", type="string", example="Bearer"),
     *                 @OA\Property(property="calendar_generation", type="object", description="Calendar generation results")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed or team already managed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     )
     * )
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
     *
     * @OA\Post(
     *     path="/auth/login",
     *     operationId="login",
     *     tags={"Auth"},
     *     summary="Authenticate a user and return a token",
     *     description="Validates credentials and returns the user object with a Bearer token.",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"email","password"},
     *             @OA\Property(property="email", type="string", format="email", example="john@example.com"),
     *             @OA\Property(property="password", type="string", format="password", example="secret123")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Login successful",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Login successful"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="user", type="object", description="The authenticated user with managedTeam.league loaded"),
     *                 @OA\Property(property="token", type="string", example="1|abc123tokenstring"),
     *                 @OA\Property(property="token_type", type="string", example="Bearer")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Invalid credentials",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Invalid credentials")
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="Validation failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     )
     * )
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
     *
     * @OA\Get(
     *     path="/auth/profile",
     *     operationId="profile",
     *     tags={"Auth"},
     *     summary="Get the authenticated user's profile",
     *     description="Returns the current user with their managed team and league relationships loaded.",
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="User profile retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="The authenticated user with managedTeam.league loaded")
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     )
     * )
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
     *
     * @OA\Post(
     *     path="/auth/logout",
     *     operationId="logout",
     *     tags={"Auth"},
     *     summary="Logout the authenticated user",
     *     description="Revokes the current access token for the authenticated user.",
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Logged out successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Logged out successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     )
     * )
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
     *
     * @OA\Get(
     *     path="/auth/available-teams",
     *     operationId="availableTeams",
     *     tags={"Auth"},
     *     summary="List teams available for management",
     *     description="Returns all teams that do not currently have a manager assigned, ordered alphabetically. Used during registration to let the user pick a team.",
     *     @OA\Response(
     *         response=200,
     *         description="Available teams retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *                 @OA\Items(
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="name", type="string", example="SL Benfica"),
     *                     @OA\Property(property="league", type="object", description="The league the team belongs to")
     *                 )
     *             ),
     *             @OA\Property(property="message", type="string", example="Available teams retrieved successfully")
     *         )
     *     )
     * )
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
     *
     * @OA\Post(
     *     path="/auth/regenerate-calendars",
     *     operationId="regenerateCalendars",
     *     tags={"Auth"},
     *     summary="Regenerate league calendars for the current manager",
     *     description="Regenerates the match calendars for all leagues associated with the authenticated manager's team.",
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Calendars regenerated successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Calendars regenerated successfully"),
     *             @OA\Property(property="data", type="object", description="Calendar generation results")
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Calendar regeneration failed",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to regenerate calendars: error details")
     *         )
     *     )
     * )
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
     *
     * @OA\Get(
     *     path="/auth/calendar-stats",
     *     operationId="calendarStats",
     *     tags={"Auth"},
     *     summary="Get calendar statistics for the current manager",
     *     description="Returns statistics about the match calendars for the authenticated manager, such as total matches, completed, upcoming, etc.",
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Calendar statistics retrieved successfully",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object", description="Calendar statistics"),
     *             @OA\Property(property="message", type="string", example="Calendar statistics retrieved successfully")
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Failed to retrieve statistics",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to get calendar statistics: error details")
     *         )
     *     )
     * )
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
