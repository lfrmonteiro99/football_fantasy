# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Football Fantasy Manager is a full-stack application with a Laravel API backend (`/api`) and React TypeScript frontend (`/frontend`) for managing football fantasy leagues, teams, players, and AI-powered match simulations.

## Project Structure

- **Backend**: Laravel API in `/api/` directory
- **Frontend**: React TypeScript in `/frontend/` directory

## Development Commands

### Backend (Laravel API)
```bash
cd api
composer install                    # Install dependencies
php artisan migrate                 # Run migrations
php artisan db:seed                 # Seed database with Portuguese teams/formations
php artisan serve                   # Start dev server (port 8000)
./rollback_and_migrate.sh          # Reset database completely
php artisan test                    # Run PHPUnit tests
composer run dev                    # Start all services (server, queue, logs, vite)
```

### Frontend (React)
```bash
cd frontend
npm install                         # Install dependencies
npm start                          # Start dev server (port 3000)
npm test                           # Run Jest tests
npm run build                      # Production build
```

## Architecture

### Backend Structure
- **API**: RESTful endpoints under `/api/v1`
- **Services**: `MatchSimulationService` (AI-powered), `OpenAIService` (GPT integration)
- **Models**: League, Team, Player, Formation, Tactic, Match, MatchEvent
- **Database**: SQLite with comprehensive football domain schema

### Frontend Structure
- **State Management**: Redux Toolkit with slices for leagues, teams, players, matches, formations
- **API Client**: Centralized Axios service in `src/services/api.ts`
- **Styling**: Tailwind CSS with component-based architecture

## Key Features

### Match Simulation
AI-powered match simulation using OpenAI API with fallback to rule-based simulation:
- `POST /api/v1/matches/{id}/simulate` - Generate realistic match events
- `POST /api/v1/matches/{id}/regenerate-events` - Regenerate match commentary

### Core Domain
- Teams have formations (4-4-2, 4-3-3, etc.) and tactics (Attacking, Defensive, etc.)
- Players have positions and attributes affecting match simulation
- Matches generate events (goals, cards, substitutions) with timestamps and descriptions

## Development Notes

### Database Management
- Use `./rollback_and_migrate.sh` to completely reset database and reseed
- Seeders populate Portuguese league teams, formations, and tactical positions
- SQLite database stored in `api/database/database.sqlite`

### API Integration
- Frontend uses Redux for state management with async thunks for API calls
- Backend validates formations and tactics relationships
- Match simulation requires valid team lineups and formations

### Testing
- Backend: PHPUnit tests for models and services
- Frontend: Jest + Testing Library for components
- Run tests before major changes to ensure simulation logic works correctly