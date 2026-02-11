<?php

declare(strict_types=1);

namespace App\Services\Simulation;

/**
 * Position-aware commentary builder.
 *
 * Converts structured match events (with ball coordinates and sequence data)
 * into natural-sounding football commentary.  Every line is derived from the
 * spatial data: pitch zone, build-up direction, shot distance, flank, etc.
 *
 * Pitch model:
 *   - X-axis 0–100 (home attacks toward x=100, away toward x=0)
 *   - Y-axis 0–100 (0 = near touchline, 50 = centre, 100 = far touchline)
 *   - Home goal at x≈0, away goal at x≈100
 */
class CommentaryBuilder
{
    // =========================================================================
    //  ZONE HELPERS
    // =========================================================================

    /**
     * Get a human-readable pitch zone name from coordinates.
     */
    private function pitchZone(float $x, float $y, string $team): string
    {
        // Normalize to the attacking direction
        $attackX = $team === 'home' ? $x : (100 - $x);

        // Y zones: left/centre/right from the attacking team's perspective
        $lateral = $this->lateralZone($y);

        if ($attackX >= 83) {
            return "the {$lateral} side of the penalty area";
        }
        if ($attackX >= 70) {
            return "the edge of the box on the {$lateral}";
        }
        if ($attackX >= 55) {
            return "the attacking third on the {$lateral}";
        }
        if ($attackX >= 35) {
            return "the {$lateral} side of midfield";
        }
        if ($attackX >= 17) {
            return "the defensive third on the {$lateral}";
        }
        return "deep inside their own half";
    }

    /**
     * Short zone label for concise references ("the right wing", "the centre", …).
     */
    private function shortZone(float $x, float $y, string $team): string
    {
        $attackX = $team === 'home' ? $x : (100 - $x);
        $lat = $this->lateralZone($y);

        if ($attackX >= 83) return "inside the box";
        if ($attackX >= 70) return "on the edge of the area";
        if ($attackX >= 55) return "in the attacking half";
        if ($attackX >= 35) return "in midfield";
        return "in the defensive half";
    }

    /**
     * Lateral position label. Y < 30 → "left", 30–70 → "centre", > 70 → "right".
     * (Flip for away team since they face the opposite direction.)
     */
    private function lateralZone(float $y): string
    {
        if ($y < 30) return 'left';
        if ($y > 70) return 'right';
        return 'centre';
    }

    /**
     * Describe the flank based on Y coordinate ("the left flank", "the right wing", "centrally").
     */
    private function flankDescription(float $y): string
    {
        if ($y < 25) return 'down the left flank';
        if ($y > 75) return 'down the right flank';
        if ($y < 40) return 'on the left side';
        if ($y > 60) return 'on the right side';
        return 'through the centre';
    }

    /**
     * Is the ball in the penalty area of the defending team?
     */
    private function isInPenaltyArea(float $x, float $y, string $attackingTeam): bool
    {
        $attackX = $attackingTeam === 'home' ? $x : (100 - $x);
        return $attackX >= 83 && $y >= 20 && $y <= 80;
    }

    /**
     * Estimate shot distance from sequence data.
     */
    private function shotDistance(array $sequence, string $team): string
    {
        foreach ($sequence as $step) {
            if (($step['action'] ?? '') === 'shoot') {
                $startX = $step['ball_start']['x'] ?? 50;
                $attackX = $team === 'home' ? $startX : (100 - $startX);
                if ($attackX <= 65) return 'from long range';
                if ($attackX <= 78) return 'from the edge of the box';
                if ($attackX <= 88) return 'from close range';
                return 'from point-blank range';
            }
        }
        return '';
    }

    /**
     * Describe the build-up play from a sequence of actions.
     */
    private function describeBuildUp(array $sequence, string $team): string
    {
        // Only describe build-up for sequences with at least 2 non-shoot steps
        $nonShootSteps = array_filter($sequence, fn($s) => !in_array($s['action'] ?? '', ['shoot', 'save', 'clearance', 'foul']));
        if (count($nonShootSteps) < 2) {
            return '';
        }

        $passCount = 0;
        $dribbleCount = 0;
        $actors = [];
        $firstY = null;
        $lastY = null;
        $totalXDistance = 0;

        foreach ($sequence as $step) {
            $action = $step['action'] ?? '';
            if ($action === 'pass') {
                $passCount++;
                $actors[] = $step['target_name'] ?? $step['actor_name'] ?? '';
            } elseif (in_array($action, ['dribble', 'skill_move'])) {
                $dribbleCount++;
                $actors[] = $step['actor_name'] ?? '';
            }

            $startY = $step['ball_start']['y'] ?? 50;
            $endY = $step['ball_end']['y'] ?? 50;
            $startX = $step['ball_start']['x'] ?? 50;
            $endX = $step['ball_end']['x'] ?? 50;

            if ($firstY === null) $firstY = $startY;
            $lastY = $endY;

            // Track forward progress in attacking direction
            $dx = $team === 'home' ? ($endX - $startX) : ($startX - $endX);
            $totalXDistance += $dx;
        }

        // Filter out empty and duplicate actors, keep unique names
        $actors = array_values(array_unique(array_filter($actors)));
        $totalMoves = $passCount + $dribbleCount;

        if ($totalMoves === 0) return '';

        $parts = [];

        // Describe the type of build-up
        if ($passCount >= 3) {
            $parts[] = "A lovely passing move";
        } elseif ($passCount === 2 && $dribbleCount >= 1) {
            $parts[] = "A quick combination of passes and dribbling";
        } elseif ($dribbleCount >= 2) {
            $parts[] = "A mazy dribbling run";
        } elseif ($passCount === 1 && $dribbleCount === 1) {
            $parts[] = "A neat one-two";
        }

        // Describe the direction of the move (lateral movement)
        if ($firstY !== null && $lastY !== null) {
            $yShift = abs($lastY - $firstY);
            if ($yShift > 30) {
                if ($lastY > $firstY) {
                    $parts[] = "shifting play from left to right";
                } else {
                    $parts[] = "switching the ball from right to left";
                }
            }
        }

        // Name the key actors (only if we already have a descriptor)
        if (!empty($parts)) {
            if (count($actors) >= 2) {
                $last = array_pop($actors);
                $parts[] = "involving " . implode(', ', array_slice($actors, 0, 2)) . " and " . $last;
            } elseif (count($actors) === 1) {
                $parts[] = "by " . $actors[0];
            }
        } elseif (count($actors) >= 2) {
            // No move descriptor but have actors: generate a generic one
            $last = array_pop($actors);
            $parts[] = "Good interplay between " . implode(', ', array_slice($actors, 0, 2)) . " and " . $last;
        }

        if (empty($parts)) return '';

        return implode(', ', $parts) . '.';
    }

    /**
     * Describe the direction a clearance was hit.
     */
    private function clearanceDirection(array $sequence, string $defTeam): string
    {
        foreach ($sequence as $step) {
            if (($step['action'] ?? '') === 'clearance') {
                $startX = $step['ball_start']['x'] ?? 50;
                $endX = $step['ball_end']['x'] ?? 50;
                $endY = $step['ball_end']['y'] ?? 50;
                $dist = abs($endX - $startX);

                $toward = $defTeam === 'home'
                    ? ($endX > $startX ? 'upfield' : 'back toward their own goal')
                    : ($endX < $startX ? 'upfield' : 'back toward their own goal');

                $flank = $this->lateralZone($endY);

                if ($dist > 30) return "a booming clearance {$toward} to the {$flank}";
                if ($dist > 15) return "a solid clearance {$toward}";
                return "a headed clearance to the {$flank}";
            }
        }
        return "a clearance";
    }

    // =========================================================================
    //  COMMENTARY GENERATION — per event type
    // =========================================================================

    /**
     * Build commentary text for a single event.
     */
    public function buildEventCommentary(array $event, MatchState $state): string
    {
        $type = $event['type'] ?? '';
        $team = $event['team'] ?? 'home';
        $player = $event['primary_player_name'] ?? 'A player';
        $player2 = $event['secondary_player_name'] ?? null;
        $outcome = $event['outcome'] ?? '';
        $coords = $event['coordinates'] ?? ['x' => 50.0, 'y' => 50.0];
        $sequence = $event['sequence'] ?? [];
        $teamName = $this->getTeamName($team, $state);
        $oppTeamName = $this->getTeamName($state->opponent($team), $state);
        $x = (float) ($coords['x'] ?? 50);
        $y = (float) ($coords['y'] ?? 50);

        return match ($type) {
            'goal' => $this->commentGoal($player, $player2, $team, $teamName, $sequence, $x, $y, $state),
            'shot_on_target' => $this->commentShotOnTarget($player, $team, $teamName, $sequence, $x, $y, $state),
            'shot_off_target' => $this->commentShotOffTarget($player, $team, $teamName, $sequence, $x, $y),
            'shot_blocked' => $this->commentShotBlocked($player, $player2, $team, $teamName, $sequence, $x, $y),
            'save' => $this->commentSave($event, $team, $state, $sequence, $x, $y),
            'foul' => $this->commentFoul($player, $player2, $team, $teamName, $oppTeamName, $event, $x, $y),
            'free_kick' => $this->commentFreeKick($player, $team, $teamName, $x, $y),
            'corner' => $this->commentCorner($player, $team, $teamName, $x, $y),
            'penalty' => $this->commentPenalty($player, $team, $teamName, $outcome, $state),
            'offside' => $this->commentOffside($player, $team, $teamName, $sequence, $x, $y),
            'tackle' => $this->commentTackle($player, $player2, $team, $teamName, $x, $y),
            'interception' => $this->commentInterception($player, $team, $teamName, $x, $y),
            'clearance' => $this->commentClearance($player, $team, $teamName, $sequence, $x, $y),
            'yellow_card' => $this->commentYellowCard($player, $teamName, $x, $y),
            'red_card' => $this->commentRedCard($player, $team, $teamName, $event, $state),
            'substitution' => $this->commentSubstitution($player, $player2, $teamName),
            'kickoff' => $this->commentKickoff($teamName, $state),
            'half_time' => $this->commentHalfTime($state),
            'full_time' => $this->commentFullTime($state),
            'possession' => $this->commentPossession($player, $teamName, $x, $y, $team),
            default => "{$teamName} have the ball {$this->shortZone($x, $y, $team)}.",
        };
    }

    // -- Goal --

    private function commentGoal(string $player, ?string $assist, string $team, string $teamName, array $seq, float $x, float $y, MatchState $state): string
    {
        $dist = $this->shotDistance($seq, $team);
        $buildUp = $this->describeBuildUp($seq, $team);
        $zone = $this->shortZone($x, $y, $team);

        $lines = [];

        if ($buildUp) {
            $lines[] = $buildUp;
        }

        $shootX = $team === 'home' ? $x : (100 - $x);

        if ($assist) {
            if ($shootX >= 83) {
                $openers = [
                    "GOAL! {$assist} picks out {$player} {$zone} and the finish is clinical!",
                    "GOAL! {$assist} threads the ball to {$player} who makes no mistake {$zone}!",
                    "GOAL! Beautiful pass from {$assist} finds {$player} who slots it home {$zone}!",
                ];
            } else {
                $openers = [
                    "GOAL! {$assist} sets up {$player} who fires {$dist} into the net!",
                    "GOAL! {$player} receives from {$assist} and unleashes a shot {$dist}! What a strike!",
                ];
            }
        } else {
            if ($shootX >= 83) {
                $openers = [
                    "GOAL! {$player} finishes {$zone} with composure! {$teamName} score!",
                    "GOAL! {$player} tucks it away {$zone}! The crowd erupts for {$teamName}!",
                ];
            } elseif ($shootX >= 65) {
                $openers = [
                    "GOAL! {$player} lets fly {$dist} and it crashes into the net! What a hit for {$teamName}!",
                    "GOAL! A stunning strike {$dist} from {$player}! {$teamName} take the lead!",
                ];
            } else {
                $openers = [
                    "GOAL! An absolute thunderbolt from {$player} from way out! {$teamName} can't believe it!",
                ];
            }
        }

        $lines[] = $openers[array_rand($openers)];

        $home = $state->score['home'];
        $away = $state->score['away'];
        $homeName = $state->homeTeam->name ?? 'Home';
        $awayName = $state->awayTeam->name ?? 'Away';
        $lines[] = "{$homeName} {$home} - {$away} {$awayName}.";

        return implode(' ', $lines);
    }

    // -- Shot on target (saved) --

    private function commentShotOnTarget(string $player, string $team, string $teamName, array $seq, float $x, float $y, MatchState $state): string
    {
        $dist = $this->shotDistance($seq, $team);
        $buildUp = $this->describeBuildUp($seq, $team);
        $gkSide = $state->opponent($team);
        $gk = $state->getGoalkeeper($gkSide);
        $gkName = $gk ? ($gk->first_name . ' ' . $gk->last_name) : 'the goalkeeper';

        $templates = [
            "{$player} drives a shot {$dist} toward goal, but {$gkName} is equal to it.",
            "Good effort from {$player} {$dist}! {$gkName} dives to make the save.",
            "{$player} tests {$gkName} with a fierce strike {$dist}. The keeper holds firm.",
        ];
        $line = $templates[array_rand($templates)];

        return $buildUp ? "{$buildUp} {$line}" : $line;
    }

    // -- Shot off target --

    private function commentShotOffTarget(string $player, string $team, string $teamName, array $seq, float $x, float $y): string
    {
        $dist = $this->shotDistance($seq, $team);
        $buildUp = $this->describeBuildUp($seq, $team);
        $flank = $this->flankDescription($y);

        // Check if the missed-shot target is high or wide
        $missY = null;
        foreach ($seq as $step) {
            if (($step['action'] ?? '') === 'shoot') {
                $missY = $step['ball_end']['y'] ?? 50;
                break;
            }
        }

        if ($missY !== null && abs($missY - 50) > 30) {
            $templates = [
                "{$player} shoots {$dist} but drags it well wide of the far post.",
                "{$player} lets fly {$dist} but it drifts harmlessly past the post.",
            ];
        } else {
            $templates = [
                "{$player} fires {$dist} but it sails over the crossbar.",
                "The shot {$dist} from {$player} is high and wide. Goal kick.",
                "{$player} pulls the trigger {$dist} but can't find the target.",
            ];
        }

        $line = $templates[array_rand($templates)];
        return $buildUp ? "{$buildUp} {$line}" : $line;
    }

    // -- Shot blocked --

    private function commentShotBlocked(string $player, ?string $blocker, string $team, string $teamName, array $seq, float $x, float $y): string
    {
        $dist = $this->shotDistance($seq, $team);
        $buildUp = $this->describeBuildUp($seq, $team);

        if ($blocker) {
            $templates = [
                "{$player}'s shot {$dist} is blocked bravely by {$blocker}.",
                "Great defending from {$blocker} to get a vital block on {$player}'s effort {$dist}.",
                "{$player} fires {$dist} but {$blocker} throws himself in the way!",
            ];
        } else {
            $templates = [
                "{$player}'s shot {$dist} takes a deflection and goes behind for a corner.",
                "The shot from {$player} {$dist} is blocked by a wall of defenders.",
            ];
        }

        $line = $templates[array_rand($templates)];
        return $buildUp ? "{$buildUp} {$line}" : $line;
    }

    // -- Save --

    private function commentSave(array $event, string $team, MatchState $state, array $seq, float $x, float $y): string
    {
        // For save events, the primary player IS the GK, secondary is the shooter
        $gkName = $event['primary_player_name'] ?? 'the goalkeeper';
        $shooter = $event['secondary_player_name'] ?? 'the attacker';
        $shooterTeam = $state->opponent($team);
        $dist = $this->shotDistance($seq, $shooterTeam);

        $templates = [
            "Superb save by {$gkName}! {$shooter}'s effort {$dist} is kept out brilliantly.",
            "What a stop from {$gkName}! Denies {$shooter} {$dist} at full stretch.",
            "{$gkName} pulls off a magnificent save to tip {$shooter}'s shot {$dist} around the post.",
        ];

        return $templates[array_rand($templates)];
    }

    // -- Foul --

    private function commentFoul(string $fouler, ?string $fouled, string $team, string $teamName, string $oppTeamName, array $event, float $x, float $y): string
    {
        $zone = $this->pitchZone($x, $y, $team);
        $isDangerous = $event['_dangerous'] ?? false;

        if ($isDangerous) {
            $templates = [
                "{$fouler} brings down {$fouled} in a dangerous position near {$zone}. {$oppTeamName} have a free kick in a threatening area.",
                "Cynical foul from {$fouler} on {$fouled} near {$zone}. Excellent free kick opportunity for {$oppTeamName}.",
            ];
        } else {
            $templates = [
                "{$fouler} clips {$fouled} {$this->shortZone($x, $y, $team)}. Free kick awarded.",
                "A late challenge from {$fouler} on {$fouled} {$this->shortZone($x, $y, $team)}.",
                "{$fouler} commits a foul on {$fouled} on {$zone}.",
            ];
        }

        return $templates[array_rand($templates)];
    }

    // -- Free kick --

    private function commentFreeKick(string $player, string $team, string $teamName, float $x, float $y): string
    {
        $zone = $this->shortZone($x, $y, $team);
        $attackX = $team === 'home' ? $x : (100 - $x);

        if ($attackX >= 70) {
            $templates = [
                "Free kick to {$teamName} in a dangerous position {$zone}. {$player} stands over the ball.",
                "{$player} eyes the goal from this free kick {$zone} for {$teamName}. The wall lines up.",
            ];
        } else {
            $templates = [
                "Free kick to {$teamName} {$zone}. {$player} takes it quickly.",
                "{$player} prepares to deliver the free kick for {$teamName} {$zone}.",
            ];
        }

        return $templates[array_rand($templates)];
    }

    // -- Corner --

    private function commentCorner(string $player, string $team, string $teamName, float $x, float $y): string
    {
        $side = $y < 50 ? 'near' : 'far';
        $templates = [
            "Corner kick to {$teamName} from the {$side} side. {$player} swings it in.",
            "{$player} takes the corner from the {$side} post for {$teamName}. Bodies pile into the box.",
            "Another corner for {$teamName}. {$player} delivers from the {$side} side.",
        ];
        return $templates[array_rand($templates)];
    }

    // -- Penalty --

    private function commentPenalty(string $player, string $team, string $teamName, string $outcome, MatchState $state): string
    {
        if ($outcome === 'goal') {
            $templates = [
                "GOAL! {$player} sends the keeper the wrong way from the spot! {$teamName} score the penalty!",
                "No mistake from {$player}! The penalty is buried into the bottom corner for {$teamName}!",
            ];
        } else {
            $gkSide = $state->opponent($team);
            $gk = $state->getGoalkeeper($gkSide);
            $gkName = $gk ? ($gk->first_name . ' ' . $gk->last_name) : 'the goalkeeper';
            $templates = [
                "Saved! {$gkName} guesses the right way and denies {$player} from the spot!",
                "{$player} hits the penalty but {$gkName} makes a stunning save! Still goalless from the spot.",
            ];
        }
        return $templates[array_rand($templates)];
    }

    // -- Offside --

    private function commentOffside(string $player, string $team, string $teamName, array $seq, float $x, float $y): string
    {
        $zone = $this->shortZone($x, $y, $team);

        // Check the sequence: if the player ran far, it was a clear offside
        $runDist = 0;
        foreach ($seq as $step) {
            if (($step['action'] ?? '') === 'run') {
                $dx = abs(($step['ball_end']['x'] ?? 0) - ($step['ball_start']['x'] ?? 0));
                $runDist = $dx;
            }
        }

        if ($runDist > 8) {
            $templates = [
                "The flag goes up! {$player} was clearly offside {$zone}, caught well beyond the last defender.",
                "Offside! {$player} had strayed too far ahead of the defensive line {$zone}. Good call by the linesman.",
            ];
        } else {
            $templates = [
                "{$player} is flagged offside {$zone}. A tight call by the assistant referee.",
                "The linesman raises the flag. {$player} was just ahead of the last defender {$zone}.",
            ];
        }
        return $templates[array_rand($templates)];
    }

    // -- Tackle --

    private function commentTackle(string $tackler, ?string $attacker, string $team, string $teamName, float $x, float $y): string
    {
        $zone = $this->shortZone($x, $y, $team);
        $attackX = $team === 'home' ? $x : (100 - $x);

        if ($attacker) {
            if ($attackX <= 30) {
                $templates = [
                    "Crucial tackle by {$tackler} to dispossess {$attacker} in a dangerous area! {$teamName} clear the danger.",
                    "{$tackler} slides in {$zone} to rob {$attacker} of the ball. Vital defensive work!",
                ];
            } else {
                $templates = [
                    "{$tackler} wins the ball with a clean tackle on {$attacker} {$zone}.",
                    "Good challenge by {$tackler} on {$attacker} {$zone}. Possession changes.",
                ];
            }
        } else {
            $templates = [
                "Great tackle by {$tackler} {$zone}. Possession recovered for {$teamName}.",
                "{$tackler} reads the play well and wins the ball {$zone}.",
            ];
        }
        return $templates[array_rand($templates)];
    }

    // -- Interception --

    private function commentInterception(string $player, string $team, string $teamName, float $x, float $y): string
    {
        $zone = $this->shortZone($x, $y, $team);
        $templates = [
            "{$player} reads the passing lane and intercepts {$zone}.",
            "Good anticipation from {$player}. The pass is cut out {$zone}.",
            "{$player} steps in to pick off a loose ball {$zone} for {$teamName}.",
        ];
        return $templates[array_rand($templates)];
    }

    // -- Clearance --

    private function commentClearance(string $player, string $team, string $teamName, array $seq, float $x, float $y): string
    {
        $desc = $this->clearanceDirection($seq, $team);
        $attackX = $team === 'home' ? $x : (100 - $x);

        // Capitalize the clearance description for sentence start
        $descUpper = ucfirst($desc);

        if ($attackX <= 20) {
            $templates = [
                "{$player} makes {$desc} under pressure inside the box. The danger is cleared.",
                "Vital clearance from {$player}! {$descUpper} with bodies closing in.",
            ];
        } else {
            $templates = [
                "{$player} makes {$desc}. {$teamName} relieve the pressure.",
                "{$descUpper} from {$player}. {$teamName} can regroup.",
            ];
        }
        return $templates[array_rand($templates)];
    }

    // -- Yellow card --

    private function commentYellowCard(string $player, string $teamName, float $x, float $y): string
    {
        $templates = [
            "Yellow card! The referee books {$player}. He'll need to be careful now.",
            "The referee reaches for his pocket. Yellow card for {$player} of {$teamName}.",
            "A booking for {$player}. That was a reckless challenge.",
        ];
        return $templates[array_rand($templates)];
    }

    // -- Red card --

    private function commentRedCard(string $player, string $team, string $teamName, array $event, MatchState $state): string
    {
        $isSecondYellow = $event['_second_yellow'] ?? false;
        $available = count($state->getAvailablePlayers($team));

        if ($isSecondYellow) {
            return "Second yellow for {$player}! That's a red card! {$teamName} are down to {$available} players!";
        }
        $templates = [
            "Straight red card! {$player} is sent off for a terrible challenge! {$teamName} must continue with {$available} players.",
            "The referee shows a straight red to {$player}! {$teamName} are down to {$available}!",
        ];
        return $templates[array_rand($templates)];
    }

    // -- Substitution --

    private function commentSubstitution(string $playerOn, ?string $playerOff, string $teamName): string
    {
        if ($playerOff) {
            $templates = [
                "Substitution for {$teamName}: {$playerOn} comes on for {$playerOff}.",
                "A change for {$teamName}. {$playerOff} makes way for {$playerOn}.",
                "Tactical change: {$playerOff} is replaced by {$playerOn} for {$teamName}.",
            ];
            return $templates[array_rand($templates)];
        }
        return "Substitution for {$teamName}: {$playerOn} enters the field.";
    }

    // -- Structural events --

    private function commentKickoff(string $teamName, MatchState $state): string
    {
        if ($state->minute <= 1) {
            $templates = [
                "The referee blows the whistle and we're underway! {$teamName} get us started.",
                "Kick-off! The match begins! {$teamName} play the first ball.",
            ];
        } else {
            $templates = [
                "{$teamName} restart after the goal.",
                "We're back underway. {$teamName} kick off.",
            ];
        }
        return $templates[array_rand($templates)];
    }

    private function commentHalfTime(MatchState $state): string
    {
        $home = $state->homeTeam->name ?? 'Home';
        $away = $state->awayTeam->name ?? 'Away';
        $hs = $state->score['home'];
        $as = $state->score['away'];

        if ($hs === $as) {
            return "The referee blows for half-time. It's all square at {$home} {$hs} - {$as} {$away}.";
        }
        $leader = $hs > $as ? $home : $away;
        return "Half-time! {$home} {$hs} - {$as} {$away}. {$leader} lead at the break.";
    }

    private function commentFullTime(MatchState $state): string
    {
        $home = $state->homeTeam->name ?? 'Home';
        $away = $state->awayTeam->name ?? 'Away';
        $hs = $state->score['home'];
        $as = $state->score['away'];

        if ($hs === $as) {
            return "Full-time! The final score is {$home} {$hs} - {$as} {$away}. The spoils are shared.";
        }
        $winner = $hs > $as ? $home : $away;
        return "Full-time! {$home} {$hs} - {$as} {$away}. {$winner} take all three points! What a match!";
    }

    // -- Possession --

    private function commentPossession(string $player, string $teamName, float $x, float $y, string $team): string
    {
        $zone = $this->shortZone($x, $y, $team);
        $flank = $this->flankDescription($y);
        $templates = [
            "{$teamName} work the ball around patiently {$zone}, probing for an opening.",
            "Nice passing sequence from {$teamName} {$flank}.",
            "{$player} orchestrates play for {$teamName} as they build {$flank}.",
            "{$teamName} keep the ball moving {$zone}. Measured build-up play.",
        ];
        return $templates[array_rand($templates)];
    }

    // =========================================================================
    //  PUBLIC API
    // =========================================================================

    /**
     * Build commentary for a quiet minute (no notable events).
     */
    public function buildQuietMinuteCommentary(MatchState $state): string
    {
        $teamName = $this->getTeamName($state->possession, $state);
        $x = (float) ($state->ball['x'] ?? 50);
        $y = (float) ($state->ball['y'] ?? 50);
        $zone = $this->shortZone($x, $y, $state->possession);
        $flank = $this->flankDescription($y);

        $templates = [
            "The ball is played around {$zone}. {$teamName} retain possession.",
            "Patient build-up play from {$teamName} {$flank}.",
            "{$teamName} keep the ball moving {$zone}.",
            "Steady play from {$teamName} as they probe {$flank}.",
            "Nothing doing {$zone}. {$teamName} circulate possession.",
        ];

        return $templates[array_rand($templates)];
    }

    /**
     * Build combined commentary for all events in a minute.
     */
    public function buildMinuteCommentary(array $events, MatchState $state): string
    {
        if (empty($events)) {
            return $state->minute . "' - " . $this->buildQuietMinuteCommentary($state);
        }

        $lines = [];
        foreach ($events as $event) {
            $lines[] = $this->buildEventCommentary($event, $state);
        }

        return $state->minute . "' - " . implode(' ', $lines);
    }

    /**
     * Get the display name for a team side.
     */
    private function getTeamName(string $side, MatchState $state): string
    {
        if ($side === 'home') {
            return $state->homeTeam->name ?? 'Home';
        }
        if ($side === 'away') {
            return $state->awayTeam->name ?? 'Away';
        }
        return 'A team';
    }
}
