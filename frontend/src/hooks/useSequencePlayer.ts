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

const MIN_STEP_MS = 50;
const DRIFT_BACK_MS = 400;
const PLAYER_PULL = 0.65;
const TEAMMATE_PULL = 0.08;
const OPPONENT_PULL = 0.04;

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

/**
 * Move players based on a sequence step.
 * Actor moves toward target. Receiver (if any) moves toward ball_end.
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
    // Actor: move toward action target
    if (p.id === step.actor_id) {
      const target = getActorTarget(step);
      const pos = lerp({x: p.x, y: p.y}, target, PLAYER_PULL);
      return { ...p, x: pos.x, y: pos.y };
    }

    // Receiver: move toward ball_end to collect the pass
    if (targetId && p.id === targetId) {
      const pos = lerp({x: p.x, y: p.y}, ballEnd, PLAYER_PULL * 0.8);
      return { ...p, x: pos.x, y: pos.y };
    }

    // Teammates: support runs toward ball
    if (p.team === eventTeam && p.position !== 'GK') {
      const d = dist(p, ballEnd);
      if (d < 35) {
        const strength = TEAMMATE_PULL * (1 - d / 35);
        const pos = lerp({x: p.x, y: p.y}, ballEnd, strength);
        return { ...p, x: pos.x, y: pos.y };
      }
    }

    // Opponents: shift defensively toward ball
    if (p.team !== eventTeam && p.position !== 'GK') {
      const d = dist(p, ballEnd);
      if (d < 25) {
        const strength = OPPONENT_PULL * (1 - d / 25);
        const pos = lerp({x: p.x, y: p.y}, ballEnd, strength);
        return { ...p, x: pos.x, y: pos.y };
      }
    }

    return p;
  });
}

export function useSequencePlayer(
  basePlayers: Pitch2DPlayer[],
  currentEvents: SimulationTickEvent[],
  tickCounter: number, // CHANGED: use counter instead of minute
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

  // Keep basePlayers ref fresh
  useEffect(() => {
    basePlayersRef.current = basePlayers;
    positionsRef.current = basePlayers;
    if (!animState.isAnimating) {
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
      // Drift back to formation
      const base = basePlayersRef.current;
      positionsRef.current = base;
      setAnimState(prev => ({
        ...prev,
        players: base,
        transitionMs: DRIFT_BACK_MS,
        activePlayerId: null,
      }));
      timeoutRef.current = setTimeout(() => {
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

    // Scale durations to fit within ~800ms total (leave room for drift back)
    const totalRawMs = rawSteps.reduce((s, r) => s + r.step.duration_ms, 0);
    const targetTotalMs = Math.min(totalRawMs, 800); // cap at 800ms
    const scale = targetTotalMs / totalRawMs;

    const queue: QueuedStep[] = rawSteps.map(r => ({
      step: r.step,
      scaledDurationMs: Math.round(r.step.duration_ms * scale),
      eventTeam: r.eventTeam,
    }));

    queueRef.current = queue;

    // Set animating SYNCHRONOUSLY before next render
    setAnimState(prev => ({
      ...prev,
      isAnimating: true,
    }));

    // Start playback
    processStep();
  }, [tickCounter, enabled, processStep]);

  return {
    players: animState.players,
    ball: animState.ball,
    transitionDurationMs: animState.transitionMs,
    isAnimating: animState.isAnimating,
    activePlayerId: animState.activePlayerId,
  };
}
