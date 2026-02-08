# Fallback (Non-AI) Match Simulation — Full Team Analysis

> Analysis by: Football Specialist, System Architect, Senior Developer, Product Manager, QA Engineer
> Scope: `simulateWithFallback()` and every method it calls — zero OpenAI dependency
> File: `api/app/Services/MatchSimulationService.php` (3,245 lines)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical Bugs (Ship-Stoppers)](#2-critical-bugs)
3. [High-Severity Bugs](#3-high-severity-bugs)
4. [Football Realism Failures](#4-football-realism-failures)
5. [Dead Code Inventory](#5-dead-code-inventory)
6. [What the Frontend Actually Receives](#6-what-the-frontend-receives)
7. [What a Real Match Should Look Like](#7-realistic-match-timeline)
8. [Architecture Recommendation](#8-architecture-recommendation)
9. [MVP Event Schema (No AI Required)](#9-mvp-event-schema)
10. [Full Bug Table](#10-full-bug-table)

---

## 1. Executive Summary

The non-AI fallback simulation is **fundamentally broken** at multiple levels. It has 2 critical data-corruption bugs (doubled scores, disabled player tracking), produces output that bears almost no resemblance to a real football match (6-12 random isolated events vs. ~1,500 real match actions), and wastes the rich data models that already exist (64 player attributes, detailed tactics, formations).

**The two show-stopper bugs:**
- Every match score is **exactly doubled** (a real 2-1 is saved as 4-2)
- Red-carded and substituted players **keep playing** (player tracking is completely disabled)

**The core architectural problem:** The system generates a random scatter of disconnected "notable incidents" instead of simulating a continuous game with possession, ball movement, and causal event chains.

---

## 2. Critical Bugs

### BUG-01: Score Double-Counting — Every Match Score Is 2x Actual

**Lines:** 1006-1007, 1036-1037, 1466 (signature), 1510-1516, 1052-1061, 1073

**Trace:**
```
Step 1: $homeScore = 0, $awayScore = 0  (line 1006-1007)

Step 2: generatePeriodEvents() takes scores BY REFERENCE (int &$homeScore)
        Inside, goals increment scores (lines 1510-1516)
        After both halves: $homeScore = 2, $awayScore = 1  ✓ correct

Step 3: Lines 1052-1061 loop over ALL events and count goals AGAIN:
        foreach ($events as $event) {
            if ($event['type'] === 'goal') {
                if ($event['team'] === 'home') $homeScore++;  // NOW 4
                ...
        After re-count: $homeScore = 4, $awayScore = 2  ✗ DOUBLED

Step 4: processAndSaveEvents() receives $homeScore=4, $awayScore=2
        Saves to database: match score 4-2 instead of 2-1
```

**Impact:** Every fallback-simulated match has exactly 2x the actual goals. Scores are always even numbers (0-0, 2-0, 4-2, 6-2), which is statistically impossible and instantly noticeable.

**Consequence:** The late-goal safety net at line 1064 (`$homeScore === 0 && $awayScore === 0`) almost never fires because the doubled scores are non-zero even for 1-goal matches.

---

### BUG-02: `past_events` Never Initialized — All Player Tracking Disabled

**Lines:** 1025-1032 (initialization), 1500 (read), 2012-2039 (update)

The initial `$matchState` at line 1025:
```php
$matchState = [
    'home_cards' => ['yellow' => 0, 'red' => 0],
    'away_cards' => ['yellow' => 0, 'red' => 0],
    'home_substitutions' => 0,
    'away_substitutions' => 0,
    'intensity' => 'normal',
    'momentum' => 'neutral',
    // ← NO 'past_events' key
];
```

At line 1500: `$pastEvents = $matchState['past_events'] ?? []` — always `[]`.
`updateMatchState()` (line 2012) never adds events to matchState either.

**Impact cascade:**
- `getAvailablePlayers()` receives empty array → returns ALL 28 players → no filtering
- **Red-carded players keep playing and scoring** (Test: red card at min 10, goal at min 45 — works)
- **Substituted players keep playing** (same player can be subbed on twice)
- **Yellow cards never accumulate to red** (cards tracked per-team, not per-player)
- The entire `getAvailablePlayers()`/`getRandomAvailablePlayer()` system is effectively dead code

---

## 3. High-Severity Bugs

### BUG-03: `isHomeTeam` Always True (Line 1671)

```php
$coordinates = $this->generateEventCoordinates($eventType, $team->name === $team->name);
//                                                          ^^^^^^^^^^^^^^^^^^^^^^^^
//                                                          TAUTOLOGY — always true
```

Should be `$team->id === $homeTeam->id` but `$homeTeam` isn't in scope.

**Impact:** All away-team events get home-team coordinates. Away goals at x=80-100 (home attacking end) instead of x=0-20.

### BUG-04: `$eventType` Param Ignored in Player Selection (Line 3078)

```php
private function getRandomAvailablePlayer(Team $team, array $pastEvents, string $eventType = 'general'): string
{
    $availablePlayers = $this->getAvailablePlayers($team, $pastEvents);
    // $eventType is NEVER used below this line
    $selectedPlayer = $availablePlayers[array_rand($availablePlayers)];
    return $this->getPlayerFullName($selectedPlayer);
}
```

**Impact:** Goalkeepers score goals, strikers make saves, centre-backs get caught offside. All player selection is purely random across all 28 squad members.

### BUG-05: No Substitution Limit (Lines 1544-1588)

No code ever sets substitution probability to 0 when the count reaches 3 or 5. The counter at `$matchState['away_substitutions']` is incremented but never checked as a hard cap.

Additionally, line 1570 checks `home_substitutions` when evaluating the away team's probability — wrong variable.

### BUG-06: Substitution Description Format Incompatible with Detection (Lines 1842-1853 + 3052)

The regex to detect substituted-out players: `'/(\w+)\s+replaces\s+(\w+)/'`

But fallback descriptions say: `"Tactical substitution as {$playerName} enters the fray"` — the word "replaces" never appears. Even if `past_events` were populated, substituted players would never be filtered.

### BUG-07: Late Goal Not Re-Sorted (Lines 1064-1071)

Events are sorted at line 1048. The late goal is appended at line 1065 AFTER sorting. If injury-time events exist (minutes 91+), the late goal (minutes 85-90) appears after them in the saved order.

### BUG-08: Wasted DB Query Per Event (Lines 1496-1501)

```php
$player = $teamModel->players()->inRandomOrder()->first();    // DB query — WASTED
$playerName = $player ? ... : $this->generateRandomPlayerName();
$playerName = $this->getRandomAvailablePlayer(...);            // OVERWRITES above
```

~10-18 unnecessary database queries per simulation.

---

## 4. Football Realism Failures

### 4.1 Event Count: Off by Two Orders of Magnitude

| Metric | Simulation | Real Football |
|--------|-----------|---------------|
| **Total events per match** | 6-12 | ~1,500-2,000 |
| **Goals** | ~0.88 (displayed as ~1.76 due to bug) | 2.5-2.8 |
| **Fouls** | ~0.4 | 22-26 |
| **Corners** | ~1.5 | 10-12 |
| **Free kicks** | ~2 | 25-30 |
| **Saves** | ~0.8 | 6-8 |
| **Passes** | **0 (not modeled)** | 800-1,000 |
| **Shots** | **0 (not modeled)** | 22-28 |
| **Throw-ins** | **0 (not modeled)** | 40-50 |
| **Tackles** | **0 (not modeled)** | 30-40 |

### 4.2 Missing Event Types (Completely Absent)

- **Passes** — the most common action in football (~500-600 per team per match)
- **Shots off target / wide** — roughly half of all shots miss
- **Throw-ins** — ~40-50 per match
- **Goal kicks** — ~14-18 per match
- **Tackles** — ~30-40 per match
- **Interceptions** — ~25-30 per match
- **Clearances** — ~40-50 per match
- **Crosses** — ~40-50 per match
- **Dribbles** — ~20-30 per match
- **Headers** — ~30-40 per match
- **Penalty** — present in dead code `getRandomEventType()` but ABSENT from the live `getContextualEventType()`
- **Kick-off / Half-time / Full-time** — no match structure markers
- **Shots hitting woodwork** — absent

### 4.3 Zero Event Causality

Every event is generated independently: random minute, random team, random type, random player. There are zero causal chains.

**In real football:**
- Foul → free kick → cross → header → save → corner (chain of 6)
- Pass → pass → through-ball → shot → goal (chain of 5)
- Tackle → turnover → counter-attack → shot → save (chain of 5)

**In the simulation:** A corner at minute 23 has no connection to a save at minute 24. A goal at minute 78 is not preceded by any shot, cross, pass, or build-up.

### 4.4 No Possession Model

Nobody has the ball. There is no concept of which team is in control at any given moment. Real football is fundamentally about possession — this simulation has none.

### 4.5 64 Player Attributes Completely Wasted

The `PlayerAttribute` model has 64 detailed attributes: `finishing`, `passing`, `dribbling`, `tackling`, `pace`, `composure`, `vision`, `stamina`, `strength`, `crossing`, `heading`, etc.

**Used in fallback simulation: ZERO.** Only `current_ability` (a single aggregate number) is read, and only for team strength averaging.

### 4.6 Formations Have Zero Effect

`Formation` model has: `positions`, `defenders_count`, `midfielders_count`, `forwards_count`, `style`. None are consulted during the fallback simulation. A 5-3-2 produces identical output to a 3-4-3.

### 4.7 Tactics Have Zero Effect

`Tactic` model has ~30 detailed fields: `mentality`, `pressing`, `tempo`, `width`, `defensive_line`, `offside_trap`, `counter_attack`, `passing_directness`, `work_ball_into_box`, etc. **None are read** in the fallback. Only `custom_positions` is checked for a tiny strength modifier (+/- 0.8 max).

### 4.8 No Match Flow/Rhythm

Real matches have phases: cautious opening, sustained pressure, half-time reset, tired legs, desperate finale. The simulation places events at uniformly random minutes with no pacing, no clustering, no momentum conveyed through event frequency. The only time-aware adjustment: +3 goal probability after minute 80.

### 4.9 Momentum Is Almost Inert

Momentum changes ONLY on goals and red cards (lines 2034-2038). In a 0-0 draw with no red cards, momentum stays 'neutral' for all 90 minutes. Corners, shots, sustained pressure — none affect momentum.

---

## 5. Dead Code Inventory

Methods defined but **never called** from the fallback path:

| Method | Line | Purpose (wasted) |
|--------|------|-----------------|
| `getContextualPlayer()` | 1618 | Position-aware player selection (forwards for goals, GK for saves) |
| `getRandomEventType()` | 1076 | Alternative probability table (15% goals vs 8%) |
| `generateEventDescription()` | 1103 | Simple description generator |
| `generateRandomPlayerName()` | 1190 | Fake name generator (overwritten at line 1501) |
| `selectEventType()` | 2816 | Third probability system (decimal-based) |
| `selectTeam()` | 2786 | Alternative team selection |
| `calculateEventProbability()` | 2721 | Probability calculator |
| `buildMatchContext()` | 1209 | Rich context builder |
| `getStartingXI()` | 1282 | Starting XI selection |
| `getTacticalSetup()` | 1380 | Tactical info builder |
| `getMentalityFromFormation()` | 1390 | Formation → mentality mapper |
| `buildPlayerStateContext()` | 2986 | Player state tracker |
| `buildTeamRoster()` | 3138 | Roster builder |

Three separate, incompatible event-type probability systems exist:
1. `getRandomEventType()` — line 1076, sums to 100, includes `penalty` (DEAD)
2. `getContextualEventType()` — line 1544, sums to 100, includes `save`/`shot_blocked`, no `penalty` (ACTIVE)
3. `selectEventType()` — line 2816, sums to ~1.45, decimal-based (DEAD)

---

## 6. What the Frontend Actually Receives

### Per-Match Output

A typical simulation produces **9 isolated text blurbs** across 90 minutes:

```
Min 7:  corner       — "Good work from Ricardo Horta earns SL Benfica a corner kick"
Min 14: free_kick    — "Free kick for FC Porto after Mehdi Taremi is fouled"
Min 23: offside      — "Offside flag raised against Goncalo Ramos"
Min 31: yellow_card  — "The referee shows Otavio a yellow card"
Min 52: goal         — "GOAL! Darwin Nunez finds the back of the net!"
Min 61: substitution — "Tactical substitution as Joao Mario enters the fray"
Min 72: foul         — "Pepe commits a foul and gives away a free kick"
Min 78: save         — "Brilliant save by Diogo Costa!"
Min 89: shot_blocked — "Great defending to block Rafa Silva's effort"
```

**80+ minutes have zero data.** No possession, no stats, no player positions.

### Sub-Events: Text Strings, Not Visualization Data

Only goals and cards have sub_events. They are plain English:
```
"A perfectly weighted pass finds a teammate in space on the right wing"
```
No coordinates, no player IDs (except the scorer), no ball trajectory. A frontend **cannot** animate these.

All other event types (corner, free_kick, save, foul, substitution, offside, shot_blocked) have `sub_events: null`.

### Missing From Output
- No possession percentage
- No shot count / shots on target
- No pass statistics
- No player positions on pitch
- No ball position between events
- No starting XI identification
- No match_stats (the JSON column exists but is never populated)
- Match status set to `in_progress` but never to `completed`

---

## 7. Realistic Match Timeline

What 30 events in a realistic simulated match (2-1 final) should look like, showing causal chains and match flow:

```
Min  Event              Team  Player          Chain/Context
---  -----              ----  ------          -------------
1    Kick-off           Home  —               Match begins
3    Pass sequence      Home  Midfielder      Probing possession in midfield
5    Cross              Home  RW              Cross from right, cleared by CB
5    Corner             Home  —               Won off clearance
6    Header off target  Home  CB              Corner delivery, headed wide
6    Goal kick          Away  GK              Restart
12   Tackle             Away  DM              Strong tackle wins possession
14   Through-ball       Away  CM              Counter-attack initiated
14   Shot on target     Away  ST              Low shot, saved
14   Save               Home  GK              Diving save, parried to corner
15   Corner             Away  —               Won off save
22   Foul               Home  CB              Clips winger on the break
22   Free kick          Away  —               Dangerous position, 30 yards
22   Cross from FK      Away  RM              Whipped in, headed away
30   Dribble            Home  LW              Cuts inside past RB
30   Shot off target    Home  LW              Curler from edge of box, just wide
37   Foul + Yellow      Away  RB              Booked for persistent fouling
38   Free kick          Home  —               Dangerous position
40   Interception       Away  CB              Reads the pass, clears upfield
--- HALF TIME (0-0) ---
49   Substitution       Away  Fresh ST        Manager changes system
52   Through-ball       Away  New ST          Runs onto ball in channel
52   GOAL (0-1)         Away  New ST          One-on-one, slots past keeper
60   Cross              Home  RW              Deep cross from overlap
60   Header on target   Home  ST              Powerful header, 8 yards
60   Save               Away  GK              Brilliant reflex save
61   Corner             Home  —               Won off save
61   GOAL (1-1)         Home  CB              Stabs home at near post from corner
72   Counter-attack     Away  LW              Beats defender on outside
72   Cross + Clearance  Away  LW / Home RB    Last-ditch clearance
80   Through-ball       Home  AM              Splits the defense
80   GOAL (2-1)         Home  ST              Cool finish into far corner
84   Substitution       Home  Defensive CM    Shoring up the lead
88   Time-wasting       Home  GK              Taking time over goal kicks
90+2 Full time          —     —               FT: 2-1
```

**Key differences from current simulation:**
1. Causal chains: save → corner → goal
2. Passes, dribbles, crosses precede shots and goals
3. Substitutions have consequences (new ST scores 3 min after coming on)
4. Player roles respected (GK saves, ST shoots, CB heads at corners)
5. Match phases visible (cautious opening → stalemate → tactical sub sparks goal → equalizer → late winner → game management)
6. Multiple events per minute when action chains together

---

## 8. Architecture Recommendation

### Current: Procedural Random Event Generator

```
simulateWithFallback()
  → pick random minutes
    → for each: random team, random event type, random player
      → generate text description
  → save all at once
```

No state machine. No possession. No causality. A 3,245-line God class.

### Recommended: Tick-Based Simulation Engine

```
MatchSimulationEngine/
├── Core/
│   ├── MatchState          # Immutable: score, minute, possession, ball position
│   ├── TeamState           # Lineup (11), bench, formation, fatigue per player
│   ├── PlayerMatchState    # Position, fatigue, cards, isOnPitch
│   └── BallState           # {x, y}, possessing team, possessing player
│
├── Engine/
│   ├── SimulationLoop      # For each minute: evaluate → resolve → update
│   ├── PossessionEngine    # Who has the ball? Pass/dribble/lose it
│   ├── EventResolver       # State + probabilities → event type
│   ├── PlayerSelector      # Event type + team state + attributes → player
│   ├── OutcomeResolver     # Player attributes + context → success/fail
│   └── CausalChainBuilder  # Foul→FK, shot→save→corner, etc.
│
├── Tactics/
│   ├── TacticEvaluator     # Reads tactic fields → modifies probabilities
│   └── FormationAnalyzer   # Formation → player zones, defensive gaps
│
├── Output/
│   ├── CommentaryGenerator # Structured events → text descriptions
│   ├── StatsAggregator     # Event stream → possession%, shots, etc.
│   └── MatchSerializer     # Full output JSON for frontend
│
└── Persistence/
    ├── MatchEventRepo      # Write events to DB
    └── MatchStateRepo      # Persist/restore state for mid-match resume
```

### Simulation Loop Pseudocode

```php
function simulate(Match $match): SimulationResult {
    $state = MatchState::initialize($match);  // Load lineups, formations, tactics

    for ($minute = 1; $minute <= 90; $minute++) {
        // 1. Update continuous state
        $state->advanceMinute();  // fatigue++, adjust positions

        // 2. Determine possession phase
        $phase = PossessionEngine::resolve($state);  // build-up, attack, transition, set-piece

        // 3. Should a key event occur this minute?
        $probability = EventResolver::calculateProbability($state, $phase);
        if (!$this->shouldEventOccur($probability)) {
            $state->recordQuietMinute($phase);  // still track possession/zone
            continue;
        }

        // 4. What event? Which team? Which player?
        $eventType = EventResolver::resolveType($state, $phase);
        $team = EventResolver::resolveTeam($state, $eventType);
        $player = PlayerSelector::select($state->getTeam($team), $eventType);

        // 5. Resolve outcome using player attributes
        $outcome = OutcomeResolver::resolve($eventType, $player, $state);

        // 6. Build causal chain (shot→save→corner, foul→FK, etc.)
        $chain = CausalChainBuilder::build($eventType, $outcome, $state);

        // 7. Apply to state (immutable transition)
        foreach ($chain as $event) {
            $state = $state->applyEvent($event);
        }

        // 8. Generate commentary text (separate concern)
        CommentaryGenerator::narrate($chain, $state);
    }

    return MatchSerializer::serialize($state);
}
```

### Key Design Principles

1. **Immutable state transitions** — eliminates pass-by-reference mutation bugs
2. **Single source of truth for score** — derived from event stream, never a separate counter
3. **Player selection is state-aware** — uses position, attributes, fatigue, cards
4. **Separation of simulation from narration** — engine produces structured data, commentary is generated after
5. **Attribute utilization** — `finishing` affects goals, `tackling` affects interceptions, `pace` affects counters
6. **Every minute has data** — even quiet minutes record possession/zone for the frontend
7. **Causal chains** — events link to their consequences (save → corner, foul → free kick)

---

## 9. MVP Event Schema (No AI Required)

### Output Structure

```json
{
  "match_id": 42,
  "lineups": {
    "home": {
      "starting": [
        { "player_id": 101, "position": "GK", "x": 5, "y": 50 },
        { "player_id": 102, "position": "RB", "x": 20, "y": 80 }
      ],
      "bench": [{ "player_id": 112, "position": "CM" }]
    },
    "away": { "..." : "same structure" }
  },
  "minutes": [
    {
      "minute": 1,
      "phase": "open_play",
      "possession": "home",
      "zone": "middle",
      "intensity": 0.4,
      "commentary": "The match kicks off with both teams settling in.",
      "stats": {
        "home": { "possession_pct": 55, "shots": 0, "shots_on_target": 0, "corners": 0, "fouls": 0 },
        "away": { "possession_pct": 45, "shots": 0, "shots_on_target": 0, "corners": 0, "fouls": 0 }
      },
      "events": []
    },
    {
      "minute": 14,
      "phase": "attack",
      "possession": "away",
      "zone": "attacking",
      "intensity": 0.7,
      "commentary": "FC Porto break quickly on the counter...",
      "stats": { "..." : "cumulative" },
      "events": [
        {
          "type": "shot_on_target",
          "team": "away",
          "primary_player_id": 205,
          "secondary_player_id": 208,
          "outcome": "saved",
          "coordinates": { "x": 15, "y": 45 },
          "description": "Taremi fires low but Vlachodimos dives to save.",
          "sequence": [
            { "action": "through_ball", "actor_id": 208, "ball_start": {"x":45,"y":50}, "ball_end": {"x":25,"y":40}, "duration_ms": 1200 },
            { "action": "shoot", "actor_id": 205, "ball_start": {"x":25,"y":40}, "ball_end": {"x":5,"y":48}, "duration_ms": 800 },
            { "action": "save_dive", "actor_id": 101, "ball_start": {"x":5,"y":48}, "ball_end": {"x":8,"y":52}, "duration_ms": 600 }
          ]
        }
      ]
    }
  ],
  "final_score": { "home": 2, "away": 1 },
  "full_time_stats": {
    "home": { "possession_pct": 58, "shots": 14, "shots_on_target": 6, "corners": 7, "fouls": 11, "yellow_cards": 2, "red_cards": 0 },
    "away": { "possession_pct": 42, "shots": 9, "shots_on_target": 3, "corners": 4, "fouls": 14, "yellow_cards": 3, "red_cards": 0 }
  }
}
```

### What This Enables for the Frontend

| Feature | Current Data | MVP Data |
|---------|-------------|----------|
| 2D pitch with player dots | Impossible (no positions) | 22 players in lineup with (x,y) per formation |
| Ball movement animation | Impossible (no ball data) | `sequence[]` with ball_start/ball_end per action |
| Event timeline sidebar | 9 text blurbs | 10-20 key events with structured data + 90 minute commentaries |
| Live score updates | One final score | Score changes at exact minute of each goal |
| Possession % bar | Impossible (not computed) | Per-minute cumulative stats |
| Match statistics | Impossible (not computed) | Full-time stats: shots, corners, fouls, cards, possession |
| Replay from any minute | Impossible (no per-minute state) | Every minute has phase, possession, zone, stats |

### Acceptance Criteria

1. Every simulated match returns data for all 90 minutes
2. Key events reference real player IDs from the starting XI (11, not 28)
3. A 4-4-2 produces measurably different stats than a 3-5-2 over 100 simulations
4. Higher `finishing` attribute → more goals on average over 100 simulations
5. Goal events include scorer (forward/midfielder preferred) and optional assister
6. Animation sequences use structured data (action enums, player IDs, coordinates) — no free-form text
7. Full-time stats are present and internally consistent (shots_on_target <= shots)
8. Frontend can render 22 player dots + ball on a 2D pitch using only simulation data

---

## 10. Full Bug Table

| # | Severity | Line(s) | Description |
|---|----------|---------|-------------|
| BUG-01 | **CRITICAL** | 1052-1061 + 1510-1516 | Score double-counted — every match saved at 2x actual goals |
| BUG-02 | **CRITICAL** | 1025-1032, 1500, 2012 | `past_events` never set — red cards, substitutions, yellow accumulation all disabled |
| BUG-03 | **HIGH** | 1671 | `$team->name === $team->name` always true — away coordinates wrong |
| BUG-04 | **HIGH** | 3078 | `$eventType` param accepted but never used — random player for all events |
| BUG-05 | **HIGH** | 1544-1588 | No substitution hard cap — unlimited subs possible |
| BUG-06 | **HIGH** | 1842 + 3052 | Substitution description format doesn't match detection regex ("replaces") |
| BUG-07 | **HIGH** | 1570 | Checks `home_substitutions` for away team logic — wrong variable |
| BUG-08 | **HIGH** | 2015-2018 | Yellow cards are team-level counters, not per-player — no second yellow → red |
| BUG-09 | **MEDIUM** | 1496-1501 | Player queried then immediately overwritten — ~10 wasted DB queries |
| BUG-10 | **MEDIUM** | 1064-1071 | Late goal appended after sort — wrong chronological position |
| BUG-11 | **MEDIUM** | 1163-1188 | Missing coordinate cases for `save` and `shot_blocked` |
| BUG-12 | **MEDIUM** | 1707-1762 | Most event types return no `sub_events` (only goal and cards have them) |
| BUG-13 | **MEDIUM** | 2064-2171 | Sub-events are plain text strings — incompatible with AI path's structured format |
| BUG-14 | **MEDIUM** | 3041-3073 | `getAvailablePlayers()` doesn't filter by team — cross-team name collisions possible |
| BUG-15 | **LOW** | 1460 | Match status set to `in_progress`, never to `completed` |
| BUG-16 | **LOW** | 3231 | `method_exists('getFullNameAttribute')` — checks old-style accessor, always false |
| PERF | **MEDIUM** | various | ~42-52 DB queries per simulation, ~30 are redundant |
| ARCH | **CRITICAL** | entire file | No game state machine, no possession, no causality, no attribute usage |
