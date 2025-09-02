<?php

namespace App\Console\Commands;

use App\Models\League;
use App\Models\GameMatch;
use App\Models\Season;
use App\Models\Team;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateLeagueCalendar extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'league:generate-calendar {league_id? : The ID of the league} {season_id? : The ID of the season} {--force : Force regeneration of the calendar}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate a match calendar for a league season (if no league_id is provided, generates for all leagues)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $leagueId = $this->argument('league_id');
        $seasonId = $this->argument('season_id');
        $force = $this->option('force');

        $leagues = isset($leagueId) ?
            collect([League::find($leagueId)])->filter() :
            League::all();



        // Get or create the current season
        $season = isset($seasonId) ?
            Season::find($seasonId) :
            Season::firstOrCreate(
                ['is_current' => true],
                [
                    'start_date' => date('Y-m-d', strtotime('first day of September')),
                    'end_date' => date('Y-m-d', strtotime('last day of May')),
                    'name' => '2025-2026',
                    'is_current' => true,
                ]
            );

        foreach($leagues as $league) {
            $this->generateCalendarForLeague($league, $season, $force);
        }
    }

    /**
     * Generate calendar for a specific league
     *
     * @param League $league
     * @param Season $season
     * @param bool $force
     * @return void
     */
    protected function generateCalendarForLeague(League $league, Season $season, bool $force): void
    {
        // Check if matches already exist for this league and season
        $existingMatches = GameMatch::where('league_id', $league->id)
            ->where('season_id', $season->id)
            ->count();

        if ($existingMatches > 0 && !$force) {
            if ($this->input->isInteractive() && !$this->confirm("Matches already exist for {$league->name} in {$season->name}. Do you want to regenerate the calendar? This will delete all existing matches.")) {
                $this->info('Calendar generation cancelled for ' . $league->name);
                return;
            }

            // Delete existing matches
            GameMatch::where('league_id', $league->id)
                ->where('season_id', $season->id)
                ->delete();

            $this->info("Deleted existing matches for {$league->name} in {$season->name}.");
        }

        // Get teams for this league
        $teams = Team::where('league_id', $league->id)->get();

        if ($teams->count() < 2) {
            $this->error("Not enough teams in {$league->name} to generate a calendar. Minimum 2 teams required.");
            return;
        }

        $this->info("Generating calendar for {$league->name} in {$season->name} with {$teams->count()} teams...");

        // Generate the fixtures
        $fixtures = $this->generateFixtures($teams->pluck('id')->toArray(), $season);

        // Create the matches
        $matchCount = 0;
        foreach ($fixtures as $fixture) {
            try {
            GameMatch::create([
                'league_id' => $league->id,
                'season_id' => $season->id,
                'home_team_id' => $fixture['home_team_id'],
                'away_team_id' => $fixture['away_team_id'],
                'match_date' => $fixture['match_date'],
                'match_time' => $fixture['match_time'],
                'matchday' => $fixture['matchday'],
                'status' => 'scheduled',
            ]);
            $matchCount++;
            } catch (\Exception $e) {
                dd($e->getMessage());
            }
        }

        $this->info("Successfully generated {$matchCount} matches for {$league->name} in {$season->name}.");
    }

    /**
     * Generate fixtures using the round-robin algorithm
     *
     * @param array $teamIds
     * @param Season $season
     * @return array
     */
    private function generateFixtures(array $teamIds, Season $season): array
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

        // Start date from the season
        $startDate = Carbon::parse($season->start_date);

        // Temporary array to hold the teams
        $teams = $teamIds;

        // Remove the first team
        $firstTeam = array_shift($teams);

        // For each round
        for ($round = 0; $round < $rounds; $round++) {
            $matchday = $round + 1;
            $roundDate = $startDate->copy()->addDays($round * 7); // One round per week

            // Match the first team with the last team
            if ($teams[count($teams) - 1] !== null && $firstTeam !== null && $firstTeam !== $teams[count($teams) - 1]) {
                $fixtures[] = [
                    'home_team_id' => $firstTeam,
                    'away_team_id' => $teams[count($teams) - 1],
                    'match_date' => $roundDate->format('Y-m-d'),
                    'match_time' => '15:00:00', // Default time
                    'matchday' => $matchday,
                ];
            }

            // Match the other teams
            for ($i = 0; $i < count($teams) / 2; $i++) {
                if ($teams[$i] !== null && $teams[count($teams) - 1 - $i] !== null && $teams[$i] !== $teams[count($teams) - 1 - $i]) {
                    // For even rounds, flip home/away
                    if ($round % 2 === 0) {
                        $fixtures[] = [
                            'home_team_id' => $teams[$i],
                            'away_team_id' => $teams[count($teams) - 1 - $i],
                            'match_date' => $roundDate->format('Y-m-d'),
                            'match_time' => '15:00:00',
                            'matchday' => $matchday,
                        ];
                    } else {
                        $fixtures[] = [
                            'home_team_id' => $teams[count($teams) - 1 - $i],
                            'away_team_id' => $teams[$i],
                            'match_date' => $roundDate->format('Y-m-d'),
                            'match_time' => '15:00:00',
                            'matchday' => $matchday,
                        ];
                    }
                }
            }

            // Rotate the teams (except the first one)
            array_unshift($teams, array_pop($teams));
        }

        // Generate the second half of the season by swapping home/away
        $secondHalfFixtures = [];
        $secondHalfStartDate = $startDate->copy()->addDays($rounds * 7 + 14); // 2 weeks break between halves

        foreach ($fixtures as $key => $fixture) {
            $matchday = $fixture['matchday'] + $rounds;
            $roundDate = $secondHalfStartDate->copy()->addDays(($fixture['matchday'] - 1) * 7);

            // Only add the fixture if home and away teams are different
            if ($fixture['away_team_id'] !== $fixture['home_team_id']) {
                $secondHalfFixtures[] = [
                    'home_team_id' => $fixture['away_team_id'],
                    'away_team_id' => $fixture['home_team_id'],
                    'match_date' => $roundDate->format('Y-m-d'),
                    'match_time' => '15:00:00',
                    'matchday' => $matchday,
                ];
            }
        }

        return array_merge($fixtures, $secondHalfFixtures);
    }
}
