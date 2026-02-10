# Football Fantasy Manager — API

Laravel REST API powering the Football Fantasy Manager. Handles team/player management, tactics, match simulation with SSE streaming, and league standings.

## Quick Start

### With Docker (from project root)
```bash
./docker.sh
```
The API container handles everything automatically (deps, .env, migrations, seed).

### Local
```bash
composer install
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan db:seed
php artisan serve                   # http://localhost:8000
```

### Reset Database
```bash
./rollback_and_migrate.sh           # migrate:fresh + seed
```

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login (select team) |
| POST | `/auth/logout` | Logout |
| GET | `/auth/profile` | Current user profile |
| GET | `/auth/available-teams` | Teams available to manage |

### Teams & Players
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teams` | List all teams |
| GET | `/teams/{id}` | Team details with players |
| GET | `/teams/{id}/players` | Squad with full attributes |
| GET | `/players/{id}` | Player details |

### Formations & Tactics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/formations` | Available formations |
| GET | `/formations/{id}` | Formation details + positions |
| GET | `/teams/{id}/tactics` | Team's assigned tactics |
| POST | `/tactics` | Create tactic |
| PUT | `/tactics/{id}` | Update tactic |
| POST | `/teams/{id}/tactics/assign` | Assign tactic to team |

### Matches
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/matches/{id}` | Match details |
| GET | `/matches/league` | League matches |
| GET | `/matches/upcoming` | Upcoming matches |
| GET | `/matches/{id}/lineup` | Get lineup (or auto-suggest) |
| PUT | `/matches/{id}/lineup` | Save starting XI |

### Match Simulation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/matches/{id}/simulate-stream` | **SSE** real-time simulation |
| GET | `/matches/{id}/simulate-instant` | Full simulation as JSON |

SSE named events: `lineup`, `minute`, `goal`, `card`, `half_time`, `full_time`, `error`

Query params for SSE: `?speed=fast` (default), `?speed=normal`, `?speed=slow`

### League
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leagues` | List leagues |
| GET | `/leagues/{id}/standings` | Standings (W/D/L/GF/GA/GD/Pts + form) |

## Project Structure

```
app/
  Http/Controllers/Api/
    AuthController.php              # Login, profile, team selection
    TeamController.php              # Team CRUD
    PlayerController.php            # Player CRUD
    FormationController.php         # Formations + positions
    TacticController.php            # Tactics CRUD + assignment
    MatchController.php             # Match details, lineup selection
    SimulationStreamController.php  # SSE streaming + instant simulation
    LeagueController.php            # Standings from real match results
  Models/
    Team, Player, PlayerAttribute, Formation, Tactic,
    TacticalPosition, GameMatch, MatchEvent, MatchLineup,
    League, Season, User
  Services/
    Simulation/
      SimulationEngine.php          # Core tick-based engine (1,684 lines)
      MatchState.php                # Mutable game state container
      CommentaryBuilder.php         # Event-to-text templates
    MatchSimulationService.php      # Legacy AI-powered simulation
    OpenAIService.php               # Legacy OpenAI integration
database/
  migrations/                       # 28 migration files
  seeders/                          # Portuguese league teams + players
routes/
  api.php                           # All API route definitions
docker-entrypoint.sh                # Container startup script
```

## Simulation Engine

The new simulation engine (`app/Services/Simulation/`) replaces the legacy AI-powered simulation:

- **SimulationEngine.php** — PHP Generator (`yield`) producing one tick per match minute
- **MatchState.php** — Tracks score, lineups, per-player fatigue/cards/goals, ball position, stats
- **CommentaryBuilder.php** — Converts events to natural language commentary

Key features:
- Causal event chains (foul -> free kick -> goal)
- Player selection driven by 64 attributes
- Fatigue model degrading performance over time
- Yellow/red cards with discipline tracking
- 5-substitution cap
- Set pieces (corners, free kicks, penalties)

## Database

SQLite. Seeded with:
- 18 Portuguese league teams
- 28 players per team (504 total)
- 64 attributes per player (1-20 scale): finishing, tackling, reflexes, pace, etc.
- Formations with position coordinates
- `match_lineups` — Starting XI selections per match/team
- `match_events` — Events with `sub_events` JSON column

## Testing

```bash
php artisan test
```

## Environment

Key `.env` variables:
```
DB_CONNECTION=sqlite
DB_DATABASE=./database/database.sqlite
QUEUE_CONNECTION=sync
OPENAI_API_KEY=                     # Optional — simulation works without it
```
