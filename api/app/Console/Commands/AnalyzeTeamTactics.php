<?php

namespace App\Console\Commands;

use App\Models\Team;
use App\Models\Tactic;
use App\Services\TacticalAnalysisService;
use Illuminate\Console\Command;

class AnalyzeTeamTactics extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tactics:analyze {--team=* : Specific team IDs to analyze} {--all : Analyze all teams}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Analyze team tactics and generate dynamic characteristics based on formation, positions, and instructions';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $analysisService = new TacticalAnalysisService();
        
        // Determine which teams to analyze
        if ($this->option('all')) {
            $teams = Team::with(['tactics' => function($query) {
                $query->wherePivot('is_active', true);
            }])->get();
            $this->info('Analyzing all teams...');
        } elseif ($teamIds = $this->option('team')) {
            $teams = Team::with(['tactics' => function($query) {
                $query->wherePivot('is_active', true);
            }])->whereIn('id', $teamIds)->get();
            $this->info('Analyzing specific teams: ' . implode(', ', $teamIds));
        } else {
            $this->error('Please specify either --all or --team=ID');
            return 1;
        }

        if ($teams->isEmpty()) {
            $this->warn('No teams found to analyze.');
            return 0;
        }

        $this->info("Found {$teams->count()} teams to analyze.");
        
        $processedTactics = 0;
        $updatedTeams = 0;
        
        // Create progress bar
        $bar = $this->output->createProgressBar($teams->count());
        $bar->start();

        foreach ($teams as $team) {
            $teamUpdated = false;
            
            // Analyze each active tactic for this team
            foreach ($team->tactics as $tactic) {
                if ($tactic->pivot->is_active) {
                    $oldCharacteristics = $tactic->characteristics ?? [];
                    
                    // Generate new characteristics
                    $newCharacteristics = $analysisService->generateCharacteristics($tactic);
                    
                    // Update if characteristics have changed
                    if ($oldCharacteristics !== $newCharacteristics) {
                        $tactic->update(['characteristics' => $newCharacteristics]);
                        $processedTactics++;
                        $teamUpdated = true;
                        
                        if ($this->option('verbose')) {
                            $this->newLine();
                            $this->line("Updated tactic '{$tactic->name}' for team '{$team->name}'");
                            $this->line("Old: " . implode(', ', $oldCharacteristics));
                            $this->line("New: " . implode(', ', $newCharacteristics));
                        }
                    }
                }
            }
            
            if ($teamUpdated) {
                $updatedTeams++;
            }
            
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        
        // Also analyze tactics that are not assigned to teams
        $this->info('Analyzing unassigned tactics...');
        $unassignedTactics = Tactic::whereDoesntHave('teams')->get();
        
        if ($unassignedTactics->isNotEmpty()) {
            $unassignedBar = $this->output->createProgressBar($unassignedTactics->count());
            $unassignedBar->start();
            
            foreach ($unassignedTactics as $tactic) {
                $oldCharacteristics = $tactic->characteristics ?? [];
                $newCharacteristics = $analysisService->generateCharacteristics($tactic);
                
                if ($oldCharacteristics !== $newCharacteristics) {
                    $tactic->update(['characteristics' => $newCharacteristics]);
                    $processedTactics++;
                    
                    if ($this->option('verbose')) {
                        $this->newLine();
                        $this->line("Updated unassigned tactic '{$tactic->name}'");
                    }
                }
                
                $unassignedBar->advance();
            }
            
            $unassignedBar->finish();
            $this->newLine();
        }

        // Summary
        $this->info("Analysis complete!");
        $this->table(['Metric', 'Count'], [
            ['Teams analyzed', $teams->count()],
            ['Teams with updates', $updatedTeams],
            ['Tactics updated', $processedTactics],
            ['Unassigned tactics', $unassignedTactics->count()],
        ]);

        if ($processedTactics > 0) {
            $this->info("Successfully updated {$processedTactics} tactics with new dynamic characteristics.");
        } else {
            $this->info("All tactics already have up-to-date characteristics.");
        }

        return 0;
    }
}