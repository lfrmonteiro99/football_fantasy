<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\LeagueController;
use App\Http\Controllers\Api\MatchController;
use App\Http\Controllers\Api\SeasonController;

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

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// League routes
Route::get('/leagues', [LeagueController::class, 'index']);
Route::get('/leagues/{id}', [LeagueController::class, 'show']);

// Team routes
Route::get('/teams', [TeamController::class, 'index']);
Route::get('/teams/{id}', [TeamController::class, 'show']);

// Season routes
Route::get('/seasons', [SeasonController::class, 'index']);
Route::get('/seasons/current', [SeasonController::class, 'current']);
Route::get('/seasons/{id}', [SeasonController::class, 'show']);

// Match routes
Route::get('/matches/league', [MatchController::class, 'getLeagueMatches']);
Route::get('/matches/team', [MatchController::class, 'getTeamMatches']);
Route::get('/matches/upcoming', [MatchController::class, 'getUpcomingMatches']);
Route::get('/matches/{id}', [MatchController::class, 'getMatchDetails']);
