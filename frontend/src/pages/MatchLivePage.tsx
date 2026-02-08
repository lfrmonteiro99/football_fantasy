import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type {
  SimulationTick,
  SimulationSpeed,
  SSELineupData,
  MatchStats,
  TeamMatchStats,
} from '../types';

// ---------------------------------------------------------------------------
// Imports from other engineers — with local stubs if missing at compile-time
// ---------------------------------------------------------------------------

// Redux hooks — try real import, fall back to inline stubs
let useAppSelector: any;
let useAppDispatch: any;
try {
  const storeImport = require('../store');
  useAppSelector = storeImport.useAppSelector;
  useAppDispatch = storeImport.useAppDispatch;
} catch {
  // Minimal stubs so the file compiles even when store doesn't exist yet
  useAppSelector = (selector: any) => selector({
    match: {
      currentMatch: null,
      simulation: {
        isRunning: false,
        currentTick: null,
        ticks: [],
        lineupData: null,
        finalScore: null,
        finalStats: null,
        error: null,
      },
      loading: 'idle',
      error: null,
    },
  });
  useAppDispatch = () => (action: any) => action;
}

// matchSlice actions — stub safe
let fetchMatchDetails: any = (id: number) => ({ type: 'match/fetchDetails', payload: id });
let addTick: any = (tick: any) => ({ type: 'match/addTick', payload: tick });
let setLineupData: any = (data: any) => ({ type: 'match/setLineupData', payload: data });
let setPhase: any = (phase: any) => ({ type: 'match/setPhase', payload: phase });
let setSimulationRunning: any = (running: boolean) => ({ type: 'match/setSimulationRunning', payload: running });
let setSimulationError: any = (err: string | null) => ({ type: 'match/setSimulationError', payload: err });
let clearSimulation: any = () => ({ type: 'match/clearSimulation' });

try {
  const matchSlice = require('../store/matchSlice');
  fetchMatchDetails = matchSlice.fetchMatchDetails ?? fetchMatchDetails;
  addTick = matchSlice.addTick ?? addTick;
  setLineupData = matchSlice.setLineupData ?? setLineupData;
  setPhase = matchSlice.setPhase ?? setPhase;
  setSimulationRunning = matchSlice.setSimulationRunning ?? setSimulationRunning;
  setSimulationError = matchSlice.setSimulationError ?? setSimulationError;
  clearSimulation = matchSlice.clearSimulation ?? clearSimulation;
} catch {
  // keep stubs
}

// Simulation hook — stub safe
let useMatchSimulation: any;
try {
  useMatchSimulation = require('../hooks/useMatchSimulation').useMatchSimulation;
} catch {
  // Provide a no-op hook stub
  useMatchSimulation = () => ({
    start: (_matchId: number, _speed: SimulationSpeed) => {},
    stop: () => {},
    isActive: false,
  });
}

// Common components — stub safe
let Button: React.FC<any>;
let Spinner: React.FC<any>;
try {
  Button = require('../components/common/Button').Button;
} catch {
  Button = ({ children, onClick, className, disabled }: any) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  );
}
try {
  Spinner = require('../components/common/Spinner').Spinner;
} catch {
  Spinner = () => <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />;
}

// Match components (from this engineer)
import Pitch2D from '../components/match/Pitch2D';
import type { Pitch2DPlayer } from '../components/match/Pitch2D';
import ScoreBar from '../components/match/ScoreBar';
import MatchClock from '../components/match/MatchClock';
import LiveStats from '../components/match/LiveStats';
import EventTimeline from '../components/match/EventTimeline';
import { tickEventsToTimeline } from '../components/match/EventTimeline';
import CommentaryFeed from '../components/match/CommentaryFeed';
import { createSimulationStream } from '../api/endpoints';

// ---------------------------------------------------------------------------
// Default / empty stats
// ---------------------------------------------------------------------------

const EMPTY_STATS: TeamMatchStats = {
  possession_pct: 50,
  shots: 0,
  shots_on_target: 0,
  corners: 0,
  fouls: 0,
  yellow_cards: 0,
  red_cards: 0,
  saves: 0,
  passes: 0,
  tackles: 0,
  offsides: 0,
};

// ---------------------------------------------------------------------------
// Formation position defaults (for generating Pitch2D players from lineup)
// ---------------------------------------------------------------------------

/**
 * Default x/y coordinates per position abbreviation on a 0-100 grid.
 * Home team attacks left-to-right, away attacks right-to-left.
 */
const POSITION_COORDS: Record<string, { x: number; y: number }> = {
  GK: { x: 8, y: 50 },
  CB: { x: 25, y: 50 },
  LB: { x: 22, y: 15 },
  RB: { x: 22, y: 85 },
  LWB: { x: 30, y: 10 },
  RWB: { x: 30, y: 90 },
  WB: { x: 30, y: 50 },
  SW: { x: 20, y: 50 },
  DM: { x: 38, y: 50 },
  CM: { x: 50, y: 50 },
  AM: { x: 62, y: 50 },
  LM: { x: 50, y: 15 },
  RM: { x: 50, y: 85 },
  LW: { x: 70, y: 15 },
  RW: { x: 70, y: 85 },
  ST: { x: 80, y: 50 },
  CF: { x: 78, y: 50 },
  F9: { x: 75, y: 50 },
};

/**
 * Build Pitch2DPlayer[] from SSE lineup data.
 * Spreads multiple players in the same position across y-axis.
 */
function buildPlayersFromLineup(
  lineup: SSELineupData,
): Pitch2DPlayer[] {
  const players: Pitch2DPlayer[] = [];

  const processTeam = (
    teamData: SSELineupData['home'],
    team: 'home' | 'away',
  ) => {
    // Group by position to spread duplicates
    const byPosition: Record<string, typeof teamData.starting> = {};
    for (const p of teamData.starting) {
      const pos = p.position || 'CM';
      if (!byPosition[pos]) byPosition[pos] = [];
      byPosition[pos].push(p);
    }

    for (const [pos, group] of Object.entries(byPosition)) {
      const base = POSITION_COORDS[pos] || POSITION_COORDS['CM'];
      const count = group.length;
      // Spread along y axis
      const ySpread = count > 1 ? 25 : 0;
      const yStart = base.y - ySpread / 2;
      const yStep = count > 1 ? ySpread / (count - 1) : 0;

      group.forEach((p, idx) => {
        let x = base.x;
        let y = count > 1 ? yStart + yStep * idx : base.y;

        // Mirror for away team (right-to-left)
        if (team === 'away') {
          x = 100 - x;
          y = 100 - y;
        }

        players.push({
          id: p.player_id,
          name: p.name,
          shirtNumber: p.shirt_number ?? 0,
          x,
          y,
          team,
          position: pos,
        });
      });
    }
  };

  processTeam(lineup.home, 'home');
  processTeam(lineup.away, 'away');

  return players;
}

/**
 * Apply possession-based positional shift.
 * Shifts players forward/backward based on who has the ball and where.
 */
function applyPossessionShift(
  basePlayers: Pitch2DPlayer[],
  possession: 'home' | 'away' | undefined,
  zone: string | undefined,
): Pitch2DPlayer[] {
  if (!possession || !zone) return basePlayers;

  // Determine shift magnitude
  let homeShift = 0;
  let awayShift = 0;

  if (possession === 'home') {
    if (zone.includes('att')) {
      homeShift = 8;
      awayShift = -3;
    } else if (zone.includes('mid')) {
      homeShift = 3;
      awayShift = -1;
    } else {
      homeShift = -3;
      awayShift = 5;
    }
  } else {
    if (zone.includes('att')) {
      homeShift = 5;
      awayShift = -8; // away attacking = away players mirrored forward
    } else if (zone.includes('mid')) {
      homeShift = 1;
      awayShift = -3;
    } else {
      homeShift = -5;
      awayShift = 3;
    }
  }

  return basePlayers.map((p) => {
    const shift = p.team === 'home' ? homeShift : -awayShift;
    // Don't shift GK
    if (p.position === 'GK') return p;
    return {
      ...p,
      x: Math.max(3, Math.min(97, p.x + shift)),
    };
  });
}

// ---------------------------------------------------------------------------
// MatchLivePage Component
// ---------------------------------------------------------------------------

const MatchLivePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const matchId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const currentMatch = useAppSelector((s: any) => s.match?.currentMatch);
  const simulation = useAppSelector((s: any) => s.match?.simulation) ?? {
    isRunning: false,
    currentTick: null as SimulationTick | null,
    ticks: [] as SimulationTick[],
    lineupData: null as SSELineupData | null,
    finalScore: null,
    finalStats: null,
    error: null,
  };

  // Local state
  const [speed, setSpeed] = useState<SimulationSpeed>('fast');
  const [localTicks, setLocalTicks] = useState<SimulationTick[]>([]);
  const [localLineup, setLocalLineup] = useState<SSELineupData | null>(null);
  const [localRunning, setLocalRunning] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showFinalOverlay, setShowFinalOverlay] = useState(false);
  const [abortFn, setAbortFn] = useState<(() => void) | null>(null);

  // Prefer Redux state, but fall back to local state if Redux isn't wired
  const ticks = simulation.ticks?.length > 0 ? simulation.ticks : localTicks;
  const lineupData = simulation.lineupData ?? localLineup;
  const isRunning = simulation.isRunning || localRunning;
  const simError = simulation.error ?? localError;

  const currentTick = ticks.length > 0 ? ticks[ticks.length - 1] : null;

  // Fetch match details on mount
  useEffect(() => {
    if (matchId && !currentMatch) {
      dispatch(fetchMatchDetails(matchId));
    }
  }, [matchId, currentMatch, dispatch]);

  // Start simulation
  const startSimulation = useCallback(
    async (selectedSpeed: SimulationSpeed) => {
      // Abort existing stream
      if (abortFn) {
        abortFn();
      }

      // Clear previous simulation state
      setLocalTicks([]);
      setLocalError(null);
      setShowFinalOverlay(false);
      setLocalRunning(true);

      try {
        dispatch(clearSimulation());
        dispatch(setSimulationRunning(true));
      } catch {
        // Redux might not be connected
      }

      const { stream, abort } = createSimulationStream(matchId, selectedSpeed);
      setAbortFn(() => abort);

      try {
        for await (const frame of stream()) {
          const { event, data } = frame;

          switch (event) {
            case 'lineup': {
              const lineupPayload = data as SSELineupData;
              setLocalLineup(lineupPayload);
              try { dispatch(setLineupData(lineupPayload)); } catch { /* noop */ }
              break;
            }

            case 'minute': {
              const tick = data as SimulationTick;
              setLocalTicks((prev) => [...prev, tick]);
              try { dispatch(addTick(tick)); } catch { /* noop */ }
              break;
            }

            case 'goal': {
              // Goals are also part of 'minute' ticks — no separate handling needed.
              // The tick's events array contains the goal event.
              break;
            }

            case 'card': {
              // Cards are also embedded in tick events.
              break;
            }

            case 'half_time': {
              try { dispatch(setPhase('half_time')); } catch { /* noop */ }
              break;
            }

            case 'full_time': {
              setShowFinalOverlay(true);
              setLocalRunning(false);
              try {
                dispatch(setPhase('full_time'));
                dispatch(setSimulationRunning(false));
              } catch { /* noop */ }
              break;
            }

            case 'error': {
              const errData = data as { message: string };
              setLocalError(errData.message);
              setLocalRunning(false);
              try {
                dispatch(setSimulationError(errData.message));
                dispatch(setSimulationRunning(false));
              } catch { /* noop */ }
              break;
            }

            default:
              break;
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          const msg = err.message || 'Simulation stream failed';
          setLocalError(msg);
          try { dispatch(setSimulationError(msg)); } catch { /* noop */ }
        }
      } finally {
        setLocalRunning(false);
        try { dispatch(setSimulationRunning(false)); } catch { /* noop */ }
      }
    },
    [matchId, abortFn, dispatch],
  );

  // Auto-start on mount
  useEffect(() => {
    startSimulation(speed);

    return () => {
      // Cleanup: abort on unmount
      if (abortFn) abortFn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle speed change
  const handleSpeedChange = useCallback(
    (newSpeed: SimulationSpeed) => {
      setSpeed(newSpeed);
      startSimulation(newSpeed);
    },
    [startSimulation],
  );

  // Build derived data
  const homeTeamName = lineupData?.home?.team_name ?? currentMatch?.home_team?.name ?? 'Home';
  const awayTeamName = lineupData?.away?.team_name ?? currentMatch?.away_team?.name ?? 'Away';
  const homeFormation = lineupData?.home?.formation ?? currentMatch?.home_formation?.name;
  const awayFormation = lineupData?.away?.formation ?? currentMatch?.away_formation?.name;

  const homeScore = currentTick?.score?.home ?? 0;
  const awayScore = currentTick?.score?.away ?? 0;
  const minute = currentTick?.minute ?? 0;
  const phase = currentTick?.phase ?? 'kickoff';

  const homeStats: TeamMatchStats = currentTick?.stats?.home ?? EMPTY_STATS;
  const awayStats: TeamMatchStats = currentTick?.stats?.away ?? EMPTY_STATS;

  // Build pitch players
  const basePlayers = useMemo(
    () => (lineupData ? buildPlayersFromLineup(lineupData) : []),
    [lineupData],
  );

  const pitchPlayers = useMemo(
    () =>
      applyPossessionShift(
        basePlayers,
        currentTick?.possession,
        currentTick?.zone,
      ),
    [basePlayers, currentTick?.possession, currentTick?.zone],
  );

  // Ball position based on zone
  const ballPosition = useMemo(() => {
    if (!currentTick) return null;
    const zone = currentTick.zone;
    const possession = currentTick.possession;

    // Map zone to rough ball position
    let bx = 50;
    let by = 50;

    if (zone?.includes('att') && possession === 'home') {
      bx = 75;
      by = 40 + Math.random() * 20;
    } else if (zone?.includes('att') && possession === 'away') {
      bx = 25;
      by = 40 + Math.random() * 20;
    } else if (zone?.includes('def') && possession === 'home') {
      bx = 25;
      by = 35 + Math.random() * 30;
    } else if (zone?.includes('def') && possession === 'away') {
      bx = 75;
      by = 35 + Math.random() * 30;
    } else {
      bx = 45 + Math.random() * 10;
      by = 35 + Math.random() * 30;
    }

    return { x: bx, y: by };
  }, [currentTick?.zone, currentTick?.possession, currentTick?.minute]);

  // Timeline events
  const timelineEvents = useMemo(
    () =>
      tickEventsToTimeline(
        ticks.map((t) => ({ minute: t.minute, events: t.events })),
      ),
    [ticks],
  );

  const homeColor = currentMatch?.home_team?.primary_color || '#3b82f6';
  const awayColor = currentMatch?.away_team?.primary_color || '#ef4444';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Score Bar */}
      <div className="px-4 pt-4">
        <ScoreBar
          homeTeam={homeTeamName}
          awayTeam={awayTeamName}
          homeScore={homeScore}
          awayScore={awayScore}
          homeFormation={homeFormation}
          awayFormation={awayFormation}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      </div>

      {/* Main grid layout */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: Pitch */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-3">
              <Pitch2D
                players={pitchPlayers}
                ball={ballPosition}
                homeColor={homeColor}
                awayColor={awayColor}
                animated={true}
              />
            </div>
          </div>

          {/* Right column: Clock, Stats, Timeline */}
          <div className="space-y-4">
            {/* Clock */}
            <div className="bg-gray-800 rounded-lg">
              <MatchClock
                minute={minute}
                phase={phase}
                isRunning={isRunning}
              />
            </div>

            {/* Live Stats */}
            <LiveStats
              homeStats={homeStats}
              awayStats={awayStats}
              homeColor={homeColor}
              awayColor={awayColor}
            />

            {/* Event Timeline */}
            <EventTimeline events={timelineEvents} />
          </div>
        </div>
      </div>

      {/* Commentary Feed */}
      <div className="px-4 pb-4">
        <CommentaryFeed ticks={ticks} />
      </div>

      {/* Speed Controls */}
      <div className="px-4 pb-6">
        <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center gap-3">
          <span className="text-sm text-gray-400 mr-2">Speed:</span>
          {(['realtime', 'fast', 'instant'] as SimulationSpeed[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                disabled={!isRunning && ticks.length > 0}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  speed === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } ${
                  !isRunning && ticks.length > 0
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {s === 'realtime'
                  ? 'Realtime'
                  : s === 'fast'
                    ? 'Fast'
                    : 'Instant'}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Error display */}
      {simError && (
        <div className="px-4 pb-4">
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
            <p className="font-semibold">Simulation Error</p>
            <p className="text-sm mt-1">{simError}</p>
            <button
              onClick={() => startSimulation(speed)}
              className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm text-white"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Full-time overlay */}
      {showFinalOverlay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-400 uppercase tracking-wider mb-4">
              Full Time
            </h2>
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="text-xl font-semibold" style={{ color: homeColor }}>
                {homeTeamName}
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="text-6xl font-extrabold text-white">
                {homeScore}
              </span>
              <span className="text-3xl text-gray-500">-</span>
              <span className="text-6xl font-extrabold text-white">
                {awayScore}
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-xl font-semibold" style={{ color: awayColor }}>
                {awayTeamName}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate(`/match/${matchId}/result`)}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-semibold transition-colors"
              >
                View Full Result
              </button>
              <button
                onClick={() => setShowFinalOverlay(false)}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 font-medium transition-colors"
              >
                Continue Watching
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state — before any ticks arrive */}
      {ticks.length === 0 && isRunning && !simError && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-xl p-6 flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-gray-300 text-sm">Preparing match simulation...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchLivePage;
