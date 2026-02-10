# CLAUDE.md — Frontend

Instructions for Claude Code when working in the `/frontend` directory.

## Commands

```bash
npm start                           # Dev server on port 3000 (proxies API to :8000)
npm run build                       # Production build
npm test                            # Jest + Testing Library
npx tsc --noEmit                    # Type-check without emitting
```

## Key Files

- `src/types/index.ts` (1,100+ lines) — **All** TypeScript interfaces. Read this first to understand the data model.
- `src/api/endpoints.ts` (650+ lines) — Every API call. Uses typed return values.
- `src/api/client.ts` — Axios instance with Bearer token from localStorage and 401 redirect.
- `src/hooks/useMatchSimulation.ts` — SSE EventSource lifecycle. This is how live matches work.
- `src/store/index.ts` — Redux store setup. Exports typed `useAppDispatch` and `useAppSelector`.

## Architecture Patterns

### State Management
- Redux Toolkit with `createSlice` and `createAsyncThunk`
- 6 slices: `auth`, `team`, `match`, `league`, `tactics`, `gameTime`
- Always use `useAppDispatch` (from `store/index.ts`), not plain `useDispatch` — it's typed for async thunks

### API Calls
- Standard CRUD: Redux async thunks in slice files
- SSE streaming: raw EventSource via `useMatchSimulation` hook (not Redux)
- All endpoint functions in `src/api/endpoints.ts` return typed promises

### Routing
- React Router v6 with `<Outlet>` in `AppLayout`
- Protected routes: `AppLayout` checks auth, redirects to `/login` if not logged in
- Match routes: `/matches/:id/preview`, `/matches/:id/live`, `/matches/:id/result`

### Styling
- Tailwind CSS utility classes everywhere
- Custom colors in `tailwind.config.js`: `pitch-green`, `brand`
- Match screens use dark backgrounds (`bg-gray-900`)
- No CSS modules or styled-components

## Component Patterns

### Match Components (`src/components/match/`)
- `Pitch2D` — SVG football pitch with ball position dot and player zone overlays
- `EventTimeline` — Vertical timeline of key events (goals, cards). Has a `tickEventsToTimeline()` helper.
- `ScoreBar` — Score display with team crests and colors
- `LiveStats` — Side-by-side stat bars (possession, shots, etc.)
- `CommentaryFeed` — Scrolling text commentary
- `MatchClock` — Current minute display

### Tactics Components (`src/components/tactics/`)
- `PitchEditor` — Drag-and-drop SVG pitch using `@dnd-kit`. Players are draggable on pitch positions.
- `TacticSettings` — Sliders for mentality, defensive line, pressing, width, tempo
- `PlayerCard` — Small card showing player name, position, rating

### Squad Components (`src/components/squad/`)
- `PlayerList` — Filterable/sortable player table
- `PlayerDetail` — Full player info modal with attribute breakdown
- `AttributeRadar` — Recharts radar chart for player attributes

## TypeScript Notes

- TypeScript 4.9 (not 5.x) due to react-scripts 5.0.1 peer dependency
- All callback params in `.map()` / `.findIndex()` on `any`-typed arrays need explicit type annotations
- `FormationPosition.position` is `PositionAbbreviation` type, not `string` — cast when creating
- `MatchLineup` type annotations needed on callbacks over lineup arrays (TS strict mode)

## SSE Event Types

The simulation stream emits these named events:
- `lineup` — Team lineups at start (home/away starters + bench)
- `minute` — One tick per match minute (events, score, possession, stats)
- `goal` — Goal scored (duplicate of data in minute, for easy filtering)
- `card` — Yellow/red card
- `half_time` — Half time whistle
- `full_time` — Final whistle with complete match stats
- `error` — Simulation error
