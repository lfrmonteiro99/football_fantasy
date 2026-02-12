<?php

declare(strict_types=1);

namespace App\Services\Simulation;

/**
 * Context-aware match commentary builder.
 *
 * Converts structured match events into rich, varied human-readable commentary.
 * Uses match context (score, minute, momentum, player history) to select
 * appropriate templates and modifiers for each event.
 */
class CommentaryBuilder
{
    // =========================================================================
    //  GOAL TEMPLATES — Context-specific pools
    // =========================================================================

    /**
     * Goal templates organized by score context.
     * Each key maps to an array of templates with {player}, {player2}, {team} placeholders.
     */
    private const GOAL_TEMPLATES = [
        'opener' => [
            "GOAL! {player} breaks the deadlock for {team}!",
            "The first goal of the match! {player} opens the scoring for {team}!",
            "{player} gets the opener! {team} strike first!",
            "It's {team} who draw first blood! {player} with the finish!",
            "The breakthrough! {player} puts {team} ahead!",
        ],
        'opener_with_assist' => [
            "GOAL! {player2} sets up {player} to open the scoring for {team}!",
            "The deadlock is broken! {player2} picks out {player} who finishes coolly. {team} lead!",
            "{player2} threads it through and {player} does the rest! The first goal goes to {team}!",
            "Brilliant combination! {player2} to {player}, and {team} have the lead!",
        ],
        'equalizer' => [
            "GOAL! {player} levels it for {team}! We're all square!",
            "They've equalized! {player} draws {team} level!",
            "{player} pulls {team} back into it! The scores are level!",
            "Parity restored! {player} makes it all square for {team}!",
            "Back on terms! {player} gets the equalizer for {team}!",
        ],
        'equalizer_with_assist' => [
            "GOAL! {player2} finds {player} and {team} are level! What a response!",
            "The equalizer! {player2} sets up {player} and we're all square again!",
            "{player2} with the assist, {player} with the finish! {team} have their equalizer!",
            "They're back in it! {player2} picks out {player} who restores parity for {team}!",
        ],
        'go_ahead' => [
            "GOAL! {player} puts {team} in front!",
            "{player} gives {team} the lead! What a moment!",
            "They've taken the lead! {player} fires {team} ahead!",
            "{player} strikes and {team} are back in the driving seat!",
            "The go-ahead goal! {player} puts {team} into the lead!",
        ],
        'go_ahead_with_assist' => [
            "GOAL! {player2} tees up {player} and {team} are ahead!",
            "{player2} with a superb ball to {player} who restores {team}'s lead!",
            "What a pass from {player2}! {player} makes no mistake and {team} lead again!",
            "{player2} picks out {player}, and {team} edge back in front!",
        ],
        'extending' => [
            "GOAL! {player} extends the lead for {team}! This is commanding!",
            "{player} adds another! {team} are running away with this!",
            "Ruthless from {team}! {player} makes it {score}!",
            "It's getting comfortable for {team}. {player} scores again!",
            "{player} piles on the misery! {team} extend their advantage!",
        ],
        'extending_with_assist' => [
            "GOAL! {player2} finds {player} and {team} pull further ahead! It's {score}!",
            "Another one! {player2} to {player} and this is becoming a rout for {team}!",
            "{player2} lays it on a plate for {player}! {team} are dominant. It's {score}!",
        ],
        'consolation' => [
            "{player} pulls one back for {team}. A consolation, perhaps.",
            "GOAL! {player} gets one for {team}, but is it too little too late?",
            "{player} scores for {team}. They won't stop fighting.",
            "A lifeline? {player} reduces the deficit for {team}!",
        ],
        'consolation_with_assist' => [
            "{player2} sets up {player} who pulls one back for {team}. Can they mount a comeback?",
            "GOAL! {player2} to {player} and {team} reduce the arrears!",
        ],
    ];

    /**
     * Time-context modifiers that get PREPENDED or APPENDED to goal commentary.
     */
    private const GOAL_TIME_MODIFIERS = [
        'early' => [
            'prefix' => ["What a start! ", "An early blow! ", "Inside the first ten minutes! "],
            'suffix' => [" What a way to start the match!", " An early breakthrough!"],
        ],
        'late' => [
            'prefix' => ["Drama in the closing stages! ", "Late, late drama! ", ""],
            'suffix' => [" A crucial late goal!", " The timing could not be more dramatic!"],
        ],
        'stoppage' => [
            'prefix' => ["Deep into stoppage time! ", "Incredible scenes! ", "In the dying moments! "],
            'suffix' => [" Stoppage time heroics!", " Right at the death!"],
        ],
    ];

    // =========================================================================
    //  HEADER GOAL TEMPLATES
    // =========================================================================

    private const GOAL_HEADER_TEMPLATES = [
        "GOAL! {player} rises highest and heads it in for {team}!",
        "A towering header from {player}! {team} score from the set piece!",
        "{player} meets it perfectly with his head! The ball flies into the net for {team}!",
        "What a header from {player}! He timed that leap to perfection for {team}!",
        "{player} hangs in the air and powers the header home! {team} celebrate!",
        "Unstoppable header! {player} bullies the defenders and nods it in for {team}!",
    ];

    private const HEADER_OFF_TARGET_TEMPLATES = [
        "{player} heads it wide from the set piece. Close, but no cigar.",
        "The header from {player} drifts just over the crossbar.",
        "{player} gets his head on it but can't direct it on target.",
        "{player} rises well but the header goes just wide of the post.",
        "Off target! {player}'s header misses by inches.",
    ];

    private const GOAL_PENALTY_TEMPLATES = [
        "GOAL! {player} converts the penalty! Cool as you like for {team}!",
        "{player} sends the keeper the wrong way from the spot! {team} score the penalty!",
        "No mistake from {player}! The penalty is buried into the bottom corner for {team}!",
        "{player} steps up... and drills it home! {team} score from the spot!",
        "Confident from {player}! He picks his corner and the penalty is converted for {team}!",
    ];

    // =========================================================================
    //  SHOT TEMPLATES — Expanded pools
    // =========================================================================

    private const SHOT_ON_TARGET_TEMPLATES = [
        "{player} drives a shot on target, but {gk} is equal to it.",
        "Good effort from {player}! {gk} makes the save.",
        "{player} tests the goalkeeper with a fierce strike. {gk} holds firm.",
        "A powerful attempt from {player} forces a save from {gk}.",
        "{player} lets fly, and {gk} pushes it away.",
        "{player} gets a shot away from distance. {gk} gathers comfortably.",
        "Stinging shot from {player}! {gk} does well to parry it.",
        "{player} strikes it cleanly but {gk} is up to the task.",
        "A well-struck effort from {player}, but {gk} reads it all the way.",
        "Close! {player} forces {gk} into a smart save low to his right.",
        "{player} hits it first time! {gk} gets down well to save.",
        "{player} works some space and fires at goal. Good save from {gk}.",
    ];

    private const SHOT_OFF_TARGET_TEMPLATES = [
        "{player} fires wide of the target.",
        "{player} shoots but it flies over the crossbar.",
        "The shot from {player} drifts just wide of the post.",
        "{player} pulls the trigger but it goes harmlessly past the post.",
        "Not the best effort from {player}. That one sails well wide.",
        "{player} snatches at the chance and skews it wide.",
        "Wayward from {player}. He'll be disappointed with that.",
        "{player} drags his shot across the face of goal. Wide.",
        "Over the bar from {player}! He got under that one.",
        "{player} blazes over from a promising position. Wasteful.",
        "Sliced wide by {player}. That should have been better.",
        "A wild swing from {player} and it ends up in row Z.",
        "{player} tries his luck from range but it drifts harmlessly wide.",
    ];

    private const SHOT_BLOCKED_TEMPLATES = [
        "{player}'s shot is blocked by a defender.",
        "Good defending! The shot from {player} is blocked.",
        "{player2} gets a vital block on {player}'s shot.",
        "The shot from {player} takes a deflection and goes behind for a corner.",
        "{player} hits it hard but {player2} throws himself in front of the ball!",
        "Blocked! {player2} puts his body on the line to deny {player}.",
        "The shot from {player} is charged down. Brave defending.",
        "{player} fires goalward but {player2} is there to deflect it.",
    ];

    // =========================================================================
    //  SAVE TEMPLATES — Expanded with context
    // =========================================================================

    private const SAVE_TEMPLATES = [
        'default' => [
            "Superb save by {gk}! {player}'s effort is kept out.",
            "What a stop from {gk}! Denies {player} at full stretch.",
            "{gk} pulls off a magnificent save to deny {player}!",
            "Brilliant reflexes from {gk} to tip {player}'s shot around the post.",
            "Outstanding from {gk}! {player} was sure he'd scored there.",
            "{gk} gets across quickly and makes a wonderful save from {player}.",
            "Fingertip save from {gk}! {player}'s effort was heading for the top corner.",
            "What a reaction save from {gk}! {player} can't believe it's been kept out.",
        ],
        'repeated' => [
            "Another save from {gk}! He's keeping his side in this match!",
            "{gk} again! He's been outstanding today. {player} denied once more.",
            "How many times can {gk} deny them?! Another fantastic save from {player}'s effort!",
            "{gk} is having the game of his life! {player}'s shot is pushed away yet again.",
        ],
    ];

    private const SAVE_CLAIMED_TEMPLATES = [
        "{gk} comes out to claim the ball confidently.",
        "{gk} gathers the cross comfortably. No danger.",
        "Claimed by {gk}. He made that look easy.",
        "{gk} plucks the ball out of the air. Good handling.",
        "Safe hands from {gk}. He claims the delivery.",
    ];

    // =========================================================================
    //  PENALTY MISS TEMPLATES
    // =========================================================================

    private const PENALTY_MISS_TEMPLATES = [
        "Saved! The goalkeeper denies {player} from the penalty spot!",
        "{player} hits the penalty, but {gk} makes a stunning save!",
        "The penalty is saved! {gk} guesses the right way and keeps it out!",
        "No goal! {gk} dives to his left and keeps the penalty out! What a save!",
        "{player} goes for power but {gk} stands tall and saves the penalty!",
    ];

    private const PENALTY_AWARDED_TEMPLATES = [
        "PENALTY! The referee points to the spot after the foul on {player}!",
        "It's a penalty to {team}! {player} was brought down in the box!",
        "The referee has no hesitation! Penalty to {team} after {player} is fouled!",
        "He's given it! Penalty to {team}! {player} was clipped inside the area!",
    ];

    // =========================================================================
    //  SET PIECE TEMPLATES
    // =========================================================================

    private const CORNER_TEMPLATES = [
        "Corner kick to {team}. {player} takes it.",
        "{player} swings in the corner for {team}.",
        "Another corner for {team}. {player} stands over the ball.",
        "{player} whips in the corner from the right for {team}.",
        "{player} delivers from the left for {team}. Bodies in the box.",
        "Corner for {team}. {player} takes a short one.",
    ];

    private const FREE_KICK_TEMPLATES = [
        "Free kick awarded to {team} in a dangerous position. {player} stands over it.",
        "{player} lines up the free kick for {team}.",
        "A set-piece opportunity for {team}. {player} prepares to deliver.",
        "{team} have a free kick in a promising area. {player} looks to deliver.",
        "Free kick to {team} about 25 yards out. {player} fancies this.",
    ];

    private const FREE_KICK_SHOT_TEMPLATES = [
        "{player} curls the free kick towards goal!",
        "{player} hits the free kick with pace and dip!",
        "{player} goes direct from the free kick!",
        "{player} bends it over the wall!",
        "{player} goes for the near post from the free kick!",
    ];

    // =========================================================================
    //  FOUL TEMPLATES — Expanded
    // =========================================================================

    private const FOUL_TEMPLATES = [
        "{player} commits a foul on {player2}.",
        "Free kick. {player} brings down {player2}.",
        "{player} clips {player2}. The referee blows for a free kick.",
        "A late challenge from {player} on {player2}. Free kick awarded.",
        "{player} catches {player2} with a clumsy challenge.",
        "{player} goes through the back of {player2}. The whistle goes.",
        "Foul by {player}. He caught {player2} on the ankle.",
        "{player} mistimes the tackle on {player2}. Free kick.",
    ];

    private const FOUL_DANGEROUS_TEMPLATES = [
        "{player} brings down {player2} in a dangerous position. Free kick to {opp_team} in a great area.",
        "Cynical foul from {player} on {player2}. {opp_team} have a free kick in a threatening position.",
        "{player} stops {player2} in his tracks, right on the edge of the area. Dangerous free kick for {opp_team}.",
        "Professional foul from {player} on {player2}! {opp_team} will fancy this free kick.",
    ];

    // =========================================================================
    //  CARD TEMPLATES — Expanded
    // =========================================================================

    private const YELLOW_CARD_TEMPLATES = [
        "Yellow card! The referee books {player} for that challenge.",
        "{player} is shown a yellow card. He'll need to be careful now.",
        "The referee reaches for his pocket. Yellow card for {player}.",
        "A booking for {player}. That was a reckless challenge.",
        "{player} goes into the book. He can't afford another one of those.",
        "Caution for {player}. The referee had no choice there.",
        "{player} picks up a yellow card. He was lucky that wasn't worse.",
    ];

    private const SECOND_YELLOW_TEMPLATES = [
        "Second yellow for {player}! That's a red card! He's been sent off!",
        "{player} picks up another booking and is shown a red card! {team} are down to {count} men!",
        "Off he goes! {player} sees a second yellow and has to walk! {team} down to {count}!",
    ];

    private const RED_CARD_TEMPLATES = [
        "Straight red card! {player} is sent off for a terrible challenge!",
        "The referee shows a straight red to {player}! {team} must continue with {count} players!",
        "{player} sees red for a dangerous tackle! {team} are down a man!",
        "A straight red card for {player}! That was a horror challenge! {team} reduced to {count}.",
    ];

    // =========================================================================
    //  DEFENSIVE & PLAY-BUILDING TEMPLATES — Expanded
    // =========================================================================

    private const OFFSIDE_TEMPLATES = [
        "{player} is flagged offside.",
        "The linesman raises the flag. {player} was in an offside position.",
        "Offside! {player} was just ahead of the last defender.",
        "The flag goes up against {player}. Tight call.",
        "{player} timed his run a fraction too early. Offside.",
    ];

    private const TACKLE_TEMPLATES = [
        "Excellent tackle by {player}! Possession changes.",
        "{player} wins the ball with a crunching tackle on {player2}.",
        "Great defensive work from {player}. Clean tackle to win the ball.",
        "{player} slides in and takes the ball cleanly from {player2}.",
        "Strong challenge from {player}! He wins the ball fairly.",
        "{player} puts in a perfectly timed tackle on {player2}. Textbook defending.",
    ];

    private const INTERCEPTION_TEMPLATES = [
        "{player} reads the play well and intercepts the pass.",
        "Good anticipation from {player}. The pass is cut out.",
        "{player} steps in and picks off the loose ball.",
        "Alert defending from {player}! He saw that pass coming a mile away.",
        "{player} intercepts and starts a counter for {team}.",
    ];

    private const CLEARANCE_TEMPLATES = [
        "{player} heads the ball clear.",
        "Solid clearance from {player}. The danger is averted.",
        "{player} gets a strong head on the ball and clears the lines.",
        "{player} hacks it away. Safety first.",
        "Thumping clearance from {player}. No nonsense defending.",
    ];

    private const CROSS_TEMPLATES = [
        "{player} delivers a cross into the box.",
        "A dangerous cross from {player} into the area.",
        "{player} whips in a cross from the flank.",
        "{player} swings in a deep cross towards the back post.",
        "{player} clips a lovely ball into the danger zone.",
        "In it comes from {player}! A teasing cross into the six-yard box.",
    ];

    private const POSSESSION_TEMPLATES = [
        "{team} work the ball forward through the middle.",
        "{team} build patiently from the back.",
        "Good passing from {team} as they advance up the pitch.",
        "{team} move the ball nicely through the lines.",
        "Possession football from {team}. They're in no rush.",
    ];

    private const DRIBBLE_TEMPLATES = [
        "{player} beats his marker with a clever piece of skill.",
        "Wonderful dribbling from {player}! He glides past the defender.",
        "{player} shows quick feet to get past {player2}.",
        "Silky skills from {player}! He leaves {player2} for dead.",
        "{player} drops a shoulder and skins {player2}. Brilliant footwork.",
        "{player} jinks inside and creates space for himself.",
    ];

    private const PASS_TEMPLATES = [
        "{player} plays a neat pass forward.",
        "Good distribution from {player}.",
        "{player} finds {player2} with a precise pass.",
        "{player} picks out {player2} with a clever ball.",
        "Lovely weight of pass from {player} to find {player2} in space.",
        "Tidy from {player}. He moves it on to {player2}.",
    ];

    private const THROUGH_BALL_TEMPLATES = [
        "Brilliant through ball from {player}! {player2} is through on goal!",
        "{player} threads an exquisite pass to {player2}!",
        "What vision from {player}! The pass splits the defence for {player2}!",
        "{player} plays {player2} in behind! That's a superb ball!",
        "Inch-perfect from {player}! {player2} is one-on-one!",
    ];

    // =========================================================================
    //  RESTART TEMPLATES
    // =========================================================================

    private const THROW_IN_TEMPLATES = [
        "Throw-in for {team}.",
        "{player} takes the throw-in for {team}.",
        "{team} have a throw-in in the opposition half.",
    ];

    private const GOAL_KICK_TEMPLATES = [
        "Goal kick for {team}. {gk} takes it.",
        "{gk} restarts play with a goal kick.",
        "Goal kick. {gk} takes a moment before sending it long.",
    ];

    private const SUBSTITUTION_TEMPLATES = [
        "Substitution for {team}: {player} comes on for {player2}.",
        "A change for {team}. {player2} makes way for {player}.",
        "Tactical change: {player2} is replaced by {player} for {team}.",
        "Fresh legs for {team}. {player} replaces {player2}.",
        "{player2} has run himself into the ground for {team}. {player} comes on.",
    ];

    // =========================================================================
    //  STRUCTURAL TEMPLATES — Expanded with context
    // =========================================================================

    private const KICKOFF_TEMPLATES = [
        "The referee blows the whistle and we're underway!",
        "Kick-off! The match begins!",
        "And we're off! {team} get us started.",
    ];

    private const SECOND_HALF_KICKOFF_TEMPLATES = [
        "The second half is underway!",
        "We're back! The teams are out for the second half.",
        "{team} kick off the second half. Can they turn things around?",
    ];

    private const HALF_TIME_TEMPLATES = [
        'level' => [
            "The referee blows for half-time. Nothing separates the sides. {home_team} {home_score} - {away_score} {away_team}.",
            "Half-time! All square at {home_score} apiece between {home_team} and {away_team}.",
            "The half-time whistle goes. Honors even so far. {home_team} {home_score} - {away_score} {away_team}.",
        ],
        'close' => [
            "Half-time. {home_team} {home_score} - {away_score} {away_team}. All to play for in the second half.",
            "The referee blows for half-time. A tight first half. {home_team} {home_score} - {away_score} {away_team}.",
            "Half-time! It's {home_team} {home_score} - {away_score} {away_team}. A closely contested opening 45 minutes.",
        ],
        'dominant' => [
            "Half-time! {home_team} {home_score} - {away_score} {away_team}. A dominant first half from {leading_team}.",
            "The whistle goes for the break. {leading_team} well in control. {home_team} {home_score} - {away_score} {away_team}.",
            "Half-time. {home_team} {home_score} - {away_score} {away_team}. {leading_team} have been impressive.",
        ],
        'goalless' => [
            "Half-time. Goalless so far between {home_team} and {away_team}.",
            "The referee blows for half-time. {home_team} 0 - 0 {away_team}. Both defences on top.",
            "Half-time and it remains 0-0. {home_team} and {away_team} have cancelled each other out.",
        ],
    ];

    private const FULL_TIME_TEMPLATES = [
        'home_win' => [
            "Full-time! {home_team} {home_score} - {away_score} {away_team}. A well-deserved victory for {home_team}.",
            "It's all over! {home_team} take all three points. {home_team} {home_score} - {away_score} {away_team}.",
            "The final whistle blows! {home_team} {home_score} - {away_score} {away_team}. {home_team} celebrate a fine win.",
        ],
        'away_win' => [
            "Full-time! {home_team} {home_score} - {away_score} {away_team}. An impressive away victory for {away_team}.",
            "It's all over! {away_team} claim all three points on the road. {home_team} {home_score} - {away_score} {away_team}.",
            "The final whistle goes! {away_team} leave with the win. {home_team} {home_score} - {away_score} {away_team}.",
        ],
        'draw' => [
            "Full-time! {home_team} {home_score} - {away_score} {away_team}. The spoils are shared.",
            "It ends level! {home_team} {home_score} - {away_score} {away_team}. A fair result on the balance of play.",
            "The final whistle blows! {home_team} {home_score} - {away_score} {away_team}. A point apiece.",
        ],
        'goalless_draw' => [
            "Full-time! {home_team} 0 - 0 {away_team}. A goalless stalemate.",
            "It ends goalless. {home_team} 0 - 0 {away_team}. Neither side could find a breakthrough.",
            "The final whistle blows on a 0-0 draw between {home_team} and {away_team}.",
        ],
        'high_scoring' => [
            "Full-time! {home_team} {home_score} - {away_score} {away_team}. What an incredible match that was!",
            "It's all over! {home_team} {home_score} - {away_score} {away_team}. A breathtaking encounter!",
            "The final whistle goes on a thriller! {home_team} {home_score} - {away_score} {away_team}. What entertainment!",
        ],
    ];

    // =========================================================================
    //  QUIET MINUTE TEMPLATES — Massively expanded, context-aware
    // =========================================================================

    private const QUIET_TEMPLATES = [
        // Zone: midfield, score: level
        'mid_level' => [
            "The ball is played around in midfield. {team} retain possession.",
            "Patient build-up play from {team}.",
            "{team} keep the ball moving, probing for an opening.",
            "Steady play from {team} as they look to create something.",
            "Neat passing from {team} in the middle of the park.",
            "{team} recycle possession in midfield. Neither side giving much away.",
            "It's a chess match in midfield. {team} looking for the key.",
            "Compact from both sides. {team} have the ball but can't find a way through.",
        ],
        // Zone: midfield, team is winning
        'mid_winning' => [
            "{team} are comfortable on the ball. They're controlling the tempo.",
            "Confident possession from {team}. They're in charge here.",
            "{team} are happy to slow things down and keep the ball.",
            "Easy does it from {team}. They're managing this match well.",
            "{team} keep it ticking over. No need to rush when you're ahead.",
            "Professional from {team}. They're seeing this out calmly.",
        ],
        // Zone: midfield, team is losing
        'mid_losing' => [
            "{team} work the ball in midfield, searching for a way back into this.",
            "{team} need something special here. Patient build-up so far.",
            "Time is ticking for {team}. They have the ball but lack urgency.",
            "{team} probe but the opposition defence is holding firm.",
            "{team} are trying to play their way back into this match.",
            "Frustration building for {team}. They can't find the final ball.",
        ],
        // Zone: defensive third
        'def' => [
            "{team} pass it around at the back. Building from deep.",
            "Calm distribution from the {team} defence. No pressure on them here.",
            "{team} are content to keep possession in their own half for now.",
            "Playing out from the back, {team} look to start an attack.",
            "Safe play from {team}, circulating the ball across the backline.",
        ],
        // Zone: attacking third
        'att' => [
            "{team} are camped in the opposition half, probing for an opening.",
            "Sustained pressure from {team} in the attacking third.",
            "{team} push forward, looking for the killer pass.",
            "All the pressure is coming from {team} now.",
            "{team} knock it around on the edge of the box, searching for a gap.",
        ],
        // Late game, tight match
        'late_tight' => [
            "Tension building here. Neither side wants to make a mistake.",
            "Nervous times. {team} keep possession as the clock ticks down.",
            "The atmosphere is electric. Every pass matters at this stage.",
            "Cautious play from {team}. Nobody wants to be the one to lose it here.",
            "We're into the final stages and it's tight. {team} have the ball.",
            "You can feel the tension. {team} play it safe in midfield.",
        ],
        // Late game, team wasting time
        'late_winning' => [
            "{team} are running down the clock. Can't blame them.",
            "Slow, deliberate possession from {team}. They're seeing this out.",
            "{team} take their time with every pass. The opposition are getting frustrated.",
            "Time-wasting? Tactical awareness? Either way, {team} are keeping the ball.",
            "{team} pass it back to the goalkeeper. They're winding the clock down.",
        ],
        // Dominant possession
        'dominant' => [
            "{team} have had the lion's share of possession. They control the tempo.",
            "One-way traffic here. {team} dominate the ball.",
            "{team} are suffocating the opposition with their possession.",
            "The opposition can't get a touch. {team} are monopolizing the ball.",
        ],
        // After a sustained quiet period
        'stale' => [
            "Not much happening in this passage of play. The tempo has dropped.",
            "A lull in proceedings. Both teams catching their breath.",
            "It's gone a bit flat out there. The crowd is getting restless.",
            "Neither side creating much at the moment. A quiet spell in this match.",
            "The match has hit a lull. Not much to report in the last few minutes.",
        ],
    ];

    // =========================================================================
    //  COLOR COMMENTARY — Periodic observations
    // =========================================================================

    private const COLOR_COMMENTARY = [
        'possession_dominance' => [
            "{team} have had {pct}% of the ball. They've been controlling this match.",
            "The possession stats tell the story: {team} with {pct}% of the ball.",
            "{team} dominating possession with {pct}%. The opposition are chasing shadows.",
        ],
        'shots_pressure' => [
            "{team} have had {shots} shots so far. They're pressing hard for a goal.",
            "It's been wave after wave of attacks. {team} with {shots} attempts on goal.",
            "{team} have been the more threatening side with {shots} shots in this match.",
        ],
        'defensive_display' => [
            "The defence has been superb today. {team} have barely been troubled.",
            "A masterclass in defending so far. Very few clear chances created.",
            "Both sides well-organized at the back. This is a tactical battle.",
        ],
        'end_to_end' => [
            "This has been a terrific match. End-to-end stuff with chances at both ends.",
            "What a game this has been! Neither defence has had a moment's rest.",
            "Enthralling encounter so far. Both teams committed to attacking football.",
        ],
        'fatigue_late' => [
            "Tired legs out there. The pace has dropped noticeably in this second half.",
            "You can see the fatigue setting in. Spaces are appearing all over the pitch.",
            "The energy levels are dropping. Both sides looking leggy as the match wears on.",
        ],
        'injury_time_announcement' => [
            "The fourth official indicates {minutes} minutes of added time.",
            "{minutes} minutes of stoppage time to play. Can anyone find a winner?",
            "There will be {minutes} minutes of injury time added on.",
        ],
    ];

    // =========================================================================
    //  POST-GOAL SCORE LINE
    // =========================================================================

    private const SCORE_UPDATE_FORMATS = [
        "It's now {home_team} {home_score} - {away_score} {away_team}.",
        "The score: {home_team} {home_score}, {away_team} {away_score}.",
        "{home_team} {home_score} - {away_score} {away_team}.",
    ];

    // =========================================================================
    //  MAIN API
    // =========================================================================

    /**
     * Build commentary text for a single event.
     */
    public function buildEventCommentary(array $event, MatchState $state): string
    {
        $type = $event['type'];
        $teamSide = $event['team'] ?? '';
        $teamName = $this->getTeamName($teamSide, $state);

        $replacements = $this->buildReplacements($event, $state, $teamName);

        $outcome = $event['outcome'] ?? '';

        // Route to specialized builders for key events
        return match (true) {
            $this->isGoalEvent($event) => $this->buildGoalCommentary($event, $state, $replacements),
            $type === 'header' && $outcome === 'goal'
                => $this->applyReplacements($this->pickRandom(self::GOAL_HEADER_TEMPLATES), $replacements),
            $type === 'header' && $outcome === 'saved'
                => $this->applyReplacements($this->pickRandom(self::SHOT_ON_TARGET_TEMPLATES), $replacements),
            $type === 'header' && $outcome === 'wide'
                => $this->applyReplacements($this->pickRandom(self::HEADER_OFF_TARGET_TEMPLATES), $replacements),
            $type === 'penalty' && $outcome === 'goal'
                => $this->applyReplacements($this->pickRandom(self::GOAL_PENALTY_TEMPLATES), $replacements),
            $type === 'penalty' && $outcome === 'saved'
                => $this->applyReplacements($this->pickRandom(self::PENALTY_MISS_TEMPLATES), $replacements),
            $type === 'save' && $outcome === 'claimed'
                => $this->applyReplacements($this->pickRandom(self::SAVE_CLAIMED_TEMPLATES), $replacements),
            $type === 'save' => $this->buildSaveCommentary($event, $state, $replacements),
            default => $this->buildStandardCommentary($event, $state, $replacements),
        };
    }

    /**
     * Build commentary for a quiet minute (no notable events).
     */
    public function buildQuietMinuteCommentary(MatchState $state): string
    {
        $pool = $this->selectQuietPool($state);
        $template = $this->pickRandom($pool);
        $teamName = $this->getTeamName($state->possession, $state);

        return str_replace('{team}', $teamName, $template);
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

        // Add post-goal score line if there was a goal
        $hasGoal = false;
        foreach ($events as $event) {
            $type = $event['type'] ?? '';
            $outcome = $event['outcome'] ?? '';
            if (($type === 'goal' || $type === 'header' || $type === 'penalty') && $outcome === 'goal') {
                $hasGoal = true;
                break;
            }
        }
        if ($hasGoal) {
            $scoreLine = $this->buildScoreLine($state);
            if ($scoreLine) {
                $lines[] = $scoreLine;
            }
        }

        return $state->minute . "' - " . implode(' ', $lines);
    }

    /**
     * Build color commentary for periodic observations.
     * Returns null if no commentary is appropriate right now.
     */
    public function buildColorCommentary(MatchState $state): ?string
    {
        // Don't spam color commentary
        if ($state->minute - $state->lastColorCommentaryMinute < 8) {
            return null;
        }

        // Don't emit in early minutes or during injury time
        if ($state->minute < 10 || $state->minute > 90) {
            return null;
        }

        $candidates = [];
        $teamName = '';

        // Possession dominance
        $dominant = $state->getDominantSide();
        if ($dominant) {
            $teamName = $this->getTeamName($dominant, $state);
            $pct = (int) $state->stats[$dominant]['possession_pct'];
            $templates = self::COLOR_COMMENTARY['possession_dominance'];
            $template = $this->pickRandom($templates);
            $candidates[] = str_replace(['{team}', '{pct}'], [$teamName, (string) $pct], $template);
        }

        // Shots pressure
        foreach (['home', 'away'] as $side) {
            $shots = $state->stats[$side]['shots'];
            $oppShots = $state->stats[$state->opponent($side)]['shots'];
            if ($shots >= 6 && $shots > $oppShots * 2) {
                $teamName = $this->getTeamName($side, $state);
                $templates = self::COLOR_COMMENTARY['shots_pressure'];
                $template = $this->pickRandom($templates);
                $candidates[] = str_replace(['{team}', '{shots}'], [$teamName, (string) $shots], $template);
            }
        }

        // End-to-end (both teams have 4+ shots)
        if ($state->stats['home']['shots'] >= 4 && $state->stats['away']['shots'] >= 4) {
            $candidates[] = $this->pickRandom(self::COLOR_COMMENTARY['end_to_end']);
        }

        // Defensive display (few shots late in the match)
        if ($state->minute >= 60
            && $state->stats['home']['shots'] + $state->stats['away']['shots'] <= 6
        ) {
            $leadingSide = $state->isWinning('home') ? 'home' : ($state->isWinning('away') ? 'away' : null);
            if ($leadingSide) {
                $teamName = $this->getTeamName($leadingSide, $state);
            }
            $templates = self::COLOR_COMMENTARY['defensive_display'];
            $template = $this->pickRandom($templates);
            $candidates[] = str_replace('{team}', $teamName ?: 'Both sides', $template);
        }

        // Fatigue (after minute 75)
        if ($state->minute >= 75 && $state->minute <= 85) {
            $candidates[] = $this->pickRandom(self::COLOR_COMMENTARY['fatigue_late']);
        }

        if (empty($candidates)) {
            return null;
        }

        $state->lastColorCommentaryMinute = $state->minute;
        $state->colorCommentaryCount++;

        return $this->pickRandom($candidates);
    }

    /**
     * Build injury time announcement.
     */
    public function buildInjuryTimeAnnouncement(int $minutes): string
    {
        $templates = self::COLOR_COMMENTARY['injury_time_announcement'];
        $template = $this->pickRandom($templates);
        return str_replace('{minutes}', (string) $minutes, $template);
    }

    /**
     * Build a context-aware half-time commentary.
     */
    public function buildHalfTimeCommentary(MatchState $state): string
    {
        $replacements = $this->buildStructuralReplacements($state);

        if ($state->score['home'] === 0 && $state->score['away'] === 0) {
            $pool = self::HALF_TIME_TEMPLATES['goalless'];
        } elseif ($state->score['home'] === $state->score['away']) {
            $pool = self::HALF_TIME_TEMPLATES['level'];
        } elseif (abs($state->score['home'] - $state->score['away']) >= 2) {
            $pool = self::HALF_TIME_TEMPLATES['dominant'];
            $leadingSide = $state->score['home'] > $state->score['away'] ? 'home' : 'away';
            $replacements['{leading_team}'] = $this->getTeamName($leadingSide, $state);
        } else {
            $pool = self::HALF_TIME_TEMPLATES['close'];
        }

        return $this->applyReplacements($this->pickRandom($pool), $replacements);
    }

    /**
     * Build a context-aware full-time commentary.
     */
    public function buildFullTimeCommentary(MatchState $state): string
    {
        $replacements = $this->buildStructuralReplacements($state);
        $totalGoals = $state->score['home'] + $state->score['away'];

        if ($totalGoals >= 5) {
            $pool = self::FULL_TIME_TEMPLATES['high_scoring'];
        } elseif ($state->score['home'] === 0 && $state->score['away'] === 0) {
            $pool = self::FULL_TIME_TEMPLATES['goalless_draw'];
        } elseif ($state->score['home'] === $state->score['away']) {
            $pool = self::FULL_TIME_TEMPLATES['draw'];
        } elseif ($state->score['home'] > $state->score['away']) {
            $pool = self::FULL_TIME_TEMPLATES['home_win'];
        } else {
            $pool = self::FULL_TIME_TEMPLATES['away_win'];
        }

        return $this->applyReplacements($this->pickRandom($pool), $replacements);
    }

    // =========================================================================
    //  PRIVATE — Goal Commentary Builder
    // =========================================================================

    private function isGoalEvent(array $event): bool
    {
        return ($event['type'] ?? '') === 'goal' && ($event['outcome'] ?? '') === 'goal';
    }

    private function buildGoalCommentary(array $event, MatchState $state, array $replacements): string
    {
        $side = $event['team'] ?? 'home';
        $hasAssist = !empty($event['secondary_player_id']);

        // Determine score context (score has already been updated by the engine)
        $context = $this->determineGoalContext($state, $side);
        $timeContext = $state->getTimeContext();

        // Select pool
        $poolKey = $context . ($hasAssist ? '_with_assist' : '');
        $pool = self::GOAL_TEMPLATES[$poolKey] ?? self::GOAL_TEMPLATES[$context] ?? self::GOAL_TEMPLATES['opener'];

        // Build the score string for {score} placeholder
        $replacements['{score}'] = $state->score['home'] . '-' . $state->score['away'];

        $text = $this->applyReplacements($this->pickRandom($pool), $replacements);

        // Apply time modifier
        if (isset(self::GOAL_TIME_MODIFIERS[$timeContext])) {
            $modifiers = self::GOAL_TIME_MODIFIERS[$timeContext];
            $roll = random_int(1, 100);
            if ($roll <= 60) {
                // 60% chance of prefix
                $prefix = $this->pickRandom($modifiers['prefix']);
                if ($prefix) {
                    $text = $prefix . $text;
                }
            } elseif ($roll <= 90) {
                // 30% chance of suffix
                $suffix = $this->pickRandom($modifiers['suffix']);
                if ($suffix) {
                    $text .= $suffix;
                }
            }
        }

        // Check for quick-fire goals
        if ($state->lastGoalMinute !== null && ($state->minute - $state->lastGoalMinute) <= 3) {
            $quickFire = [
                " Two goals in quick succession!",
                " A quick-fire double!",
                " The goals are flying in now!",
            ];
            $text .= $this->pickRandom($quickFire);
        }

        // Check if this player scored earlier
        $playerId = $event['primary_player_id'] ?? null;
        if ($playerId && ($state->playerStates[$playerId]['goals'] ?? 0) >= 2) {
            $count = $state->playerStates[$playerId]['goals'];
            if ($count === 2) {
                $brace = [" That's his second of the match!", " A brace for {player}!"];
                $text .= str_replace('{player}', $replacements['{player}'], $this->pickRandom($brace));
            } elseif ($count >= 3) {
                $text .= " HAT-TRICK! What a performance from " . $replacements['{player}'] . "!";
            }
        }

        return $text;
    }

    /**
     * Determine goal context from current score state.
     * Score has already been updated when commentary is built.
     */
    private function determineGoalContext(MatchState $state, string $scoringSide): string
    {
        $scorer = $state->score[$scoringSide];
        $opponent = $state->score[$state->opponent($scoringSide)];

        // Total goals = 1 means this was the opener
        if ($scorer + $opponent === 1) {
            return 'opener';
        }

        // Equalizer: scores are now level
        if ($scorer === $opponent) {
            return 'equalizer';
        }

        // Go-ahead: now leading by 1, and was level before
        if ($scorer === $opponent + 1) {
            return 'go_ahead';
        }

        // Extending: leading by 2+
        if ($scorer > $opponent + 1) {
            return 'extending';
        }

        // Consolation: still trailing
        if ($scorer < $opponent) {
            return 'consolation';
        }

        return 'go_ahead';
    }

    // =========================================================================
    //  PRIVATE — Save Commentary Builder
    // =========================================================================

    private function buildSaveCommentary(array $event, MatchState $state, array $replacements): string
    {
        $gkId = $event['primary_player_id'] ?? null;
        $saveCount = $gkId ? ($state->playerMatchSaves[$gkId] ?? 0) : 0;

        // Use "repeated" pool if GK has made 3+ saves
        if ($saveCount >= 3) {
            $pool = self::SAVE_TEMPLATES['repeated'];
        } else {
            $pool = self::SAVE_TEMPLATES['default'];
        }

        return $this->applyReplacements($this->pickRandom($pool), $replacements);
    }

    // =========================================================================
    //  PRIVATE — Standard Event Commentary
    // =========================================================================

    private function buildStandardCommentary(array $event, MatchState $state, array $replacements): string
    {
        $type = $event['type'] ?? '';

        // Second half kickoff uses special templates
        if ($type === 'kickoff' && ($event['_second_half'] ?? false)) {
            return $this->applyReplacements($this->pickRandom(self::SECOND_HALF_KICKOFF_TEMPLATES), $replacements);
        }

        $templateKey = $this->resolveTemplateKey($event, $state);
        $pool = $this->getTemplatePool($templateKey);

        return $this->applyReplacements($this->pickRandom($pool), $replacements);
    }

    /**
     * Get the template pool for a given key.
     */
    private function getTemplatePool(string $key): array
    {
        return match ($key) {
            'shot_on_target' => self::SHOT_ON_TARGET_TEMPLATES,
            'shot_off_target' => self::SHOT_OFF_TARGET_TEMPLATES,
            'shot_blocked' => self::SHOT_BLOCKED_TEMPLATES,
            'corner' => self::CORNER_TEMPLATES,
            'free_kick' => self::FREE_KICK_TEMPLATES,
            'free_kick_shot' => self::FREE_KICK_SHOT_TEMPLATES,
            'penalty_awarded' => self::PENALTY_AWARDED_TEMPLATES,
            'foul' => self::FOUL_TEMPLATES,
            'foul_dangerous' => self::FOUL_DANGEROUS_TEMPLATES,
            'yellow_card' => self::YELLOW_CARD_TEMPLATES,
            'second_yellow' => self::SECOND_YELLOW_TEMPLATES,
            'red_card' => self::RED_CARD_TEMPLATES,
            'offside' => self::OFFSIDE_TEMPLATES,
            'tackle' => self::TACKLE_TEMPLATES,
            'interception' => self::INTERCEPTION_TEMPLATES,
            'clearance' => self::CLEARANCE_TEMPLATES,
            'cross' => self::CROSS_TEMPLATES,
            'dribble' => self::DRIBBLE_TEMPLATES,
            'pass' => self::PASS_TEMPLATES,
            'through_ball' => self::THROUGH_BALL_TEMPLATES,
            'possession' => self::POSSESSION_TEMPLATES,
            'throw_in' => self::THROW_IN_TEMPLATES,
            'goal_kick' => self::GOAL_KICK_TEMPLATES,
            'substitution' => self::SUBSTITUTION_TEMPLATES,
            'kickoff' => self::KICKOFF_TEMPLATES,
            'half_time' => self::HALF_TIME_TEMPLATES['close'],
            'full_time' => self::FULL_TIME_TEMPLATES['draw'],
            default => self::QUIET_TEMPLATES['mid_level'],
        };
    }

    // =========================================================================
    //  PRIVATE — Quiet Minute Pool Selection
    // =========================================================================

    /**
     * Select the most appropriate quiet-minute template pool based on context.
     */
    private function selectQuietPool(MatchState $state): array
    {
        $side = $state->possession;
        $zone = $state->zone;
        $minute = $state->minute;
        $isWinning = $state->isWinning($side);
        $isLosing = $state->isLosing($side);
        $isTight = $state->isTightMatch();

        // After long quiet spell
        if ($state->minutesSinceLastEvent >= 8) {
            return self::QUIET_TEMPLATES['stale'];
        }

        // Late game contexts
        if ($minute >= 80) {
            if ($isWinning) {
                return self::QUIET_TEMPLATES['late_winning'];
            }
            if ($isTight) {
                return self::QUIET_TEMPLATES['late_tight'];
            }
        }

        // Dominant possession
        if ($state->consecutivePossessionMinutes >= 5 && $state->getDominantSide() === $side) {
            return self::QUIET_TEMPLATES['dominant'];
        }

        // Zone-based selection
        if (str_contains($zone, 'def')) {
            return self::QUIET_TEMPLATES['def'];
        }
        if (str_contains($zone, 'att')) {
            return self::QUIET_TEMPLATES['att'];
        }

        // Score-based midfield selection
        if ($isWinning) {
            return self::QUIET_TEMPLATES['mid_winning'];
        }
        if ($isLosing) {
            return self::QUIET_TEMPLATES['mid_losing'];
        }

        return self::QUIET_TEMPLATES['mid_level'];
    }

    // =========================================================================
    //  PRIVATE — Template Key Resolution
    // =========================================================================

    private function resolveTemplateKey(array $event, MatchState $state): string
    {
        $type = $event['type'];
        $outcome = $event['outcome'] ?? '';

        return match (true) {
            // Shot variants
            $type === 'shot_on_target' && $outcome === 'blocked' => 'shot_blocked',
            $type === 'shot_on_target' => 'shot_on_target',
            $type === 'shot_off_target' => 'shot_off_target',

            // Card variants
            $type === 'yellow_card' => 'yellow_card',
            $type === 'red_card' && ($event['_second_yellow'] ?? false) => 'second_yellow',
            $type === 'red_card' => 'red_card',

            // Foul in dangerous position
            $type === 'foul' && ($event['_dangerous'] ?? false) => 'foul_dangerous',

            // Use event type directly if pool exists
            default => $type,
        };
    }

    // =========================================================================
    //  PRIVATE — Replacement Building
    // =========================================================================

    private function buildReplacements(array $event, MatchState $state, string $teamName): array
    {
        $type = $event['type'];

        // {opp_team} is the opposing team (useful for fouls where {team} is the fouler)
        $oppSide = $state->opponent($teamSide ?: 'home');
        $oppTeamName = $this->getTeamName($oppSide, $state);

        $replacements = [
            '{player}' => $event['primary_player_name'] ?? 'A player',
            '{player2}' => $event['secondary_player_name'] ?? 'a teammate',
            '{team}' => $teamName,
            '{opp_team}' => $oppTeamName,
            '{gk}' => '',
            '{minute}' => (string) $state->minute,
            '{home_team}' => $state->homeTeam->name ?? 'Home',
            '{away_team}' => $state->awayTeam->name ?? 'Away',
            '{home_score}' => (string) $state->score['home'],
            '{away_score}' => (string) $state->score['away'],
            '{count}' => '',
            '{score}' => $state->score['home'] . '-' . $state->score['away'],
        ];

        // Fill GK name for saves/shots on target
        if (in_array($type, ['save', 'shot_on_target', 'penalty_miss', 'penalty'])) {
            if ($type === 'save') {
                // For saves, the primary player IS the GK
                $replacements['{gk}'] = $event['primary_player_name'] ?? 'the goalkeeper';
                // {player} in save templates refers to the shooter (secondary)
                // If no secondary player (e.g. corner claim), just credit the GK
                $shooter = $event['secondary_player_name'] ?? null;
                $replacements['{player}'] = $shooter ?: 'the attacker';
            } else {
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

        return $replacements;
    }

    private function buildStructuralReplacements(MatchState $state): array
    {
        return [
            '{home_team}' => $state->homeTeam->name ?? 'Home',
            '{away_team}' => $state->awayTeam->name ?? 'Away',
            '{home_score}' => (string) $state->score['home'],
            '{away_score}' => (string) $state->score['away'],
            '{leading_team}' => '',
            '{team}' => '',
        ];
    }

    // =========================================================================
    //  PRIVATE — Score Line & Helpers
    // =========================================================================

    private function buildScoreLine(MatchState $state): ?string
    {
        // Only show score line when there's been more than 1 goal
        $total = $state->score['home'] + $state->score['away'];
        if ($total <= 1) {
            return null;
        }

        $template = $this->pickRandom(self::SCORE_UPDATE_FORMATS);
        return $this->applyReplacements($template, $this->buildStructuralReplacements($state));
    }

    private function applyReplacements(string $template, array $replacements): string
    {
        return str_replace(
            array_keys($replacements),
            array_values($replacements),
            $template
        );
    }

    private function pickRandom(array $pool): string
    {
        return $pool[array_rand($pool)];
    }

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
