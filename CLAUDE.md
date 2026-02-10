# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Football Fantasy Manager is a full-stack application with a Laravel API backend (`/api`) and React TypeScript frontend (`/frontend`) for managing football fantasy leagues, teams, players, and match simulations with real-time SSE streaming.

## Project Structure

- **Backend**: Laravel API in `/api/` directory
- **Frontend**: React TypeScript in `/frontend/` directory

## Running the Project

### Quick Start (root scripts)
```bash
./setup.sh                          # First-time setup: installs deps, creates .env, migrates & seeds DB
./start.sh                          # Start all services in background (API + Frontend), logs in ./logs/
./stop.sh                           # Stop all running services
./restart.sh                        # Stop + start
./dev.sh                            # Start in dev mode (opens separate terminals with live reload)
./status.sh                         # Check which services are running
```

After starting, open `http://localhost:3000`. The frontend proxies API requests to `localhost:8000`.

### Manual Start (two terminals)

**Terminal 1 — Backend (port 8000):**
```bash
cd api
composer install                    # Install dependencies
php artisan migrate                 # Run migrations
php artisan db:seed                 # Seed database with Portuguese teams/formations
php artisan serve                   # Start dev server (port 8000)
```

**Terminal 2 — Frontend (port 3000):**
```bash
cd frontend
npm install                         # Install dependencies
npm start                           # Start dev server (port 3000)
```

### Docker
```bash
docker-compose up                   # Start all services (API, Frontend, Redis, RabbitMQ, Nginx)
```

### Other Commands
```bash
# Backend
cd api
./rollback_and_migrate.sh           # Reset database completely (migrate + reseed)
php artisan test                    # Run PHPUnit tests
composer run dev                    # Start all services (server, queue, logs, vite)

# Frontend
cd frontend
npm run build                       # Production build
npm test                            # Run Jest tests
npx tsc --noEmit                    # Type-check without building
```

## Architecture

### Backend Structure
- **API**: RESTful endpoints under `/api/v1`
- **Simulation Engine**: `app/Services/Simulation/` — tick-based match engine (replaces old fallback)
  - `SimulationEngine.php` — Core engine using PHP Generator (`yield`) to produce one tick per match minute
  - `MatchState.php` — Mutable game state (score, lineups, fatigue, cards, ball position, stats)
  - `CommentaryBuilder.php` — Event-to-text commentary templates
- **SSE Controller**: `app/Http/Controllers/Api/SimulationStreamController.php`
  - `POST /api/v1/matches/{match}/simulate-stream?speed=fast` — SSE streaming endpoint
  - `GET /api/v1/matches/{match}/simulate-instant` — Full JSON response (non-streaming)
- **Legacy Services**: `MatchSimulationService` (AI-powered), `OpenAIService` (GPT integration)
- **Models**: League, Team, Player, Formation, Tactic, GameMatch, MatchEvent, MatchLineup
- **Database**: SQLite with comprehensive football domain schema

### Frontend Structure
- **State Management**: Redux Toolkit with slices (`auth`, `team`, `match`, `league`, `tactics`, `gameTime`)
- **API Client**: Axios instance in `src/api/client.ts` with Bearer token interceptor; 60+ typed endpoint functions in `src/api/endpoints.ts`
- **SSE Client**: `src/hooks/useMatchSimulation.ts` — EventSource lifecycle for live match streaming
- **Types**: `src/types/index.ts` — All TypeScript interfaces for API entities
- **Styling**: Tailwind CSS with custom pitch-green palette
- **Routing**: React Router v6 with nested routes and protected layout

### Frontend Pages
| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Team selection / authentication |
| Dashboard | `/` | Overview of managed team |
| Squad | `/squad` | Player list, detail view, attribute radar chart |
| Tactics | `/tactics` | Formation editor (drag-and-drop), tactic settings |
| Match Preview | `/matches/:id/preview` | Starting XI selection, lineup swaps |
| Match Live | `/matches/:id/live` | Real-time match simulation via SSE |
| Match Result | `/matches/:id/result` | Post-match summary and stats |
| League Table | `/league` | Standings (W/D/L/GF/GA/GD/Pts) |
| Calendar | `/calendar` | Match schedule and results |

## Key Features

### Match Simulation (New Engine)
Tick-based simulation engine with causal event chains and SSE streaming:
- Events link causally (foul → free_kick, shot → save → corner)
- Player selection driven by 64 attributes (finishing, tackling, reflexes, etc.)
- Fatigue model, yellow/red cards, 5-substitution cap
- SSE named events: `lineup`, `minute`, `goal`, `card`, `half_time`, `full_time`

### Starting XI Selection
- `GET /api/v1/matches/{match}/lineup` — Returns lineup or auto-suggests from formation
- `PUT /api/v1/matches/{match}/lineup` — Save starting XI (validates 11 starters, 1 GK)

### League Standings
- Computed from actual completed match results (W/D/L/GF/GA/GD/Pts)
- Sorted by: points DESC, goal difference DESC, goals for DESC
- Includes last 5 match form (W/D/L array)

### Core Domain
- Teams have formations (4-4-2, 4-3-3, etc.) and tactics (Attacking, Defensive, etc.)
- Players have positions and 64 attributes (1-20 scale) affecting match simulation
- Matches generate events (goals, cards, substitutions) with timestamps and descriptions
- Match results and stats persisted to database after simulation

## Development Notes

### Database Management
- Use `./rollback_and_migrate.sh` to completely reset database and reseed
- Seeders populate Portuguese league teams (28 players each), formations, and tactical positions
- SQLite database stored in `api/database/database.sqlite`
- `match_lineups` table stores Starting XI selections per match/team
- `match_events` table has `sub_events` JSON column for detailed event data

### API Integration
- Frontend proxy: `package.json` has `"proxy": "http://localhost:8000"` so API calls from the React dev server are forwarded automatically
- Frontend uses Redux async thunks for standard CRUD, and raw EventSource for SSE streaming
- Backend validates formations, tactics relationships, and lineup constraints

### Testing
- Backend: PHPUnit tests for models and services
- Frontend: Jest + Testing Library for components
- Type-check: `npx tsc --noEmit` in frontend directory
- Run tests before major changes to ensure simulation logic works correctly
