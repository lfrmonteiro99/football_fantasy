<?php

namespace App\Services;

use App\Models\League;
use App\Models\Season;
use App\Models\GameMatch;
use App\Models\Team;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Console\Command;

class CalendarGenerationService
{
    /**
     * Generate calendars for all leagues when a new manager is created.
     * Each manager gets their own unique set of fixtures with randomized dates.
     */
    public function generateCalendarsForNewManager(User $user): array
    {
        Log::info("Generating calendars for new manager: {$user->name} (ID: {$user->id})");
        
        // Get or create current season
        $season = $this->getCurrentOrCreateSeason();
        
        // Get all leagues
        $leagues = League::all();
        
        $results = [];
        
        foreach ($leagues as $league) {
            try {
                $matchCount = $this->generateCalendarForLeague($league, $season, $user);
                $results[] = [
                    'league_id' => $league->id,
                    'league_name' => $league->name,
                    'matches_generated' => $matchCount,
                    'status' => 'success'
                ];
                
                Log::info("Generated {$matchCount} matches for league {$league->name} (manager: {$user->name})");
                
            } catch (\Exception $e) {
                Log::error("Failed to generate calendar for league {$league->name} (manager: {$user->name}): " . $e->getMessage());
                
                $results[] = [
                    'league_id' => $league->id,
                    'league_name' => $league->name,
                    'matches_generated' => 0,
                    'status' => 'error',
                    'error' => $e->getMessage()
                ];
            }
        }
        
        return $results;
    }

    /**
     * Generate calendar for a specific league for a specific manager
     */
    protected function generateCalendarForLeague(League $league, Season $season, User $user): int
    {
        // Get teams for this league
        $teams = Team::where('league_id', $league->id)->get();

        if ($teams->count() < 2) {
            throw new \Exception("Not enough teams in {$league->name} to generate a calendar. Minimum 2 teams required.");
        }

        // Generate the fixtures with randomization for this manager
        $fixtures = $this->generateFixtures($teams->pluck('id')->toArray(), $season, $user->id);

        // Create the matches
        $matchCount = 0;
        foreach ($fixtures as $fixture) {
            GameMatch::create([
                'league_id' => $league->id,
                'season_id' => $season->id,
                'home_team_id' => $fixture['home_team_id'],
                'away_team_id' => $fixture['away_team_id'],
                'match_date' => $fixture['match_date'],
                'match_time' => $fixture['match_time'],
                'matchday' => $fixture['matchday'],
                'status' => 'scheduled',
                'manager_id' => $user->id, // Each manager gets their own fixtures
            ]);
            $matchCount++;
        }

        return $matchCount;
    }

    /**
     * Generate fixtures using round-robin algorithm with manager-specific randomization
     */
    protected function generateFixtures(array $teamIds, Season $season, int $managerId): array
    {
        $fixtures = [];
        $teamCount = count($teamIds);

        // If odd number of teams, add a "bye" team
        if ($teamCount % 2 !== 0) {
            $teamIds[] = null;
            $teamCount++;
        }

        // Calculate how many rounds we need
        $rounds = $teamCount - 1;

        // Create a manager-specific randomization seed
        srand($managerId * 1000 + time()); // Unique seed per manager
        
        // Shuffle teams for this manager to create different fixture orders
        shuffle($teamIds);

        // Start date from the season with manager-specific variation
        $startDate = Carbon::parse($season->start_date);
        
        // Add random days (0-14) to vary season start for each manager
        $startDate->addDays(rand(0, 14));

        // Temporary array to hold the teams
        $teams = $teamIds;

        // Remove the first team
        $firstTeam = array_shift($teams);

        // Generate varied match times
        $matchTimes = ['12:30:00', '15:00:00', '17:30:00', '20:00:00'];

        // For each round
        for ($round = 0; $round < $rounds; $round++) {
            $matchday = $round + 1;
            
            // Vary the days between matches (5-9 days instead of fixed 7)
            $daysBetweenMatches = rand(5, 9);
            $roundDate = $startDate->copy()->addDays($round * $daysBetweenMatches);

            // Match the first team with the last team
            if ($teams[count($teams) - 1] !== null && $firstTeam !== null && $firstTeam !== $teams[count($teams) - 1]) {
                $fixtures[] = [
                    'home_team_id' => $firstTeam,
                    'away_team_id' => $teams[count($teams) - 1],
                    'match_date' => $roundDate->format('Y-m-d'),
                    'match_time' => $matchTimes[array_rand($matchTimes)], // Random time
                    'matchday' => $matchday,
                ];
            }

            // Match the other teams
            for ($i = 0; $i < count($teams) / 2; $i++) {
                if ($teams[$i] !== null && $teams[count($teams) - 1 - $i] !== null && $teams[$i] !== $teams[count($teams) - 1 - $i]) {
                    // Randomize home/away instead of fixed pattern
                    $homeTeam = rand(0, 1) ? $teams[$i] : $teams[count($teams) - 1 - $i];
                    $awayTeam = ($homeTeam === $teams[$i]) ? $teams[count($teams) - 1 - $i] : $teams[$i];

                    $fixtures[] = [
                        'home_team_id' => $homeTeam,
                        'away_team_id' => $awayTeam,
                        'match_date' => $roundDate->format('Y-m-d'),
                        'match_time' => $matchTimes[array_rand($matchTimes)],
                        'matchday' => $matchday,
                    ];
                }
            }

            // Rotate the teams (except the first one)
            array_unshift($teams, array_pop($teams));
        }

        // Generate the second half of the season by swapping home/away
        $secondHalfFixtures = [];
        
        // Add random break between halves (10-21 days)
        $breakDays = rand(10, 21);
        $secondHalfStartDate = $startDate->copy()->addDays($rounds * 7 + $breakDays);

        foreach ($fixtures as $key => $fixture) {
            $matchday = $fixture['matchday'] + $rounds;
            
            // Vary match spacing in second half too
            $daysBetweenMatches = rand(5, 9);
            $roundDate = $secondHalfStartDate->copy()->addDays(($fixture['matchday'] - 1) * $daysBetweenMatches);

            // Only add the fixture if home and away teams are different
            if ($fixture['away_team_id'] !== $fixture['home_team_id']) {
                $secondHalfFixtures[] = [
                    'home_team_id' => $fixture['away_team_id'],
                    'away_team_id' => $fixture['home_team_id'],
                    'match_date' => $roundDate->format('Y-m-d'),
                    'match_time' => $matchTimes[array_rand($matchTimes)],
                    'matchday' => $matchday,
                ];
            }
        }

        // Reset random seed
        srand();

        return array_merge($fixtures, $secondHalfFixtures);
    }

    /**
     * Get current season or create a new one
     */
    protected function getCurrentOrCreateSeason(): Season
    {
        return Season::firstOrCreate(
            ['is_current' => true],
            [
                'start_date' => date('Y-m-d', strtotime('first day of September')),
                'end_date' => date('Y-m-d', strtotime('last day of May')),
                'name' => (date('Y')) . '-' . (date('Y') + 1),
                'is_current' => true,
            ]
        );
    }

    /**
     * Delete all matches for a specific manager (useful for regenerating)
     */
    public function clearManagerCalendars(User $user): bool
    {
        try {
            $deletedCount = GameMatch::where('manager_id', $user->id)->delete();
            
            Log::info("Cleared {$deletedCount} matches for manager {$user->name} (ID: {$user->id})");
            
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to clear calendars for manager {$user->name}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Regenerate calendars for an existing manager
     */
    public function regenerateCalendarsForManager(User $user): array
    {
        // Clear existing calendars
        $this->clearManagerCalendars($user);
        
        // Generate new calendars
        return $this->generateCalendarsForNewManager($user);
    }

    /**
     * Get calendar statistics for a manager
     */
    public function getManagerCalendarStats(User $user): array
    {
        $totalMatches = GameMatch::where('manager_id', $user->id)->count();
        $scheduledMatches = GameMatch::where('manager_id', $user->id)->where('status', 'scheduled')->count();
        $playedMatches = GameMatch::where('manager_id', $user->id)->whereIn('status', ['completed', 'finished'])->count();
        
        $leagueStats = GameMatch::select('league_id')
            ->selectRaw('count(*) as match_count')
            ->where('manager_id', $user->id)
            ->with('league:id,name')
            ->groupBy('league_id')
            ->get()
            ->map(function ($stat) {
                return [
                    'league_id' => $stat->league_id,
                    'league_name' => $stat->league->name ?? 'Unknown',
                    'match_count' => $stat->match_count
                ];
            });

        return [
            'total_matches' => $totalMatches,
            'scheduled_matches' => $scheduledMatches,
            'played_matches' => $playedMatches,
            'leagues' => $leagueStats
        ];
    }
}