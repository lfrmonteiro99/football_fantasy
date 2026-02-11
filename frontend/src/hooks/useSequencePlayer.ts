import { useState, useEffect, useRef, useCallback } from 'react';
import type { Pitch2DPlayer } from '../components/match/Pitch2D';
import type { SimulationTickEvent, SequenceStep } from '../types';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

interface QueuedStep {
  step: SequenceStep;
  scaledDurationMs: number;
  eventTeam: 'home' | 'away';
}

export interface BallTrail {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  team: 'home' | 'away';
  createdAt: number; // Date.now()
}

export interface EventOverlay {
  type: 'goal_flash' | 'yellow_card' | 'red_card' | 'foul_marker';
  x: number;
  y: number;
  playerId?: number;
  createdAt: number;
}

export interface SequencePlayerResult {
  players: Pitch2DPlayer[];
  ball: { x: number; y: number } | null;
  ballHeight: number; // 0=ground, 0-1 scale for aerial balls
  ballTransitionMs: number; // separate from player transition
  ballCarrierId: number | null;
  transitionDurationMs: number;
  isAnimating: boolean;
  activePlayerId: number | null;
  trails: BallTrail[];
  overlays: EventOverlay[];
  directionVectors: Map<number, { dx: number; dy: number; speed: number }>;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------
const MIN_STEP_MS = 250;
const MAX_TOTAL_MS = 2500;
const DRIFT_BACK_MS = 800;
const CELEBRATION_HOLD_MS = 1500;
const CELEBRATION_RUN_MS = 800;
const CELEBRATION_CLUSTER_MS = 2000;
const SET_PIECE_SETUP_MS = 800;      // longer setup for set pieces (was 300)
const SET_PIECE_REFORM_MS = 1200;    // slower reform after set pieces

const ACTOR_PULL = 1.0;
const RECEIVER_PULL = 0.85;
const TEAMMATE_PULL = 0.15;
const OPPONENT_PULL = 0.20;          // raised from 0.08 for visible defense
const TEAMMATE_RADIUS = 40;
const OPPONENT_RADIUS = 40;          // raised from 30

// Off-the-ball movement
const OFF_BALL_DRIFT_X = 3;     // max x-drift per tick for zone shifts
const OFF_BALL_JITTER_Y = 1.2;  // max y-jitter per tick
const DEFENSIVE_LINE_SYNC = 0.7; // how tightly defenders sync x-position

// Idle animation (sub-tick)
const IDLE_INTERVAL_MS = 350;
const IDLE_MAX_DRIFT = 1.0;

// Positional memory
const POSITION_MEMORY_BLEND = 0.4; // 40% back toward formation each tick

// Trail
const MAX_TRAILS = 5;
const TRAIL_LIFETIME_MS = 2500;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function lerp(
  current: { x: number; y: number },
  target: { x: number; y: number },
  strength: number,
) {
  return {
    x: clamp(current.x + (target.x - current.x) * strength, 1, 99),
    y: clamp(current.y + (target.y - current.y) * strength, 1, 99),
  };
}

/** Deterministic pseudo-random based on seed (no Math.random). */
function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x); // 0..1
}

function getActorTarget(step: SequenceStep): { x: number; y: number } {
  switch (step.action) {
    case 'shoot':
    case 'header':
      return step.ball_start;
    case 'save':
      return step.ball_end;
    case 'tackle':
    case 'foul':
      return step.ball_start;
    case 'clearance':
      return step.ball_start;
    default:
      return step.ball_end;
  }
}

// ---------------------------------------------------------------------------
// Ball speed by action type
// ---------------------------------------------------------------------------

function getBallTransitionMs(step: SequenceStep, playerDurationMs: number): number {
  const d = dist(step.ball_start, step.ball_end);
  const action = step.action;
  const height = (step as any).ball_height as string | undefined;

  if (action === 'shoot' || action === 'header') {
    return Math.max(120, Math.min(280, d * 4)); // fast
  }
  if (action === 'clearance') {
    return Math.max(150, Math.min(350, d * 5));
  }
  if (action === 'cross' || height === 'high' || height === 'lofted') {
    return Math.max(400, Math.min(700, d * 10)); // slow, arcing
  }
  if (action === 'dribble' || action === 'run') {
    return playerDurationMs; // ball moves with player
  }
  // pass
  if (d < 20) return Math.max(180, Math.min(350, d * 12)); // short pass, fast
  return Math.max(350, Math.min(600, d * 8)); // long pass
}

/** Compute ball height (0-1) for the current progress through an aerial step. */
function computeBallHeight(
  step: SequenceStep,
  progress: number, // 0..1 through the step
): number {
  const action = step.action;
  const height = (step as any).ball_height as string | undefined;
  const d = dist(step.ball_start, step.ball_end);

  const isAerial =
    action === 'cross' ||
    action === 'clearance' ||
    action === 'header' ||
    height === 'high' ||
    height === 'lofted' ||
    (action === 'pass' && d > 25);

  if (!isAerial) return 0;

  // Parabolic arc: peaks at progress=0.5
  const arc = 4 * progress * (1 - progress); // 0 at start/end, 1 at midpoint
  const maxHeight = Math.min(1.0, d * 0.015); // taller for longer distances
  return arc * maxHeight;
}

// ---------------------------------------------------------------------------
// Set-piece position overrides
// ---------------------------------------------------------------------------

type SetPieceType = 'corner' | 'penalty' | 'free_kick';

function detectSetPiece(
  events: SimulationTickEvent[],
): { type: SetPieceType; team: 'home' | 'away' } | null {
  for (const ev of events) {
    if (ev.type === 'corner' || ev.type === 'penalty' || ev.type === 'free_kick') {
      return { type: ev.type as SetPieceType, team: ev.team };
    }
  }
  return null;
}

function getInvolvedIds(events: SimulationTickEvent[]): Set<number> {
  const ids = new Set<number>();
  for (const ev of events) {
    if (ev.primary_player_id) ids.add(ev.primary_player_id);
    for (const step of ev.sequence || []) {
      ids.add(step.actor_id);
      if (step.target_id) ids.add(step.target_id);
    }
  }
  return ids;
}

function applySetPiecePositioning(
  players: Pitch2DPlayer[],
  events: SimulationTickEvent[],
): Pitch2DPlayer[] {
  const setPiece = detectSetPiece(events);
  if (!setPiece) return players;

  const { type, team: attackTeam } = setPiece;
  const involvedIds = getInvolvedIds(events);
  const goalX = attackTeam === 'home' ? 95 : 5;
  const dir = attackTeam === 'home' ? -1 : 1;

  if (type === 'corner') {
    const cornerEvent = events.find((e) => e.type === 'corner');
    const cornerY = cornerEvent?.sequence?.[0]?.ball_end?.y ?? 50;
    const isNearSide = cornerY > 50;
    let atkIdx = 0;
    let defIdx = 0;

    const atkPositions = [
      { x: goalX + dir * 4, y: isNearSide ? 40 : 60 },
      { x: goalX + dir * 4, y: 50 },
      { x: goalX + dir * 6, y: isNearSide ? 55 : 45 },
      { x: goalX + dir * 6, y: isNearSide ? 35 : 65 },
      { x: goalX + dir * 8, y: 50 },
      { x: goalX + dir * 10, y: isNearSide ? 60 : 40 },
      { x: goalX + dir * 14, y: 50 },
      { x: goalX + dir * 14, y: isNearSide ? 40 : 60 },
      { x: 50, y: 30 },
      { x: 50, y: 70 },
    ];
    const defPositions = [
      { x: goalX + dir * 3, y: isNearSide ? 42 : 58 },
      { x: goalX + dir * 3, y: 50 },
      { x: goalX + dir * 5, y: isNearSide ? 53 : 47 },
      { x: goalX + dir * 5, y: isNearSide ? 37 : 63 },
      { x: goalX + dir * 7, y: 50 },
      { x: goalX + dir * 9, y: isNearSide ? 58 : 42 },
      { x: goalX + dir * 12, y: 48 },
      { x: goalX + dir * 12, y: 52 },
      { x: goalX + dir * 22, y: 50 },
      { x: 50, y: 50 },
    ];

    return players.map((p) => {
      if (involvedIds.has(p.id)) return p;
      if (p.position === 'GK') {
        if (p.team !== attackTeam) {
          return { ...p, x: goalX + dir * 1, y: isNearSide ? 44 : 56 };
        }
        return p;
      }
      if (p.team === attackTeam) {
        const pos = atkPositions[Math.min(atkIdx++, atkPositions.length - 1)];
        return { ...p, x: clamp(pos.x, 3, 97), y: clamp(pos.y, 5, 95) };
      } else {
        const pos = defPositions[Math.min(defIdx++, defPositions.length - 1)];
        return { ...p, x: clamp(pos.x, 3, 97), y: clamp(pos.y, 5, 95) };
      }
    });
  }

  if (type === 'penalty') {
    const penSpotX = attackTeam === 'home' ? 88 : 12;
    return players.map((p) => {
      if (involvedIds.has(p.id)) return p;
      if (p.position === 'GK') {
        if (p.team !== attackTeam)
          return { ...p, x: goalX + dir * -1, y: 50 };
        return p;
      }
      const arcX = penSpotX + dir * 8;
      const spreadY = 25 + (p.id % 10) * 5;
      return { ...p, x: clamp(arcX, 20, 80), y: clamp(spreadY, 15, 85) };
    });
  }

  if (type === 'free_kick') {
    const fkEvent = events.find((e) => e.type === 'free_kick');
    const fkPos = fkEvent?.coordinates ?? { x: 50, y: 50 };
    const distToGoal = Math.abs(fkPos.x - goalX);
    const isAttackingThird = distToGoal < 35;

    let atkIdx = 0;
    let defIdx = 0;

    if (isAttackingThird) {
      const wallX = fkPos.x + dir * -9;
      const atkPositions = [
        { x: goalX + dir * 8, y: 40 },
        { x: goalX + dir * 8, y: 60 },
        { x: goalX + dir * 5, y: 45 },
        { x: goalX + dir * 5, y: 55 },
        { x: goalX + dir * 12, y: 35 },
        { x: goalX + dir * 12, y: 65 },
        { x: 50, y: 40 },
        { x: 50, y: 60 },
        { x: 50, y: 50 },
        { x: 50, y: 30 },
      ];
      const defWallPositions = [
        { x: wallX, y: fkPos.y - 4 },
        { x: wallX, y: fkPos.y - 2 },
        { x: wallX, y: fkPos.y },
        { x: wallX, y: fkPos.y + 2 },
        { x: goalX + dir * 6, y: 42 },
        { x: goalX + dir * 6, y: 58 },
        { x: goalX + dir * 10, y: 48 },
        { x: goalX + dir * 10, y: 52 },
        { x: goalX + dir * 18, y: 50 },
        { x: 50, y: 50 },
      ];

      return players.map((p) => {
        if (involvedIds.has(p.id)) return p;
        if (p.position === 'GK') {
          if (p.team !== attackTeam)
            return { ...p, x: goalX + dir * 1, y: 48 };
          return p;
        }
        if (p.team === attackTeam) {
          const pos =
            atkPositions[Math.min(atkIdx++, atkPositions.length - 1)];
          return { ...p, x: clamp(pos.x, 3, 97), y: clamp(pos.y, 5, 95) };
        } else {
          const pos =
            defWallPositions[
              Math.min(defIdx++, defWallPositions.length - 1)
            ];
          return { ...p, x: clamp(pos.x, 3, 97), y: clamp(pos.y, 5, 95) };
        }
      });
    } else {
      // Midfield FK: opponents retreat 10 yards, teammates spread
      return players.map((p) => {
        if (involvedIds.has(p.id)) return p;
        if (p.position === 'GK') return p;

        if (p.team !== attackTeam) {
          // Opponents retreat 10 units from ball
          const d = dist(p, fkPos);
          if (d < 10) {
            const angle = Math.atan2(p.y - fkPos.y, p.x - fkPos.x);
            return {
              ...p,
              x: clamp(fkPos.x + Math.cos(angle) * 10, 3, 97),
              y: clamp(fkPos.y + Math.sin(angle) * 10, 5, 95),
            };
          }
        } else {
          // Attackers: two short options flanking the ball
          const d = dist(p, fkPos);
          if (d < 15 && atkIdx < 2) {
            atkIdx++;
            const offset = atkIdx === 1 ? -8 : 8;
            return {
              ...p,
              x: clamp(fkPos.x + dir * -5, 3, 97),
              y: clamp(fkPos.y + offset, 5, 95),
            };
          }
        }
        return p;
      });
    }
  }

  return players;
}

// ---------------------------------------------------------------------------
// Directional support runs (spread into lanes instead of converging)
// ---------------------------------------------------------------------------

function computeSupportTarget(
  player: Pitch2DPlayer,
  ballStart: { x: number; y: number },
  ballEnd: { x: number; y: number },
  eventTeam: 'home' | 'away',
): { x: number; y: number } {
  // Movement direction of the ball
  const dx = ballEnd.x - ballStart.x;
  const dy = ballEnd.y - ballStart.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular vector (normalized)
  const perpX = -dy / len;
  const perpY = dx / len;

  // Determine which side of the ball path the player is on
  const relY = player.y - ballEnd.y;
  const side = relY > 0 ? 1 : -1;

  // Offset: 8-12 units perpendicular, 3-6 units forward
  const forwardOffset = 4 + (player.id % 5); // deterministic per player
  const lateralOffset = 8 + (player.id % 7);

  // Forward direction: toward attacking goal
  const fwdDir = eventTeam === 'home' ? 1 : -1;

  return {
    x: clamp(
      ballEnd.x + dx / len * forwardOffset * fwdDir + perpX * lateralOffset * side,
      3, 97,
    ),
    y: clamp(
      ballEnd.y + dy / len * forwardOffset * fwdDir + perpY * lateralOffset * side,
      5, 95,
    ),
  };
}

// ---------------------------------------------------------------------------
// Directional defensive reactions
// ---------------------------------------------------------------------------

function computeDefensiveTarget(
  player: Pitch2DPlayer,
  ballEnd: { x: number; y: number },
): { x: number; y: number } {
  // Defenders slide between ball and their own goal
  const ownGoalX = player.team === 'home' ? 5 : 95;
  return {
    x: (ballEnd.x + ownGoalX) / 2,
    y: (ballEnd.y + player.y) / 2,
  };
}

// ---------------------------------------------------------------------------
// Off-the-ball movement (applied every tick regardless of events)
// ---------------------------------------------------------------------------

function applyOffBallMovement(
  players: Pitch2DPlayer[],
  zone: string | undefined,
  possession: 'home' | 'away' | undefined,
  minute: number,
): Pitch2DPlayer[] {
  if (!zone || !possession) return players;

  // Compute defensive line x per team
  const homeDefenders = players.filter(
    (p) => p.team === 'home' && ['CB', 'LB', 'RB', 'SW', 'WB', 'LWB', 'RWB'].includes(p.position || ''),
  );
  const awayDefenders = players.filter(
    (p) => p.team === 'away' && ['CB', 'LB', 'RB', 'SW', 'WB', 'LWB', 'RWB'].includes(p.position || ''),
  );

  const homeDefLineX =
    homeDefenders.length > 0
      ? homeDefenders.reduce((s, p) => s + p.x, 0) / homeDefenders.length
      : 25;
  const awayDefLineX =
    awayDefenders.length > 0
      ? awayDefenders.reduce((s, p) => s + p.x, 0) / awayDefenders.length
      : 75;

  // Zone-based line adjustments
  let homeLineTarget = homeDefLineX;
  let awayLineTarget = awayDefLineX;

  if (zone.includes('att') && possession === 'home') {
    homeLineTarget += 5;
    awayLineTarget -= 3;
  } else if (zone.includes('att') && possession === 'away') {
    homeLineTarget -= 3;
    awayLineTarget -= 5;
  } else if (zone.includes('def') && possession === 'home') {
    homeLineTarget -= 3;
    awayLineTarget += 5;
  } else if (zone.includes('def') && possession === 'away') {
    homeLineTarget += 5;
    awayLineTarget -= 3;
  }

  return players.map((p) => {
    if (p.position === 'GK') return p;

    const seed = minute * 1000 + p.id;
    const jitterY = (pseudoRand(seed) - 0.5) * 2 * OFF_BALL_JITTER_Y;

    const isDefender = ['CB', 'LB', 'RB', 'SW', 'WB', 'LWB', 'RWB'].includes(p.position || '');
    const isMidfielder = ['DM', 'CM', 'AM', 'LM', 'RM'].includes(p.position || '');
    const isForward = ['ST', 'CF', 'F9', 'LW', 'RW'].includes(p.position || '');

    let newX = p.x;
    let newY = p.y + jitterY;

    if (isDefender) {
      // Defensive line: sync x positions
      const lineTarget = p.team === 'home' ? homeLineTarget : awayLineTarget;
      newX = p.x + (lineTarget - p.x) * DEFENSIVE_LINE_SYNC;
    } else if (isMidfielder) {
      // Midfield: shift toward ball zone
      const zoneTarget = zone.includes('att')
        ? (p.team === possession ? OFF_BALL_DRIFT_X : -OFF_BALL_DRIFT_X)
        : zone.includes('def')
          ? (p.team === possession ? -OFF_BALL_DRIFT_X * 0.5 : OFF_BALL_DRIFT_X)
          : 0;
      const dir = p.team === 'home' ? 1 : -1;
      newX = p.x + zoneTarget * dir;
    } else if (isForward) {
      // Forwards: drift toward goal when attacking
      if (p.team === possession && zone.includes('att')) {
        const goalDir = p.team === 'home' ? 1 : -1;
        newX = p.x + OFF_BALL_DRIFT_X * 0.8 * goalDir;
      }
    }

    return {
      ...p,
      x: clamp(newX, 3, 97),
      y: clamp(newY, 5, 95),
    };
  });
}

// ---------------------------------------------------------------------------
// Core step application
// ---------------------------------------------------------------------------

function applyStep(
  players: Pitch2DPlayer[],
  step: SequenceStep,
  eventTeam: 'home' | 'away',
): Pitch2DPlayer[] {
  const ballEnd = step.ball_end;
  const ballStart = step.ball_start;
  const targetId = (step as any).target_id as number | undefined;

  return players.map((p) => {
    // Actor: move to action target (100%)
    if (p.id === step.actor_id) {
      const target = getActorTarget(step);
      const pos = lerp({ x: p.x, y: p.y }, target, ACTOR_PULL);
      return { ...p, x: pos.x, y: pos.y };
    }

    // Receiver: move toward ball_end (85%)
    if (targetId && p.id === targetId) {
      const pos = lerp({ x: p.x, y: p.y }, ballEnd, RECEIVER_PULL);
      return { ...p, x: pos.x, y: pos.y };
    }

    // Teammates: support runs into LANES (not at ball)
    if (p.team === eventTeam && p.position !== 'GK') {
      const d = dist(p, ballEnd);
      if (d < TEAMMATE_RADIUS) {
        const strength = TEAMMATE_PULL * (1 - d / TEAMMATE_RADIUS);
        const target = computeSupportTarget(p, ballStart, ballEnd, eventTeam);
        const pos = lerp({ x: p.x, y: p.y }, target, strength);
        return { ...p, x: pos.x, y: pos.y };
      }
    }

    // Opponents: shift between ball and own goal (directional)
    if (p.team !== eventTeam && p.position !== 'GK') {
      const d = dist(p, ballEnd);
      if (d < OPPONENT_RADIUS) {
        const strength = OPPONENT_PULL * (1 - d / OPPONENT_RADIUS);
        const target = computeDefensiveTarget(p, ballEnd);
        const pos = lerp({ x: p.x, y: p.y }, target, strength);
        return { ...p, x: pos.x, y: pos.y };
      }
    }

    return p;
  });
}

// ---------------------------------------------------------------------------
// Goal celebration synthetic steps
// ---------------------------------------------------------------------------

function buildCelebrationQueue(
  events: SimulationTickEvent[],
  currentPositions: Pitch2DPlayer[],
): QueuedStep[] | null {
  const goalEvent = events.find((e) => e.type === 'goal');
  if (!goalEvent) return null;

  const scorerId = goalEvent.primary_player_id;
  if (!scorerId) return null;

  // Synthetic "hold" step — all positions stay, long duration
  const scorerPos =
    currentPositions.find((p) => p.id === scorerId) ?? currentPositions[0];
  const holdStep: QueuedStep = {
    step: {
      action: 'run',
      actor_id: scorerId,
      actor_name: goalEvent.primary_player_name || '',
      ball_start: { x: scorerPos.x, y: scorerPos.y },
      ball_end: { x: 50, y: 50 },
      duration_ms: CELEBRATION_HOLD_MS,
    },
    scaledDurationMs: CELEBRATION_HOLD_MS,
    eventTeam: goalEvent.team,
  };

  // Synthetic "run to center" step
  const runStep: QueuedStep = {
    step: {
      action: 'run',
      actor_id: scorerId,
      actor_name: goalEvent.primary_player_name || '',
      ball_start: { x: 50, y: 50 },
      ball_end: { x: 50, y: 45 },
      duration_ms: CELEBRATION_RUN_MS,
    },
    scaledDurationMs: CELEBRATION_RUN_MS,
    eventTeam: goalEvent.team,
  };

  // Synthetic "cluster" step — teammates converge
  const clusterStep: QueuedStep = {
    step: {
      action: 'run',
      actor_id: scorerId,
      actor_name: goalEvent.primary_player_name || '',
      ball_start: { x: 50, y: 45 },
      ball_end: { x: 50, y: 45 },
      duration_ms: CELEBRATION_CLUSTER_MS,
    },
    scaledDurationMs: CELEBRATION_CLUSTER_MS,
    eventTeam: goalEvent.team,
  };

  return [holdStep, runStep, clusterStep];
}

// ---------------------------------------------------------------------------
// Direction vector computation
// ---------------------------------------------------------------------------

function computeDirectionVectors(
  prevPositions: Pitch2DPlayer[],
  currentPositions: Pitch2DPlayer[],
): Map<number, { dx: number; dy: number; speed: number }> {
  const map = new Map<number, { dx: number; dy: number; speed: number }>();
  const prevMap = new Map(prevPositions.map((p) => [p.id, p]));

  for (const p of currentPositions) {
    const prev = prevMap.get(p.id);
    if (prev) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const speed = Math.sqrt(dx * dx + dy * dy);
      if (speed > 0.5) {
        const len = speed || 1;
        map.set(p.id, { dx: dx / len, dy: dy / len, speed });
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSequencePlayer(
  basePlayers: Pitch2DPlayer[],
  currentEvents: SimulationTickEvent[],
  tickCounter: number,
  enabled: boolean = true,
  zone?: string,
  possession?: 'home' | 'away',
  minute?: number,
): SequencePlayerResult {
  const [animState, setAnimState] = useState<{
    players: Pitch2DPlayer[];
    ball: { x: number; y: number } | null;
    ballHeight: number;
    ballTransitionMs: number;
    ballCarrierId: number | null;
    transitionMs: number;
    isAnimating: boolean;
    activePlayerId: number | null;
    trails: BallTrail[];
    overlays: EventOverlay[];
    directionVectors: Map<number, { dx: number; dy: number; speed: number }>;
  }>({
    players: basePlayers,
    ball: null,
    ballHeight: 0,
    ballTransitionMs: 400,
    ballCarrierId: null,
    transitionMs: 400,
    isAnimating: false,
    activePlayerId: null,
    trails: [],
    overlays: [],
    directionVectors: new Map(),
  });

  const queueRef = useRef<QueuedStep[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionsRef = useRef<Pitch2DPlayer[]>(basePlayers);
  const prevPositionsRef = useRef<Pitch2DPlayer[]>(basePlayers);
  const lastTickRef = useRef(-1);
  const basePlayersRef = useRef(basePlayers);
  const trailsRef = useRef<BallTrail[]>([]);
  const overlaysRef = useRef<EventOverlay[]>([]);
  const hadSetPieceRef = useRef(false);
  const lastEventsRef = useRef<SimulationTickEvent[]>([]);

  // Zone/possession/minute refs for idle and off-ball
  const zoneRef = useRef(zone);
  const possessionRef = useRef(possession);
  const minuteRef = useRef(minute ?? 0);
  zoneRef.current = zone;
  possessionRef.current = possession;
  minuteRef.current = minute ?? 0;

  // Stop idle animation
  const stopIdle = useCallback(() => {
    if (idleIntervalRef.current) {
      clearInterval(idleIntervalRef.current);
      idleIntervalRef.current = null;
    }
  }, []);

  // Start idle animation (sub-tick jostling)
  const startIdle = useCallback(() => {
    stopIdle();
    let idleTick = 0;
    idleIntervalRef.current = setInterval(() => {
      idleTick++;
      const current = positionsRef.current;
      const jostled = current.map((p) => {
        if (p.position === 'GK') return p;
        const seed = idleTick * 100 + p.id;
        const jx = (pseudoRand(seed) - 0.5) * 2 * IDLE_MAX_DRIFT;
        const jy = (pseudoRand(seed + 999) - 0.5) * 2 * IDLE_MAX_DRIFT;
        return {
          ...p,
          x: clamp(p.x + jx, 3, 97),
          y: clamp(p.y + jy, 5, 95),
        };
      });
      positionsRef.current = jostled;
      setAnimState((prev) => ({
        ...prev,
        players: jostled,
        transitionMs: IDLE_INTERVAL_MS,
      }));
    }, IDLE_INTERVAL_MS);
  }, [stopIdle]);

  // Keep basePlayers ref fresh
  useEffect(() => {
    basePlayersRef.current = basePlayers;
    if (!animState.isAnimating) {
      // Positional memory: blend last animated positions toward new base
      const blended = basePlayers.map((bp) => {
        const prev = positionsRef.current.find((pp) => pp.id === bp.id);
        if (prev) {
          return {
            ...bp,
            x: clamp(
              prev.x + (bp.x - prev.x) * POSITION_MEMORY_BLEND,
              1, 99,
            ),
            y: clamp(
              prev.y + (bp.y - prev.y) * POSITION_MEMORY_BLEND,
              1, 99,
            ),
          };
        }
        return bp;
      });
      positionsRef.current = blended;
      setAnimState((prev) => ({ ...prev, players: blended }));
    }
  }, [basePlayers]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopIdle();
    },
    [stopIdle],
  );

  // Process a single step from the queue
  const processStep = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) {
      // Drift back: slower after set pieces
      const driftMs = hadSetPieceRef.current
        ? SET_PIECE_REFORM_MS
        : DRIFT_BACK_MS;
      hadSetPieceRef.current = false;

      const base = basePlayersRef.current;
      setAnimState((prev) => ({
        ...prev,
        players: base,
        transitionMs: driftMs,
        activePlayerId: null,
        ballHeight: 0,
        ballCarrierId: null,
      }));
      timeoutRef.current = setTimeout(() => {
        positionsRef.current = base;
        setAnimState((prev) => ({ ...prev, isAnimating: false }));
        startIdle(); // start idle jostling
      }, driftMs);
      return;
    }

    const { step, scaledDurationMs, eventTeam } = queue.shift()!;
    const duration = Math.max(scaledDurationMs, MIN_STEP_MS);
    const ballMs = getBallTransitionMs(step, duration);

    // Track previous positions for direction vectors
    prevPositionsRef.current = positionsRef.current;

    const newPositions = applyStep(positionsRef.current, step, eventTeam);
    positionsRef.current = newPositions;

    // Direction vectors
    const dirVecs = computeDirectionVectors(prevPositionsRef.current, newPositions);

    // Ball trail
    const now = Date.now();
    const trail: BallTrail = {
      startX: step.ball_start.x,
      startY: step.ball_start.y,
      endX: step.ball_end.x,
      endY: step.ball_end.y,
      team: eventTeam,
      createdAt: now,
    };
    trailsRef.current = [
      ...trailsRef.current.filter((t) => now - t.createdAt < TRAIL_LIFETIME_MS),
      trail,
    ].slice(-MAX_TRAILS);

    // Ball carrier detection
    const isDribble =
      step.action === 'dribble' || step.action === 'run';
    const carrierId = isDribble ? step.actor_id : null;

    // Ball height (aerial)
    const bh = computeBallHeight(step, 0.5); // mid-arc at render time

    setAnimState((prev) => ({
      ...prev,
      players: newPositions,
      ball: step.ball_end,
      ballHeight: bh,
      ballTransitionMs: ballMs,
      ballCarrierId: carrierId,
      transitionMs: duration,
      activePlayerId: step.actor_id,
      trails: [...trailsRef.current],
      directionVectors: dirVecs,
    }));

    timeoutRef.current = setTimeout(processStep, duration);
  }, [startIdle]);

  // Collect overlays from events
  const buildOverlays = useCallback(
    (events: SimulationTickEvent[]): EventOverlay[] => {
      const now = Date.now();
      const out: EventOverlay[] = [];
      for (const ev of events) {
        if (ev.type === 'goal') {
          out.push({
            type: 'goal_flash',
            x: ev.coordinates?.x ?? 50,
            y: ev.coordinates?.y ?? 50,
            playerId: ev.primary_player_id,
            createdAt: now,
          });
        } else if (ev.type === 'yellow_card') {
          out.push({
            type: 'yellow_card',
            x: ev.coordinates?.x ?? 50,
            y: ev.coordinates?.y ?? 50,
            playerId: ev.primary_player_id,
            createdAt: now,
          });
        } else if (ev.type === 'red_card') {
          out.push({
            type: 'red_card',
            x: ev.coordinates?.x ?? 50,
            y: ev.coordinates?.y ?? 50,
            playerId: ev.primary_player_id,
            createdAt: now,
          });
        } else if (ev.type === 'foul') {
          out.push({
            type: 'foul_marker',
            x: ev.coordinates?.x ?? 50,
            y: ev.coordinates?.y ?? 50,
            createdAt: now,
          });
        }
      }
      return out;
    },
    [],
  );

  // When new tick arrives, build queue and start
  const eventsRef = useRef(currentEvents);
  eventsRef.current = currentEvents;

  useEffect(() => {
    if (!enabled) return;
    if (tickCounter < 0 || tickCounter === lastTickRef.current) return;
    lastTickRef.current = tickCounter;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    stopIdle();

    const events = eventsRef.current;
    lastEventsRef.current = events;

    // Apply off-the-ball movement to current positions
    const withOffBall = applyOffBallMovement(
      positionsRef.current,
      zoneRef.current,
      possessionRef.current,
      minuteRef.current,
    );
    positionsRef.current = withOffBall;

    // Build overlays
    overlaysRef.current = [
      ...overlaysRef.current.filter(
        (o) => Date.now() - o.createdAt < 3000,
      ),
      ...buildOverlays(events),
    ];

    const rawSteps: Array<{
      step: SequenceStep;
      eventTeam: 'home' | 'away';
    }> = [];

    for (const event of events) {
      if (!event.sequence?.length) continue;
      for (const step of event.sequence) {
        if (step.ball_start && step.ball_end && step.duration_ms) {
          rawSteps.push({ step, eventTeam: event.team });
        }
      }
    }

    if (rawSteps.length === 0) {
      setAnimState((prev) => ({
        ...prev,
        players: withOffBall,
        isAnimating: false,
        activePlayerId: null,
        overlays: [...overlaysRef.current],
      }));
      startIdle(); // even without events, jostle
      return;
    }

    // Apply set-piece positioning
    const isSetPiece = detectSetPiece(events) !== null;
    hadSetPieceRef.current = isSetPiece;
    const positioned = applySetPiecePositioning(positionsRef.current, events);
    positionsRef.current = positioned;

    // Dynamic timing
    const totalRawMs = rawSteps.reduce(
      (s, r) => s + r.step.duration_ms,
      0,
    );
    const minBudget = rawSteps.length * MIN_STEP_MS;
    const targetTotalMs = Math.max(
      minBudget,
      Math.min(totalRawMs, MAX_TOTAL_MS),
    );
    const scale = targetTotalMs / totalRawMs;

    const queue: QueuedStep[] = rawSteps.map((r) => ({
      step: r.step,
      scaledDurationMs: Math.round(r.step.duration_ms * scale),
      eventTeam: r.eventTeam,
    }));

    // Append celebration steps if goal
    const celebrationSteps = buildCelebrationQueue(events, positioned);
    if (celebrationSteps) {
      queue.push(...celebrationSteps);
    }

    queueRef.current = queue;

    setAnimState((prev) => ({
      ...prev,
      players: positioned,
      isAnimating: true,
      transitionMs: isSetPiece ? SET_PIECE_SETUP_MS : 300,
      overlays: [...overlaysRef.current],
    }));

    const setupDelay = isSetPiece ? SET_PIECE_SETUP_MS : 0;
    timeoutRef.current = setTimeout(processStep, setupDelay);
  }, [tickCounter, enabled, processStep, buildOverlays, startIdle, stopIdle]);

  return {
    players: animState.players,
    ball: animState.ball,
    ballHeight: animState.ballHeight,
    ballTransitionMs: animState.ballTransitionMs,
    ballCarrierId: animState.ballCarrierId,
    transitionDurationMs: animState.transitionMs,
    isAnimating: animState.isAnimating,
    activePlayerId: animState.activePlayerId,
    trails: animState.trails,
    overlays: animState.overlays,
    directionVectors: animState.directionVectors,
  };
}
