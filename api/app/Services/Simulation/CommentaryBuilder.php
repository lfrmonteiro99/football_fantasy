<?php

declare(strict_types=1);

namespace App\Services\Simulation;

/**
 * Converts structured match events into human-readable commentary text.
 *
 * Each event type has multiple template variants, chosen at random for variety.
 * Templates use placeholders: {player}, {player2}, {team}, {gk}, {minute}.
 */
class CommentaryBuilder
{
    /**
     * Template pools indexed by event type.
     * Each entry is an array of template strings.
     *
     * @var array<string, string[]>
     */
    private const TEMPLATES = [
        'goal' => [
            "GOAL! {player} finds the back of the net! {team} score!",
            "It's a goal! {player} finishes brilliantly! What a strike for {team}!",
            "He's done it! {player} scores for {team}! The crowd erupts!",
            "{player} puts it away with composure! {team} take the lead!",
            "GOAL! A clinical finish from {player}! {team} are jubilant!",
        ],
        'goal_with_assist' => [
            "GOAL! {player2} picks out {player} who slots it home for {team}!",
            "Brilliant play! {player2} sets up {player} who makes no mistake! {team} score!",
            "What a combination! {player2} threads the pass and {player} converts for {team}!",
            "{player2} with the assist, {player} with the finish! {team} celebrate!",
            "Team goal! {player2} finds {player} in space and the finish is emphatic for {team}!",
        ],
        'goal_header' => [
            "GOAL! {player} rises highest and heads it in for {team}!",
            "A towering header from {player}! {team} score from the set piece!",
            "{player} meets it perfectly with his head! The ball flies into the net for {team}!",
        ],
        'goal_penalty' => [
            "GOAL! {player} converts the penalty! Cool as you like for {team}!",
            "{player} sends the keeper the wrong way from the spot! {team} score the penalty!",
            "No mistake from {player}! The penalty is buried into the bottom corner for {team}!",
        ],
        'penalty_miss' => [
            "Saved! The goalkeeper denies {player} from the penalty spot!",
            "{player} hits the penalty, but {gk} makes a stunning save!",
            "The penalty is saved! {gk} guesses the right way and keeps it out!",
        ],
        'shot_on_target' => [
            "{player} drives a shot on target, but {gk} is equal to it.",
            "Good effort from {player}! {gk} makes the save.",
            "{player} tests the goalkeeper with a fierce strike. {gk} holds firm.",
            "A powerful attempt from {player} forces a save from {gk}.",
            "{player} lets fly, and {gk} pushes it away.",
        ],
        'shot_off_target' => [
            "{player} fires wide of the target.",
            "{player} shoots but it flies over the crossbar.",
            "The shot from {player} drifts just wide of the post.",
            "{player} pulls the trigger but it goes harmlessly past the post.",
            "Not the best effort from {player}. That one sails well wide.",
        ],
        'shot_blocked' => [
            "{player}'s shot is blocked by a defender.",
            "Good defending! The shot from {player} is blocked.",
            "{player2} gets a vital block on {player}'s shot.",
            "The shot from {player} takes a deflection and goes behind for a corner.",
        ],
        'save' => [
            "Superb save by {gk}! {player}'s effort is kept out.",
            "What a stop from {gk}! Denies {player} at full stretch.",
            "{gk} pulls off a magnificent save to deny {player}!",
            "Brilliant reflexes from {gk} to tip {player}'s shot around the post.",
        ],
        'corner' => [
            "Corner kick to {team}. {player} takes it.",
            "{player} swings in the corner for {team}.",
            "Another corner for {team}. {player} stands over the ball.",
        ],
        'free_kick' => [
            "Free kick awarded to {team} in a dangerous position. {player} stands over it.",
            "{player} lines up the free kick for {team}.",
            "A set-piece opportunity for {team}. {player} prepares to deliver.",
        ],
        'free_kick_shot' => [
            "{player} curls the free kick towards goal!",
            "{player} hits the free kick with pace and dip!",
            "{player} goes direct from the free kick!",
        ],
        'penalty_awarded' => [
            "PENALTY! The referee points to the spot after the foul on {player}!",
            "It's a penalty to {team}! {player} was brought down in the box!",
            "The referee has no hesitation! Penalty to {team} after {player} is fouled!",
        ],
        'foul' => [
            "{player} commits a foul on {player2}.",
            "Free kick. {player} brings down {player2}.",
            "{player} clips {player2}. The referee blows for a free kick.",
            "A late challenge from {player} on {player2}. Free kick awarded.",
        ],
        'foul_dangerous' => [
            "{player} brings down {player2} in a dangerous position. Free kick to {team} in a great area.",
            "Cynical foul from {player} on {player2}. {team} have a free kick in a threatening position.",
        ],
        'yellow_card' => [
            "Yellow card! The referee books {player} for that challenge.",
            "{player} is shown a yellow card. He'll need to be careful now.",
            "The referee reaches for his pocket. Yellow card for {player}.",
            "A booking for {player}. That was a reckless challenge.",
        ],
        'second_yellow' => [
            "Second yellow for {player}! That's a red card! He's been sent off!",
            "{player} picks up another booking and is shown a red card! {team} are down to {count} men!",
        ],
        'red_card' => [
            "Straight red card! {player} is sent off for a terrible challenge!",
            "The referee shows a straight red to {player}! {team} must continue with {count} players!",
            "{player} sees red for a dangerous tackle! {team} are down a man!",
        ],
        'offside' => [
            "{player} is flagged offside.",
            "The linesman raises the flag. {player} was in an offside position.",
            "Offside! {player} was just ahead of the last defender.",
        ],
        'tackle' => [
            "Excellent tackle by {player}! Possession changes.",
            "{player} wins the ball with a crunching tackle on {player2}.",
            "Great defensive work from {player}. Clean tackle to win the ball.",
        ],
        'interception' => [
            "{player} reads the play well and intercepts the pass.",
            "Good anticipation from {player}. The pass is cut out.",
            "{player} steps in and picks off the loose ball.",
        ],
        'clearance' => [
            "{player} heads the ball clear.",
            "Solid clearance from {player}. The danger is averted.",
            "{player} gets a strong head on the ball and clears the lines.",
        ],
        'cross' => [
            "{player} delivers a cross into the box.",
            "A dangerous cross from {player} into the area.",
            "{player} whips in a cross from the flank.",
        ],
        'dribble' => [
            "{player} beats his marker with a clever piece of skill.",
            "Wonderful dribbling from {player}! He glides past the defender.",
            "{player} shows quick feet to get past {player2}.",
        ],
        'pass' => [
            "{player} plays a neat pass forward.",
            "Good distribution from {player}.",
            "{player} finds {player2} with a precise pass.",
        ],
        'through_ball' => [
            "Brilliant through ball from {player}! {player2} is through on goal!",
            "{player} threads an exquisite pass to {player2}!",
            "What vision from {player}! The pass splits the defence for {player2}!",
        ],
        'throw_in' => [
            "Throw-in for {team}.",
            "{player} takes the throw-in for {team}.",
        ],
        'goal_kick' => [
            "Goal kick for {team}. {gk} takes it.",
            "{gk} restarts play with a goal kick.",
        ],
        'substitution' => [
            "Substitution for {team}: {player} comes on for {player2}.",
            "A change for {team}. {player2} makes way for {player}.",
            "Tactical change: {player2} is replaced by {player} for {team}.",
        ],
        'kickoff' => [
            "The referee blows the whistle and we're underway!",
            "Kick-off! The match begins!",
            "And we're off! {team} get us started.",
        ],
        'half_time' => [
            "The referee blows for half-time. The score is {home_team} {home_score} - {away_score} {away_team}.",
            "Half-time! {home_team} {home_score} - {away_score} {away_team}.",
        ],
        'full_time' => [
            "Full-time! The final score is {home_team} {home_score} - {away_score} {away_team}.",
            "It's all over! {home_team} {home_score} - {away_score} {away_team}. What a match!",
            "The referee blows the final whistle. {home_team} {home_score} - {away_score} {away_team}.",
        ],
        'quiet' => [
            "The ball is played around in midfield. {team} retain possession.",
            "Patient build-up play from {team}.",
            "{team} keep the ball moving in midfield.",
            "Steady play from {team} as they look for an opening.",
            "Nothing doing in this passage of play. {team} hold possession.",
        ],
    ];

    /**
     * Build commentary text for a single event.
     *
     * @param array $event  Structured event array
     * @param MatchState $state  Current match state (for team names, score, etc.)
     * @return string  Human-readable commentary line
     */
    public function buildEventCommentary(array $event, MatchState $state): string
    {
        $type = $event['type'];
        $teamName = $this->getTeamName($event['team'] ?? '', $state);

        $replacements = [
            '{player}' => $event['primary_player_name'] ?? 'A player',
            '{player2}' => $event['secondary_player_name'] ?? 'a teammate',
            '{team}' => $teamName,
            '{gk}' => '', // filled below if relevant
            '{minute}' => (string) $state->minute,
            '{home_team}' => $state->homeTeam->name ?? 'Home',
            '{away_team}' => $state->awayTeam->name ?? 'Away',
            '{home_score}' => (string) $state->score['home'],
            '{away_score}' => (string) $state->score['away'],
            '{count}' => '', // filled for red cards
        ];

        // Determine template key
        $templateKey = $this->resolveTemplateKey($event, $state);

        // Fill GK name for saves, shots on target, penalties, and goal kicks
        if (in_array($type, ['save', 'shot_on_target', 'penalty_miss', 'goal_kick'])) {
            if ($type === 'save') {
                // For saves, the primary player IS the goalkeeper who made the save
                $replacements['{gk}'] = $event['primary_player_name'] ?? 'the goalkeeper';
                // The shooter is the secondary player
                $replacements['{player}'] = $event['secondary_player_name'] ?? 'the attacker';
            } elseif ($type === 'goal_kick') {
                // For goal kicks, the primary player is the GK taking the kick
                $replacements['{gk}'] = $event['primary_player_name'] ?? 'the goalkeeper';
            } else {
                // For shots on target and penalty misses, get the opposing GK
                $opposingSide = $state->opponent($event['team'] ?? 'home');
                $gk = $state->getGoalkeeper($opposingSide);
                $replacements['{gk}'] = $gk
                    ? ($gk->first_name . ' ' . $gk->last_name)
                    : 'the goalkeeper';
            }
        }

        // Fill player count for red cards
        if (in_array($type, ['red_card', 'second_yellow'])) {
            $side = $event['team'] ?? 'home';
            $available = count($state->getAvailablePlayers($side));
            $replacements['{count}'] = (string) $available;
        }

        $templates = self::TEMPLATES[$templateKey] ?? self::TEMPLATES['quiet'];
        $template = $templates[array_rand($templates)];

        return str_replace(
            array_keys($replacements),
            array_values($replacements),
            $template
        );
    }

    /**
     * Build commentary for a quiet minute (no notable events).
     */
    public function buildQuietMinuteCommentary(MatchState $state): string
    {
        $teamName = $this->getTeamName($state->possession, $state);
        $templates = self::TEMPLATES['quiet'];
        $template = $templates[array_rand($templates)];

        return str_replace('{team}', $teamName, $template);
    }

    /**
     * Build combined commentary for all events in a minute.
     *
     * @param array $events  Array of event structs
     * @param MatchState $state  Current match state
     * @return string  Full commentary paragraph for this minute
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
     * Resolve the best template key for an event, using context for variants.
     */
    private function resolveTemplateKey(array $event, MatchState $state): string
    {
        $type = $event['type'];
        $outcome = $event['outcome'] ?? '';

        return match (true) {
            // Goal variants
            $type === 'goal' && $outcome === 'goal' && !empty($event['secondary_player_id'])
                => 'goal_with_assist',
            $type === 'goal' && $outcome === 'goal'
                => 'goal',
            $type === 'header' && $outcome === 'goal'
                => 'goal_header',
            $type === 'penalty' && $outcome === 'goal'
                => 'goal_penalty',
            $type === 'penalty' && $outcome === 'saved'
                => 'penalty_miss',

            // Shot variants
            $type === 'shot_on_target' && $outcome === 'saved'
                => 'shot_on_target',
            $type === 'shot_on_target'
                => 'shot_on_target',
            $type === 'shot_off_target'
                => 'shot_off_target',
            $type === 'shot_on_target' && $outcome === 'blocked'
                => 'shot_blocked',

            // Card variants
            $type === 'yellow_card'
                => 'yellow_card',
            $type === 'red_card' && ($event['_second_yellow'] ?? false)
                => 'second_yellow',
            $type === 'red_card'
                => 'red_card',

            // Foul in dangerous position
            $type === 'foul' && ($event['_dangerous'] ?? false)
                => 'foul_dangerous',

            // Default: use the event type directly as template key
            isset(self::TEMPLATES[$type]) => $type,

            default => 'quiet',
        };
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
