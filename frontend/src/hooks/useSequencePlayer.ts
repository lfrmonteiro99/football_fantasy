import { useState, useEffect, useRef, useCallback } from 'react';
import type { Pitch2DPlayer } from '../components/match/Pitch2D';
import type { SimulationTickEvent, SequenceStep } from '../types';

interface QueuedStep {
  step: SequenceStep;
  scaledDurationMs: number;
  eventTeam: 'home' | 'away';
}

export interface SequencePlayerResult {
  players: Pitch2DPlayer[];
  ball: { x: number; y: number } | null;
  transitionDurationMs: number;
  isAnimating: boolean;
  activePlayerId: number | null;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------
const MIN_STEP_MS = 250;       // Minimum per-step duration (was 50)
const MAX_TOTAL_MS = 2500;     // Max total animation budget per tick (was 800)
const DRIFT_BACK_MS = 800;     // Drift-back duration when queue empties (was 400)
const ACTOR_PULL = 1.0;        // Actor reaches 100% of target (was 0.65)
const RECEIVER_PULL = 0.85;    // Receiver nearly reaches ball (was 0.52)
const TEAMMATE_PULL = 0.15;    // Visible support runs (was 0.08)
const OPPONENT_PULL = 0.08;    // Visible defensive shifts (was 0.04)
const TEAMMATE_RADIUS = 40;    // Distance within which teammates react (was 35)
const OPPONENT_RADIUS = 30;    // Distance within which opponents react (was 25)

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function dist(a: {x:number;y:number}, b: {x:number;y:number}) {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

function lerp(current: {x:number;y:number}, target: {x:number;y:number}, strength: number) {
  return {
    x: clamp(current.x + (target.x - current.x) * strength, 1, 99),
    y: clamp(current.y + (target.y - current.y) * strength, 1, 99),
  };
}

function getActorTarget(step: SequenceStep): {x:number;y:number} {
  switch (step.action) {
    case 'shoot': case 'header':
      return step.ball_start; // shooter stays, ball goes to goal
    case 'save':
      return step.ball_end; // keeper dives toward ball
    case 'tackle': case 'foul':
      return step.ball_start;
    case 'clearance':
      return step.ball_start;
    default: // pass, cross, dribble, run, interception
      return step.ball_end;
  }
}

// ---------------------------------------------------------------------------
// Set-piece position overrides
// ---------------------------------------------------------------------------
// When a corner/penalty/FK is in the events, reposition non-involved players
// so the visualization shows players crowding the box, forming walls, etc.

type SetPieceType = 'corner' | 'penalty' | 'free_kick';

function detectSetPiece(events: SimulationTickEvent[]): { type: SetPieceType; team: 'home' | 'away' } | null {
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

/**
 * Compute set-piece override positions. Players involved in the sequence
 * keep their positions (the animation will move them). Other players
 * are repositioned to realistic set-piece locations.
 */
function applySetPiecePositioning(
  players: Pitch2DPlayer[],
  events: SimulationTickEvent[],
): Pitch2DPlayer[] {
  const setPiece = detectSetPiece(events);
  if (!setPiece) return players;

  const { type, team: attackTeam } = setPiece;
  const involvedIds = getInvolvedIds(events);
  const goalX = attackTeam === 'home' ? 95 : 5;
  // Direction from goal toward midfield (positive = away from goal)
  const dir = attackTeam === 'home' ? -1 : 1;

  if (type === 'corner') {
    // Determine corner side from event data (check ball y position)
    const cornerEvent = events.find(e => e.type === 'corner');
    const cornerY = cornerEvent?.sequence?.[0]?.ball_end?.y ?? 50;
    const isNearSide = cornerY > 50; // near side = high y (right), far side = low y (left)

    let atkIdx = 0;
    let defIdx = 0;

    // Attacking positions: spread in the box
    const atkPositions = [
      { x: goalX + dir * 4, y: isNearSide ? 40 : 60 },  // near post
      { x: goalX + dir * 4, y: 50 },                      // center 6-yard box
      { x: goalX + dir * 6, y: isNearSide ? 55 : 45 },  // far post area
      { x: goalX + dir * 6, y: isNearSide ? 35 : 65 },  // near post area
      { x: goalX + dir * 8, y: 50 },                      // penalty spot area
      { x: goalX + dir * 10, y: isNearSide ? 60 : 40 },  // edge of box
      { x: goalX + dir * 14, y: 50 },                     // edge of box
      { x: goalX + dir * 14, y: isNearSide ? 40 : 60 },  // edge of box
      { x: 50, y: 30 },                                    // stays back
      { x: 50, y: 70 },                                    // stays back
    ];

    // Defending positions: marking in the box
    const defPositions = [
      { x: goalX + dir * 3, y: isNearSide ? 42 : 58 },  // near post mark
      { x: goalX + dir * 3, y: 50 },                      // center mark
      { x: goalX + dir * 5, y: isNearSide ? 53 : 47 },  // far post mark
      { x: goalX + dir * 5, y: isNearSide ? 37 : 63 },  // near post mark
      { x: goalX + dir * 7, y: 50 },                      // edge mark
      { x: goalX + dir * 9, y: isNearSide ? 58 : 42 },  // edge mark
      { x: goalX + dir * 12, y: 48 },                     // deeper mark
      { x: goalX + dir * 12, y: 52 },                     // deeper mark
      { x: goalX + dir * 22, y: 50 },                     // counter cover
      { x: 50, y: 50 },                                    // stays back
    ];

    return players.map(p => {
      if (involvedIds.has(p.id)) return p;

      if (p.position === 'GK') {
        if (p.team !== attackTeam) {
          // Defending GK: near post
          return { ...p, x: goalX + dir * 1, y: isNearSide ? 44 : 56 };
        }
        return p; // Attacking GK stays
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
    return players.map(p => {
      if (involvedIds.has(p.id)) return p;

      if (p.position === 'GK') {
        if (p.team !== attackTeam) {
          // Defending GK: on goal line
          return { ...p, x: goalX + dir * (-1), y: 50 };
        }
        return p;
      }

      // Everyone else outside the box, spread along the penalty arc
      const arcX = penSpotX + dir * 8; // behind the penalty taker
      const spreadY = 25 + (p.id % 10) * 5; // deterministic spread
      return { ...p, x: clamp(arcX, 20, 80), y: clamp(spreadY, 15, 85) };
    });
  }

  if (type === 'free_kick') {
    // Get FK position from event data
    const fkEvent = events.find(e => e.type === 'free_kick');
    const fkPos = fkEvent?.coordinates ?? { x: 50, y: 50 };
    const distToGoal = Math.abs(fkPos.x - goalX);
    const isAttackingThird = distToGoal < 35;

    if (isAttackingThird) {
      // Attacking FK near the box: form a wall + position attackers
      let atkIdx = 0;
      let defIdx = 0;

      const wallX = fkPos.x + dir * (-9); // 9 units toward goal from FK spot
      const atkPositions = [
        { x: goalX + dir * 8, y: 40 },   // edge of box
        { x: goalX + dir * 8, y: 60 },   // edge of box
        { x: goalX + dir * 5, y: 45 },   // in the box
        { x: goalX + dir * 5, y: 55 },   // in the box
        { x: goalX + dir * 12, y: 35 },  // wider
        { x: goalX + dir * 12, y: 65 },  // wider
        { x: 50, y: 40 },                 // midfield cover
        { x: 50, y: 60 },                 // midfield cover
        { x: 50, y: 50 },                 // midfield cover
        { x: 50, y: 30 },                 // stays back
      ];
      const defWallPositions = [
        { x: wallX, y: fkPos.y - 4 },    // wall
        { x: wallX, y: fkPos.y - 2 },    // wall
        { x: wallX, y: fkPos.y },          // wall center
        { x: wallX, y: fkPos.y + 2 },    // wall
        { x: goalX + dir * 6, y: 42 },   // marking
        { x: goalX + dir * 6, y: 58 },   // marking
        { x: goalX + dir * 10, y: 48 },  // marking
        { x: goalX + dir * 10, y: 52 },  // marking
        { x: goalX + dir * 18, y: 50 },  // deeper cover
        { x: 50, y: 50 },                 // stays back
      ];

      return players.map(p => {
        if (involvedIds.has(p.id)) return p;
        if (p.position === 'GK') {
          if (p.team !== attackTeam) {
            return { ...p, x: goalX + dir * 1, y: 48 };
          }
          return p;
        }
        if (p.team === attackTeam) {
          const pos = atkPositions[Math.min(atkIdx++, atkPositions.length - 1)];
          return { ...p, x: clamp(pos.x, 3, 97), y: clamp(pos.y, 5, 95) };
        } else {
          const pos = defWallPositions[Math.min(defIdx++, defWallPositions.length - 1)];
          return { ...p, x: clamp(pos.x, 3, 97), y: clamp(pos.y, 5, 95) };
        }
      });
    }
  }

  return players;
}

// ---------------------------------------------------------------------------
// Core step application
// ---------------------------------------------------------------------------

/**
 * Move players based on a sequence step.
 * Actor moves to target (100%). Receiver moves toward ball_end (85%).
 * Nearby teammates shift toward ball. Opponents shift to defend.
 */
function applyStep(
  players: Pitch2DPlayer[],
  step: SequenceStep,
  eventTeam: 'home' | 'away',
): Pitch2DPlayer[] {
  const ballEnd = step.ball_end;
  const targetId = (step as any).target_id as number | undefined;

  return players.map(p => {
    // Actor: move to action target
    if (p.id === step.actor_id) {
      const target = getActorTarget(step);
      const pos = lerp({x: p.x, y: p.y}, target, ACTOR_PULL);
      return { ...p, x: pos.x, y: pos.y };
    }

    // Receiver: move toward ball_end to collect the pass
    if (targetId && p.id === targetId) {
      const pos = lerp({x: p.x, y: p.y}, ballEnd, RECEIVER_PULL);
      return { ...p, x: pos.x, y: pos.y };
    }

    // Teammates: support runs toward ball
    if (p.team === eventTeam && p.position !== 'GK') {
      const d = dist(p, ballEnd);
      if (d < TEAMMATE_RADIUS) {
        const strength = TEAMMATE_PULL * (1 - d / TEAMMATE_RADIUS);
        const pos = lerp({x: p.x, y: p.y}, ballEnd, strength);
        return { ...p, x: pos.x, y: pos.y };
      }
    }

    // Opponents: shift defensively toward ball
    if (p.team !== eventTeam && p.position !== 'GK') {
      const d = dist(p, ballEnd);
      if (d < OPPONENT_RADIUS) {
        const strength = OPPONENT_PULL * (1 - d / OPPONENT_RADIUS);
        const pos = lerp({x: p.x, y: p.y}, ballEnd, strength);
        return { ...p, x: pos.x, y: pos.y };
      }
    }

    return p;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSequencePlayer(
  basePlayers: Pitch2DPlayer[],
  currentEvents: SimulationTickEvent[],
  tickCounter: number,
  enabled: boolean = true,
): SequencePlayerResult {
  const [animState, setAnimState] = useState<{
    players: Pitch2DPlayer[];
    ball: {x:number;y:number} | null;
    transitionMs: number;
    isAnimating: boolean;
    activePlayerId: number | null;
  }>({
    players: basePlayers,
    ball: null,
    transitionMs: 400,
    isAnimating: false,
    activePlayerId: null,
  });

  const queueRef = useRef<QueuedStep[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionsRef = useRef<Pitch2DPlayer[]>(basePlayers);
  const lastTickRef = useRef(-1);
  const basePlayersRef = useRef(basePlayers);

  // Keep basePlayers ref fresh — but do NOT reset positionsRef during animation
  useEffect(() => {
    basePlayersRef.current = basePlayers;
    if (!animState.isAnimating) {
      positionsRef.current = basePlayers;
      setAnimState(prev => ({ ...prev, players: basePlayers }));
    }
  }, [basePlayers]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Process a single step from the queue
  const processStep = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) {
      // Drift back gradually toward formation (slower than before)
      const base = basePlayersRef.current;
      setAnimState(prev => ({
        ...prev,
        players: base,
        transitionMs: DRIFT_BACK_MS,
        activePlayerId: null,
      }));
      timeoutRef.current = setTimeout(() => {
        positionsRef.current = base;
        setAnimState(prev => ({ ...prev, isAnimating: false }));
      }, DRIFT_BACK_MS);
      return;
    }

    const { step, scaledDurationMs, eventTeam } = queue.shift()!;
    const duration = Math.max(scaledDurationMs, MIN_STEP_MS);

    const newPositions = applyStep(positionsRef.current, step, eventTeam);
    positionsRef.current = newPositions;

    setAnimState(prev => ({
      ...prev,
      players: newPositions,
      ball: step.ball_end,
      transitionMs: duration,
      activePlayerId: step.actor_id,
    }));

    timeoutRef.current = setTimeout(processStep, duration);
  }, []); // no dependencies - uses refs only

  // When new tick arrives, build queue and start
  const eventsRef = useRef(currentEvents);
  eventsRef.current = currentEvents;

  useEffect(() => {
    if (!enabled) return;
    if (tickCounter < 0 || tickCounter === lastTickRef.current) return;
    lastTickRef.current = tickCounter;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const events = eventsRef.current;
    const rawSteps: Array<{step: SequenceStep; eventTeam: 'home'|'away'}> = [];

    for (const event of events) {
      if (!event.sequence?.length) continue;
      for (const step of event.sequence) {
        if (step.ball_start && step.ball_end && step.duration_ms) {
          rawSteps.push({ step, eventTeam: event.team });
        }
      }
    }

    if (rawSteps.length === 0) {
      setAnimState(prev => ({
        ...prev,
        isAnimating: false,
        activePlayerId: null,
      }));
      return;
    }

    // Apply set-piece positioning BEFORE animation starts
    const setPiecePositioned = applySetPiecePositioning(positionsRef.current, events);
    positionsRef.current = setPiecePositioned;

    // Dynamic timing: each step gets at least MIN_STEP_MS, total capped at MAX_TOTAL_MS
    const totalRawMs = rawSteps.reduce((s, r) => s + r.step.duration_ms, 0);
    const minBudget = rawSteps.length * MIN_STEP_MS;
    const targetTotalMs = Math.max(minBudget, Math.min(totalRawMs, MAX_TOTAL_MS));
    const scale = targetTotalMs / totalRawMs;

    const queue: QueuedStep[] = rawSteps.map(r => ({
      step: r.step,
      scaledDurationMs: Math.round(r.step.duration_ms * scale),
      eventTeam: r.eventTeam,
    }));

    queueRef.current = queue;

    // Show set-piece positioning immediately, then start animation
    setAnimState(prev => ({
      ...prev,
      players: setPiecePositioned,
      isAnimating: true,
      transitionMs: 300, // quick transition to set-piece positions
    }));

    // Small delay to let set-piece positions render before animation starts
    const setupDelay = detectSetPiece(events) ? 300 : 0;
    timeoutRef.current = setTimeout(processStep, setupDelay);
  }, [tickCounter, enabled, processStep]);

  return {
    players: animState.players,
    ball: animState.ball,
    transitionDurationMs: animState.transitionMs,
    isAnimating: animState.isAnimating,
    activePlayerId: animState.activePlayerId,
  };
}
