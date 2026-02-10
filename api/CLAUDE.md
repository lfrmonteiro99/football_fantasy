# CLAUDE.md — API

Instructions for Claude Code when working in the `/api` directory.

## Commands

```bash
php artisan serve                   # Start dev server (port 8000)
php artisan test                    # Run PHPUnit tests
php artisan migrate                 # Run pending migrations
php artisan db:seed                 # Seed database
php artisan migrate:fresh --seed    # Reset DB completely
./rollback_and_migrate.sh           # Same as above
php artisan route:list              # Show all routes
php artisan tinker                  # Interactive REPL
```

## Key Directories

- `app/Services/Simulation/` — Match simulation engine (the core of the project)
  - `SimulationEngine.php` (1,684 lines) — Tick-based engine using `yield`
  - `MatchState.php` (270 lines) — Game state container
  - `CommentaryBuilder.php` (348 lines) — Event-to-text
- `app/Http/Controllers/Api/` — REST + SSE endpoints
  - `SimulationStreamController.php` — SSE streaming and result persistence
  - `MatchController.php` — Match details + Starting XI lineup endpoints
  - `LeagueController.php` — Standings computed from real W/D/L
- `app/Models/` — 17 Eloquent models
- `database/migrations/` — 28 migrations
- `database/seeders/` — Portuguese league data
- `routes/api.php` — All route definitions

## Database

- SQLite at `database/database.sqlite`
- 64 player attributes in `player_attributes` table (1-20 scale)
- `current_ability` is decimal:2 (not 1-20 like other attributes)
- Formations stored as JSON position arrays in `tactical_positions`
- Match events have `sub_events` JSON column
- `match_lineups` stores Starting XI per match/team

## Simulation Architecture

The simulation engine uses PHP Generators:
```php
public function simulate(GameMatch $match): \Generator
```

Each `yield` produces a tick with: minute, events array, score, possession, ball zone, stats.

Events link causally: `foul -> free_kick`, `shot -> save -> corner`, `cross -> header -> goal`.

Player selection uses weighted attribute lookups (e.g., `finishing` for shots, `tackling` for interceptions).

## SSE Streaming

`POST /api/v1/matches/{match}/simulate-stream` returns `text/event-stream`:
- Named events: `lineup`, `minute`, `goal`, `card`, `half_time`, `full_time`, `error`
- Query param `?speed=fast|normal|slow` controls delay between ticks
- After simulation: score, events, and stats are persisted to DB

## Legacy Code

- `MatchSimulationService.php` (3,245 lines) — Old AI-powered simulation with known bugs
- `OpenAIService.php` — GPT integration for event generation
- These are kept but not used by the new SSE streaming endpoints

## Known Issues to Watch

- `MatchSimulationService` line 1671: `$team->name === $team->name` always true (legacy bug)
- `getContextualPlayer()` in legacy service is dead code
- `$attr->shooting` and `$attr->speed` don't exist — should be `finishing` and `pace`
