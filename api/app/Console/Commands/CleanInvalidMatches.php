<?php

namespace App\Console\Commands;

use App\Models\GameMatch;
use Illuminate\Console\Command;

class CleanInvalidMatches extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'matches:clean-invalid {--dry-run : Show what would be deleted without actually deleting}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up invalid matches where a team plays against itself';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dryRun = $this->option('dry-run');

        // Find matches where home_team_id equals away_team_id
        $invalidMatches = GameMatch::whereColumn('home_team_id', 'away_team_id')->get();

        if ($invalidMatches->isEmpty()) {
            $this->info('No invalid matches found.');
            return;
        }

        $this->warn("Found {$invalidMatches->count()} invalid matches where teams play against themselves:");

        foreach ($invalidMatches as $match) {
            $this->line("- Match ID {$match->id}: Team {$match->home_team_id} vs Team {$match->away_team_id} on {$match->match_date}");
        }

        if ($dryRun) {
            $this->info('Dry run mode: No matches were deleted.');
            return;
        }

        if ($this->confirm('Do you want to delete these invalid matches?')) {
            $deletedCount = GameMatch::whereColumn('home_team_id', 'away_team_id')->delete();
            $this->info("Successfully deleted {$deletedCount} invalid matches.");
        } else {
            $this->info('No matches were deleted.');
        }
    }
}