<?php

namespace App\Services;

use App\Models\GameMatch;
use App\Models\GameSetting;
use App\Models\User;
use Carbon\Carbon;

class TimeService
{
    /**
     * Get the current game date for a specific user.
     */
    public function getCurrentGameDate(?int $userId = null): Carbon
    {
        if (!$userId) {
            return Carbon::now();
        }

        $user = \App\Models\User::find($userId);
        if (!$user || !$user->game_date) {
            // Initialize user's game date if not set
            $initialDate = $this->calculateInitialGameDate($user);
            $this->setCurrentGameDate($initialDate, $userId);
            return $initialDate;
        }

        return Carbon::parse($user->game_date);
    }

    /**
     * Calculate initial game date for a user based on their team's matches.
     */
    private function calculateInitialGameDate(?User $user): Carbon
    {
        if (!$user || !$user->managed_team_id) {
            return Carbon::now();
        }

        $teamId = $user->managed_team_id;

        // Try to get the most recent completed match
        $lastCompletedMatch = $this->getLastCompletedMatchForTeam($teamId);
        if ($lastCompletedMatch) {
            return Carbon::parse($lastCompletedMatch->match_date);
        }

        // If no completed matches, use the day before first match as season start
        $firstMatch = $this->getFirstMatchForTeam($teamId);
        if ($firstMatch) {
            return Carbon::parse($firstMatch->match_date)->subDay();
        }

        return Carbon::now();
    }

    /**
     * Set the current game date for a specific user.
     */
    public function setCurrentGameDate(Carbon $date, int $userId): void
    {
        $user = User::find($userId);
        if ($user) {
            $user->update(['game_date' => $date]);
        }
    }

    /**
     * Get the next scheduled match for a team.
     */
    public function getNextMatchForTeam(int $teamId, ?Carbon $fromDate = null): ?GameMatch
    {
        $fromDate = $fromDate ?? $this->getCurrentGameDate($teamId);

        return GameMatch::where(function($q) use ($teamId) {
            $q->where('home_team_id', $teamId)
              ->orWhere('away_team_id', $teamId);
        })
        ->where('match_date', '>', $fromDate)
        ->where('status', 'scheduled')
        ->orderBy('match_date')
        ->first();
    }

    /**
     * Get the latest match (completed or scheduled) for a team.
     */
    public function getLatestMatchForTeam(int $teamId): ?GameMatch
    {
        return GameMatch::where(function($q) use ($teamId) {
            $q->where('home_team_id', $teamId)
              ->orWhere('away_team_id', $teamId);
        })
        ->orderBy('match_date', 'desc')
        ->first();
    }

    /**
     * Get the most recent completed match for a team.
     */
    public function getLastCompletedMatchForTeam(int $teamId): ?GameMatch
    {
        return GameMatch::where(function($q) use ($teamId) {
            $q->where('home_team_id', $teamId)
              ->orWhere('away_team_id', $teamId);
        })
        ->where('status', 'completed')
        ->orderBy('match_date', 'desc')
        ->first();
    }

    /**
     * Get the first match (earliest date) for a team.
     */
    public function getFirstMatchForTeam(int $teamId): ?GameMatch
    {
        return GameMatch::where(function($q) use ($teamId) {
            $q->where('home_team_id', $teamId)
              ->orWhere('away_team_id', $teamId);
        })
        ->orderBy('match_date', 'asc')
        ->first();
    }

    /**
     * Advance time by one day and return information about the next match.
     */
    public function advanceDay(int $teamId, int $userId): array
    {
        $currentDate = $this->getCurrentGameDate($userId);
        $nextMatch = $this->getNextMatchForTeam($teamId, $currentDate);

        if (!$nextMatch) {
            throw new \Exception('No upcoming matches found for this team');
        }

        $nextMatchDate = Carbon::parse($nextMatch->match_date);
        $daysUntilMatch = $currentDate->diffInDays($nextMatchDate);

        if ($daysUntilMatch === 0) {
            return [
                'current_date' => $currentDate->format('Y-m-d'),
                'next_match' => $nextMatch,
                'days_until_match' => 0,
                'match_day' => true,
                'message' => 'Next match is today!'
            ];
        }

        // Advance one day
        $newDate = $currentDate->addDay();
        $this->setCurrentGameDate($newDate, $userId); // Persist the new date
        $newDaysUntilMatch = $newDate->diffInDays($nextMatchDate);

        return [
            'current_date' => $newDate->format('Y-m-d'),
            'next_match' => $nextMatch,
            'days_until_match' => $newDaysUntilMatch,
            'match_day' => $newDate->isSameDay($nextMatchDate),
            'message' => 'Advanced one day'
        ];
    }

    /**
     * Advance time intelligently to next significant event with day-by-day progression data.
     */
    public function advanceToNextEvent(int $teamId, int $userId): array
    {
        $currentDate = $this->getCurrentGameDate($userId);
        $nextMatch = $this->getNextMatchForTeam($teamId, $currentDate);

        if (!$nextMatch) {
            throw new \Exception('No upcoming matches found for this team');
        }

        $matchDate = Carbon::parse($nextMatch->match_date);
        $daysToAdvance = $currentDate->diffInDays($matchDate);

        // Generate day-by-day progression data for animation
        $dayProgression = [];
        $tempDate = $currentDate->copy();
        
        for ($i = 0; $i <= $daysToAdvance; $i++) {
            $dayProgression[] = [
                'date' => $tempDate->format('Y-m-d'),
                'formatted_date' => $tempDate->format('l, F j, Y'),
                'day_number' => $i + 1,
                'is_match_day' => $tempDate->isSameDay($matchDate),
                'events' => $this->getEventsForDate($tempDate, $teamId), // Future: training, injuries, etc.
            ];
            $tempDate->addDay();
        }

        // Check if there are any stopping events (currently just matches)
        $stoppingEvents = $this->findStoppingEvents($currentDate, $matchDate, $teamId);
        
        // For now, always advance to match day unless it's today
        if ($daysToAdvance === 0) {
            return [
                'current_date' => $currentDate->format('Y-m-d'),
                'next_match' => $nextMatch,
                'days_until_match' => 0,
                'match_day' => true,
                'days_advanced' => 0,
                'day_progression' => $dayProgression,
                'stopping_reason' => 'match_day',
                'message' => 'Next match is today!'
            ];
        }

        // Advance to match day
        $this->setCurrentGameDate($matchDate, $userId);

        return [
            'current_date' => $matchDate->format('Y-m-d'),
            'next_match' => $nextMatch,
            'days_until_match' => 0,
            'match_day' => true,
            'days_advanced' => $daysToAdvance,
            'day_progression' => $dayProgression,
            'stopping_reason' => 'match_day',
            'stopping_events' => $stoppingEvents,
            'message' => "Advanced {$daysToAdvance} days to match day"
        ];
    }

    /**
     * Get events for a specific date (placeholder for future implementation).
     */
    private function getEventsForDate(Carbon $date, int $teamId): array
    {
        // Future implementation:
        // - Training sessions
        // - Player injuries/recovery
        // - Transfer windows
        // - Contract negotiations
        // - Press conferences
        // - Cup draws
        
        return [];
    }

    /**
     * Find events that should stop time advancement (placeholder for future implementation).
     */
    private function findStoppingEvents(Carbon $fromDate, Carbon $toDate, int $teamId): array
    {
        // Future implementation:
        // - Important training decisions
        // - Injury updates requiring attention
        // - Transfer offers
        // - Contract renewals
        // - Disciplinary issues
        
        return [];
    }

    /**
     * Calculate days until next match for a team.
     */
    public function getDaysUntilNextMatch(int $teamId, int $userId): ?int
    {
        $currentDate = $this->getCurrentGameDate($userId);
        $nextMatch = $this->getNextMatchForTeam($teamId, $currentDate);

        if (!$nextMatch) {
            return null;
        }

        $nextMatchDate = Carbon::parse($nextMatch->match_date);
        return $currentDate->diffInDays($nextMatchDate);
    }
}