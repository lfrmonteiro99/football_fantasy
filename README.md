# Football Fantasy Manager

A football (soccer) management simulation game. Pick a team, set your tactics and formation, select your starting XI, and watch matches unfold in real time with event-by-event streaming.

Built with a **Laravel API** backend and **React TypeScript** frontend, connected via **Server-Sent Events (SSE)** for live match simulation.

## Quick Start (Docker)

```bash
./docker.sh
```

Open **http://localhost:3000**. That's it.

No PHP, Node.js, or Composer needed locally. Only Docker.

The container automatically installs dependencies, creates the database, runs migrations, and seeds it with Portuguese league teams (18 teams, 28 players each, full attribute sets).

### Docker Commands

| Command | Description |
|---------|-------------|
| `./docker.sh` | Build and start everything |
| `./docker.sh stop` | Stop all containers |
| `./docker.sh restart` | Rebuild and restart |
| `./docker.sh logs` | Follow all logs |
| `./docker.sh logs api` | Follow API logs only |
| `./docker.sh reset` | Fresh database (migrate + seed) |
| `./docker.sh rebuild` | Full rebuild, no cache |
| `./docker.sh status` | Show running containers |

## Local Development

Requires PHP 8.1+, Node.js 16+, and Composer (or Docker as fallback for Composer).

```bash
./setup.sh          # First-time: install deps, create .env, migrate, seed
./start.sh          # Start API + Frontend in background
./stop.sh           # Stop all services
./dev.sh            # Dev mode with live reload (separate terminals)
./status.sh         # Check service status
./restart.sh        # Stop + start
```

Or manually in two terminals:

```bash
# Terminal 1 - API (port 8000)
cd api && composer install && php artisan migrate && php artisan db:seed && php artisan serve

# Terminal 2 - Frontend (port 3000)
cd frontend && npm install && npm start
```

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Nginx proxy (Docker only) | http://localhost:80 |

## Features

### Team Management
- Select a team to manage from the Portuguese league
- View full squad with detailed player attributes (64 attributes per player, 1-20 scale)
- Attribute radar charts for individual player analysis

### Tactics & Formation
- Drag-and-drop formation editor (4-4-2, 4-3-3, 3-5-2, etc.)
- Tactical settings: mentality, defensive line, pressing, passing style
- Create and save multiple tactical presets
- Assign players to positions

### Match Day
- **Starting XI selection** - pick your 11 starters and bench, swap players
- **Live match simulation** - events stream in real time via SSE
- **2D pitch visualization** - ball position and player zones update each minute
- **Event timeline** - goals, cards, substitutions, fouls as they happen
- **Live stats** - possession, shots, passes updated per tick
- **Commentary feed** - contextual match commentary

### Match Simulation Engine
The simulation engine (`api/app/Services/Simulation/`) produces realistic football matches:

- **Tick-based**: one game tick per match minute, streamed via SSE
- **Causal event chains**: foul -> free kick, shot -> save -> corner, cross -> header -> goal
- **Attribute-driven**: player selection based on 64 attributes (finishing, tackling, reflexes, pace, etc.)
- **Fatigue model**: player stamina degrades over the match, affects performance
- **Cards & discipline**: yellow/red cards with suspensions
- **Substitutions**: 5-sub cap, tactical replacements
- **Set pieces**: corners, free kicks, penalties with realistic outcomes

### League
- Full standings table computed from match results (W/D/L/GF/GA/GD/Pts)
- Last 5 match form indicator
- Match calendar with schedule and results

## Architecture

```
football_fantasy/
  api/                              # Laravel API (PHP 8.4)
    app/
      Http/Controllers/Api/         #   REST endpoints + SSE streaming
      Models/                       #   Eloquent models
      Services/Simulation/          #   Match simulation engine
        SimulationEngine.php        #     Core tick-based engine (Generator/yield)
        MatchState.php              #     Mutable game state
        CommentaryBuilder.php       #     Event-to-text templates
    database/
      migrations/                   #   Schema definitions
      seeders/                      #   Portuguese league data
    docker-entrypoint.sh            #   Container startup (deps, migrate, seed, serve)
  frontend/                         # React TypeScript
    src/
      api/                          #   Axios client + 60+ typed endpoint functions
      components/
        match/                      #   Pitch2D, EventTimeline, ScoreBar, LiveStats
        squad/                      #   PlayerList, PlayerDetail, AttributeRadar
        tactics/                    #   PitchEditor (drag-drop), TacticSettings
        layout/                     #   AppLayout, Sidebar, Header
      hooks/                        #   useMatchSimulation (SSE), useAuth, useGameTime
      pages/                        #   9 pages (Login thru MatchResult)
      store/                        #   Redux Toolkit slices
      types/                        #   TypeScript interfaces (1,100+ lines)
  docker-compose.yml                # API + Frontend + Nginx
  docker.sh                         # One-command Docker launcher
  setup.sh / start.sh / stop.sh     # Local dev scripts
  nginx.conf                        # Reverse proxy with SSE support
```

## API Endpoints

### Teams & Players
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/teams` | List all teams |
| GET | `/api/v1/teams/{id}` | Team details |
| GET | `/api/v1/teams/{id}/players` | Team squad with attributes |

### Tactics & Formations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/formations` | Available formations |
| GET | `/api/v1/teams/{id}/tactics` | Team tactics |
| POST | `/api/v1/tactics` | Create tactic |
| PUT | `/api/v1/tactics/{id}` | Update tactic |

### Matches & Simulation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/matches` | Match list |
| GET | `/api/v1/matches/{id}` | Match details |
| GET | `/api/v1/matches/{id}/lineup` | Get/auto-suggest lineup |
| PUT | `/api/v1/matches/{id}/lineup` | Save starting XI |
| POST | `/api/v1/matches/{id}/simulate-stream` | **SSE** live simulation |
| GET | `/api/v1/matches/{id}/simulate-instant` | Full simulation as JSON |

### League
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/leagues/{id}/standings` | Standings with form |

SSE event types: `lineup`, `minute`, `goal`, `card`, `half_time`, `full_time`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Laravel 10, PHP 8.4, SQLite |
| Frontend | React 18, TypeScript, Redux Toolkit |
| Styling | Tailwind CSS |
| Match Streaming | Server-Sent Events (SSE) |
| Formation Editor | @dnd-kit (drag-and-drop) |
| Charts | Recharts (player attribute radar) |
| Routing | React Router v6 |
| Containers | Docker, Docker Compose, Nginx |

## Database

SQLite with seeded data:
- 18 Portuguese league teams
- 28 players per team (504 total)
- 64 attributes per player (1-20 scale)
- Formations, tactics, match events, lineups

Reset the database:
```bash
./docker.sh reset                           # Docker
cd api && ./rollback_and_migrate.sh         # Local
```

## Troubleshooting

### Services won't start
```bash
./status.sh                 # Check what's running
./stop.sh                   # Kill existing processes
./start.sh                  # Restart
```

### Database issues
```bash
./docker.sh reset                                   # Docker
cd api && php artisan migrate:fresh --seed           # Local
```

### Docker build fails
```bash
./docker.sh rebuild         # Full rebuild, no cache
```

### View logs
```bash
./docker.sh logs            # Docker (all services)
./docker.sh logs api        # Docker (API only)
tail -f logs/api.log        # Local
tail -f logs/frontend.log   # Local
```
