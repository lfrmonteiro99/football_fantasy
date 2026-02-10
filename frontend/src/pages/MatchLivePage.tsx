import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type {
  SimulationTick,
  SimulationTickEvent,
  SimulationSpeed,
  SSELineupData,
  TeamMatchStats,
} from '../types';

import { useAppSelector, useAppDispatch } from '../store';
import {
  fetchMatchDetails,
  addTick,
  setLineupData,
  setPhase,
  setSimulationRunning,
  setSimulationError,
  clearSimulation,
} from '../store/matchSlice';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';

// Match components
import Pitch2D from '../components/match/Pitch2D';
import type { Pitch2DPlayer } from '../components/match/Pitch2D';
import LiveStats from '../components/match/LiveStats';
import { tickEventsToTimeline } from '../components/match/EventTimeline';
import { createSimulationStream } from '../api/endpoints';
import { useSequencePlayer } from '../hooks/useSequencePlayer';

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
// Formation position defaults
// ---------------------------------------------------------------------------

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

function buildPlayersFromLineup(lineup: SSELineupData): Pitch2DPlayer[] {
  const players: Pitch2DPlayer[] = [];

  const processTeam = (
    teamData: SSELineupData['home'],
    team: 'home' | 'away',
  ) => {
    const byPosition: Record<string, typeof teamData.starting> = {};
    for (const p of teamData.starting) {
      const pos = p.position || 'CM';
      if (!byPosition[pos]) byPosition[pos] = [];
      byPosition[pos].push(p);
    }

    for (const [pos, group] of Object.entries(byPosition)) {
      const base = POSITION_COORDS[pos] || POSITION_COORDS['CM'];
      const count = group.length;
      const ySpread = count > 1 ? 25 : 0;
      const yStart = base.y - ySpread / 2;
      const yStep = count > 1 ? ySpread / (count - 1) : 0;

      group.forEach((p, idx) => {
        let x = base.x;
        let y = count > 1 ? yStart + yStep * idx : base.y;

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

function applyPossessionShift(
  basePlayers: Pitch2DPlayer[],
  possession: 'home' | 'away' | undefined,
  zone: string | undefined,
): Pitch2DPlayer[] {
  if (!possession || !zone) return basePlayers;

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
      awayShift = -8;
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
    if (p.position === 'GK') return p;
    return {
      ...p,
      x: Math.max(3, Math.min(97, p.x + shift)),
    };
  });
}

// ---------------------------------------------------------------------------
// Speed config
// ---------------------------------------------------------------------------

const SPEEDS: { key: SimulationSpeed; label: string }[] = [
  { key: 'slow', label: 'Slow' },
  { key: 'realtime', label: 'Normal' },
  { key: 'fast', label: 'Fast' },
  { key: 'instant', label: 'Instant' },
];

// Pitch takes ~45% of viewport height; commentary/events share the rest
const PITCH_HEIGHT_CLASS = 'h-[42vh]';

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
  const [speed, setSpeed] = useState<SimulationSpeed>('slow');
  const [localTicks, setLocalTicks] = useState<SimulationTick[]>([]);
  const [localLineup, setLocalLineup] = useState<SSELineupData | null>(null);
  const [localRunning, setLocalRunning] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showFinalOverlay, setShowFinalOverlay] = useState(false);
  const [abortFn, setAbortFn] = useState<(() => void) | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Prefer Redux state, fall back to local
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
      if (abortFn) {
        abortFn();
      }

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

            case 'goal':
            case 'card':
              break;

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
      if (abortFn) abortFn();
    };
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

  // Build pitch players from lineup
  const basePlayers = useMemo(
    () => (lineupData ? buildPlayersFromLineup(lineupData) : []),
    [lineupData],
  );

  const possessionShiftedPlayers = useMemo(
    () =>
      applyPossessionShift(
        basePlayers,
        currentTick?.possession,
        currentTick?.zone,
      ),
    [basePlayers, currentTick?.possession, currentTick?.zone],
  );

  // Fallback ball position based on zone
  const zoneBallRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });
  const zoneBallPosition = useMemo(() => {
    if (!currentTick) return null;
    const zone = currentTick.zone;
    const possession = currentTick.possession;

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

    const pos = { x: bx, y: by };
    zoneBallRef.current = pos;
    return pos;
  }, [currentTick?.zone, currentTick?.possession, currentTick?.minute]);

  // Sequence animation player
  const currentEvents = currentTick?.events ?? [];
  const {
    players: seqPlayers,
    ball: seqBall,
    transitionDurationMs: seqTransition,
    isAnimating: seqAnimating,
    activePlayerId,
  } = useSequencePlayer(
    possessionShiftedPlayers,
    currentEvents,
    currentTick?.minute ?? -1,
    speed !== 'instant',
  );

  const pitchPlayers = seqAnimating ? seqPlayers : possessionShiftedPlayers;
  const ballPosition = seqAnimating && seqBall ? seqBall : zoneBallPosition;
  const pitchTransitionMs = seqAnimating ? seqTransition : 400;

  // Timeline events
  const timelineEvents = useMemo(
    () =>
      tickEventsToTimeline(
        ticks.map((t: SimulationTick) => ({ minute: t.minute, events: t.events })),
      ),
    [ticks],
  );

  const homeColor = currentMatch?.home_team?.primary_color || '#3b82f6';
  const awayColor = currentMatch?.away_team?.primary_color || '#ef4444';

  // Compact stats for the bottom bar
  const compactStats = [
    { label: 'Possession', home: `${homeStats.possession_pct}%`, away: `${awayStats.possession_pct}%` },
    { label: 'Shots', home: String(homeStats.shots), away: String(awayStats.shots) },
    { label: 'On Target', home: String(homeStats.shots_on_target), away: String(awayStats.shots_on_target) },
    { label: 'Corners', home: String(homeStats.corners), away: String(awayStats.corners) },
    { label: 'Fouls', home: String(homeStats.fouls), away: String(awayStats.fouls) },
  ];

  // Phase label for header
  const phaseLabel = phase === 'half_time' ? 'HT' : phase === 'full_time' ? 'FT' : minute <= 45 ? '1st Half' : '2nd Half';

  // ---------------------------------------------------------------------------
  // Render — viewport-fit layout, no vertical scroll
  // Layout: top bar → pitch (fixed height) → commentary left + events right
  // ---------------------------------------------------------------------------

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* ── Row 1: Score Bar + Speed ── */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="bg-gray-800/80 rounded-lg border border-gray-700/40 px-4 py-2 flex items-center gap-4">
          {/* Home */}
          <div className="flex-1 text-right">
            <span className="text-sm font-bold truncate" style={{ color: homeColor }}>
              {homeTeamName}
            </span>
            {homeFormation && (
              <span className="text-[10px] text-gray-500 ml-1 hidden md:inline">({homeFormation})</span>
            )}
          </div>

          {/* Score + Clock */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <span className="text-xl font-extrabold text-white tabular-nums">{homeScore}</span>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] text-gray-500 uppercase">{phaseLabel}</span>
              <span className="text-base font-bold text-white tabular-nums">
                {phase === 'half_time' ? 'HT' : phase === 'full_time' ? 'FT' : `${minute}'`}
              </span>
              {isRunning && phase !== 'half_time' && phase !== 'full_time' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mt-0.5" />
              )}
            </div>
            <span className="text-xl font-extrabold text-white tabular-nums">{awayScore}</span>
          </div>

          {/* Away */}
          <div className="flex-1 text-left">
            <span className="text-sm font-bold truncate" style={{ color: awayColor }}>
              {awayTeamName}
            </span>
            {awayFormation && (
              <span className="text-[10px] text-gray-500 ml-1 hidden md:inline">({awayFormation})</span>
            )}
          </div>

          {/* Speed */}
          <div className="flex-shrink-0 flex items-center gap-1 border-l border-gray-700 pl-3">
            <span className="text-[10px] text-gray-500 mr-1 hidden md:inline">Speed:</span>
            {SPEEDS.map((s) => (
              <button
                key={s.key}
                onClick={() => handleSpeedChange(s.key)}
                disabled={!isRunning && ticks.length > 0}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  speed === s.key
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                } ${!isRunning && ticks.length > 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Pitch (fixed height, no stretch) ── */}
      <div className={`flex-shrink-0 ${PITCH_HEIGHT_CLASS} px-3 py-1`}>
        <div className="h-full bg-gray-800/60 rounded-xl border border-gray-700/40 p-1.5 flex items-center justify-center">
          <Pitch2D
            players={pitchPlayers}
            ball={ballPosition}
            homeColor={homeColor}
            awayColor={awayColor}
            animated={true}
            transitionDurationMs={pitchTransitionMs}
            highlightedPlayerId={activePlayerId}
            className="max-h-full max-w-full"
          />
        </div>
      </div>

      {/* ── Row 3: Compact stats strip ── */}
      <div className="flex-shrink-0 px-3 py-1">
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full bg-gray-800/60 rounded-lg border border-gray-700/40 px-3 py-1 flex items-center justify-between text-[11px] text-gray-400 hover:text-gray-300 transition-colors"
        >
          <div className="flex items-center gap-4">
            {compactStats.slice(0, 4).map((s) => (
              <span key={s.label}>
                <span className="text-white font-medium">{s.home}</span>
                <span className="text-gray-500 mx-1">{s.label}</span>
                <span className="text-white font-medium">{s.away}</span>
              </span>
            ))}
          </div>
          <span className="text-gray-500 flex items-center gap-1">
            {showStats ? 'Hide' : 'Stats'}
            <svg className={`w-3 h-3 transition-transform ${showStats ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
        {showStats && (
          <div className="mt-1 animate-slide-in-up">
            <LiveStats
              homeStats={homeStats}
              awayStats={awayStats}
              homeColor={homeColor}
              awayColor={awayColor}
            />
          </div>
        )}
      </div>

      {/* ── Row 4: Commentary (left) + Key Events (right) — fills remaining space ── */}
      <div className="flex-1 min-h-0 flex gap-2 px-3 pb-2">
        {/* Commentary — left, takes most width */}
        <div className="flex-1 min-w-0 bg-gray-800/80 rounded-xl border border-gray-700/40 p-3 flex flex-col">
          <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 flex-shrink-0">
            Commentary
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1 dark-scrollbar">
            {ticks.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-4">
                Waiting for match to begin...
              </p>
            )}
            {ticks.map((tick: SimulationTick, idx: number) => {
              const isLatest = idx === ticks.length - 1;
              const hasGoal = tick.events.some((e: SimulationTickEvent) => e.type === 'goal');
              const hasCard = tick.events.some(
                (e: SimulationTickEvent) => e.type === 'yellow_card' || e.type === 'red_card',
              );

              let lineClass = 'text-gray-500 text-xs';
              if (isLatest) {
                lineClass = 'text-white text-xs font-semibold';
              } else if (hasGoal) {
                lineClass = 'text-green-400 text-xs font-medium';
              } else if (hasCard) {
                lineClass = 'text-yellow-400 text-xs';
              }

              return (
                <div key={`${tick.minute}-${idx}`} className={`${lineClass} leading-relaxed py-0.5`}>
                  <span className="text-gray-400 font-mono text-[10px] mr-1.5 inline-block w-7 text-right">
                    {tick.minute}'
                  </span>
                  <span>{tick.commentary}</span>
                </div>
              );
            })}
            <CommentaryAnchor ticks={ticks} />
          </div>
        </div>

        {/* Key Events — right, fixed width */}
        <div className="w-56 lg:w-64 flex-shrink-0 bg-gray-800/80 rounded-xl border border-gray-700/40 p-3 flex flex-col">
          <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 flex-shrink-0">
            Key Events
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 dark-scrollbar">
            {timelineEvents.length === 0 ? (
              <p className="text-gray-500 text-[11px] text-center py-3">No key events yet</p>
            ) : (
              timelineEvents.map((ev, idx) => {
                const isHome = ev.team === 'home';
                const icon = ev.type === 'goal' ? '\u26BD' : ev.type === 'yellow_card' ? '\uD83D\uDFE8' : ev.type === 'red_card' ? '\uD83D\uDFE5' : ev.type === 'substitution' ? '\uD83D\uDD04' : '\u25CF';
                return (
                  <div key={`${ev.minute}-${ev.type}-${idx}`} className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-400 font-mono w-5 text-right flex-shrink-0">{ev.minute}'</span>
                    <span>{icon}</span>
                    <span className={`truncate ${isHome ? 'text-white' : 'text-gray-300'}`}>
                      {ev.playerName || 'Unknown'}
                    </span>
                  </div>
                );
              })
            )}
            <KeyEventsAnchor events={timelineEvents} />
          </div>
        </div>
      </div>

      {/* Error display */}
      {simError && (
        <div className="fixed bottom-3 left-3 right-3 z-30">
          <div className="bg-red-900/90 border border-red-700 rounded-xl p-3 text-red-300 flex items-center gap-3 backdrop-blur-sm">
            <p className="text-xs flex-1">{simError}</p>
            <Button variant="danger" size="sm" onClick={() => startSimulation(speed)}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Full-time overlay */}
      {showFinalOverlay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800/95 rounded-2xl border border-gray-700/50 p-8 max-w-md w-full mx-4 text-center shadow-2xl animate-slide-in-up">
            <h2 className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Full Time</h2>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-sm font-semibold" style={{ color: homeColor }}>{homeTeamName}</span>
            </div>
            <div className="flex items-center justify-center gap-4 mb-1">
              <span className="text-5xl font-extrabold text-white">{homeScore}</span>
              <span className="text-2xl text-gray-500">-</span>
              <span className="text-5xl font-extrabold text-white">{awayScore}</span>
            </div>
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-sm font-semibold" style={{ color: awayColor }}>{awayTeamName}</span>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(`/match/${matchId}/result`)}
                className="w-full"
              >
                View Full Result
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFinalOverlay(false)}
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Continue Watching
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {ticks.length === 0 && isRunning && !simError && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-gray-800/95 rounded-2xl border border-gray-700/50 p-6 flex flex-col items-center gap-3 shadow-2xl">
            <Spinner color="white" />
            <p className="text-gray-300 text-xs">Preparing match simulation...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Auto-scroll anchor for commentary
const CommentaryAnchor: React.FC<{ ticks: SimulationTick[] }> = ({ ticks }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticks.length]);
  return <div ref={ref} />;
};

// Auto-scroll anchor for key events
const KeyEventsAnchor: React.FC<{ events: { minute: number }[] }> = ({ events }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);
  return <div ref={ref} />;
};

export default MatchLivePage;
