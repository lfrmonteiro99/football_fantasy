# Football Fantasy Manager — Frontend

React TypeScript frontend for Football Fantasy Manager. Manages teams, tactics, formations, and displays live match simulations via SSE streaming.

## Quick Start

### With Docker (from project root)
```bash
./docker.sh
```
Frontend is built and served via nginx on port 3000.

### Local
```bash
npm install
npm start                           # http://localhost:3000
```

The dev server proxies `/api` requests to `http://localhost:8000` (configured in `package.json`).

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Select a team to manage |
| Dashboard | `/` | Team overview, upcoming matches, recent results |
| Squad | `/squad` | Player list with search/filter, detail view, attribute radar chart |
| Tactics | `/tactics` | Formation editor (drag-and-drop), tactic settings (sliders) |
| Match Preview | `/matches/:id/preview` | Starting XI selection, bench swaps |
| Match Live | `/matches/:id/live` | Real-time simulation via SSE |
| Match Result | `/matches/:id/result` | Post-match summary, stats, events |
| League Table | `/league` | Standings (W/D/L/GF/GA/GD/Pts), form |
| Calendar | `/calendar` | Season schedule and results |

## Project Structure

```
src/
  api/
    client.ts                       # Axios instance, Bearer token interceptor, 401 redirect
    endpoints.ts                    # 60+ typed API functions + createSimulationStream() SSE
  components/
    common/                         # Button, Card, Badge, Modal, Spinner
    layout/                         # AppLayout (protected), Sidebar, Header
    match/                          # Pitch2D (SVG), EventTimeline, ScoreBar, LiveStats,
                                    #   CommentaryFeed, MatchClock
    squad/                          # PlayerList, PlayerDetail, AttributeRadar (recharts)
    tactics/                        # PitchEditor (dnd-kit drag-drop), TacticSettings, PlayerCard
  hooks/
    useAuth.ts                      # Auth state helper
    useMatchSimulation.ts           # SSE EventSource lifecycle for live matches
    useGameTime.ts                  # In-game time management
  pages/                            # 9 page components (one per route)
  store/
    index.ts                        # Redux store + typed useAppDispatch/useAppSelector
    authSlice.ts                    # Login, logout, profile
    teamSlice.ts                    # Squad, tactics fetch
    matchSlice.ts                   # Match details, simulation state
    leagueSlice.ts                  # Standings
    tacticsSlice.ts                 # Formations, tactic CRUD
    gameTimeSlice.ts                # Game date management
  types/
    index.ts                        # 1,100+ lines of TypeScript interfaces for all API entities
  utils/
    constants.ts                    # Position colors, formation defaults
    helpers.ts                      # Formatting helpers (currency, dates, etc.)
  App.tsx                           # Router setup with nested routes
  index.tsx                         # Entry point, Redux Provider, Toaster
  index.css                         # Tailwind imports + base styles
public/
  index.html                       # SPA shell
```

## Key Libraries

| Library | Purpose |
|---------|---------|
| React 18 | UI framework |
| TypeScript 4.9 | Type safety |
| Redux Toolkit | State management (slices + async thunks) |
| React Router v6 | Routing with nested layouts |
| Axios | HTTP client with interceptors |
| Tailwind CSS | Utility-first styling |
| @dnd-kit | Drag-and-drop formation editor |
| Recharts | Player attribute radar charts |
| react-hot-toast | Toast notifications |
| date-fns | Date formatting |
| clsx | Conditional class names |

## SSE Match Streaming

The `useMatchSimulation` hook (`src/hooks/useMatchSimulation.ts`) manages the EventSource lifecycle:

1. Opens SSE connection to `POST /api/v1/matches/{id}/simulate-stream`
2. Listens for named events: `lineup`, `minute`, `goal`, `card`, `half_time`, `full_time`
3. Accumulates ticks in state, updates live pitch/stats/timeline
4. Cleans up EventSource on unmount or abort

The `createSimulationStream()` helper in `endpoints.ts` wraps the raw EventSource creation.

## Commands

```bash
npm start                           # Dev server on port 3000
npm run build                       # Production build
npm test                            # Jest tests
npx tsc --noEmit                    # Type-check without building
```

## Styling

Tailwind CSS with custom palette defined in `tailwind.config.js`:
- `pitch-green` — Primary green tones for football pitch UI
- `brand` — Accent colors
- Dark backgrounds for match day screens
- Responsive layout with sidebar navigation
