<?php

namespace App\Http\Controllers;

/**
 * @OA\Info(
 *     version="1.0.0",
 *     title="Football Fantasy Manager API",
 *     description="API for managing football fantasy leagues, teams, players, tactics, formations, and match simulations with real-time SSE streaming.",
 *     @OA\Contact(
 *         name="Football Fantasy",
 *         email="support@footballfantasy.com"
 *     )
 * )
 *
 * @OA\Server(
 *     url="/api/v1",
 *     description="API v1"
 * )
 *
 * @OA\SecurityScheme(
 *     securityScheme="sanctum",
 *     type="http",
 *     scheme="bearer",
 *     bearerFormat="Token",
 *     description="Enter your Sanctum token"
 * )
 *
 * @OA\Tag(name="Auth", description="Authentication endpoints")
 * @OA\Tag(name="Teams", description="Team management")
 * @OA\Tag(name="Players", description="Player management and attributes")
 * @OA\Tag(name="Formations", description="Formation management")
 * @OA\Tag(name="Tactics", description="Tactical setup and analysis")
 * @OA\Tag(name="Matches", description="Match details, lineups, and operations")
 * @OA\Tag(name="Leagues", description="League management and standings")
 * @OA\Tag(name="Positions", description="Playing position management")
 * @OA\Tag(name="Simulation", description="Match simulation (new tick-based engine)")
 * @OA\Tag(name="Simulator", description="Legacy match simulation endpoints")
 * @OA\Tag(name="Time", description="Game time progression")
 * @OA\Tag(name="Stats", description="Statistics and overview")
 * @OA\Tag(name="Utils", description="Utility endpoints")
 */
abstract class Controller
{
    //
}
