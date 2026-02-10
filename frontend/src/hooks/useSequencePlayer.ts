import { useState, useEffect, useRef, useCallback } from 'react';
import type { Pitch2DPlayer } from '../components/match/Pitch2D';
import type { SimulationTickEvent, SequenceStep } from '../types';

// ---------------------------------------------------------------------------
// useSequencePlayer — Plays event sequence animations step-by-step
// ---------------------------------------------------------------------------
// Takes base formation positions and the current tick's events. Processes each
// event's `sequence[]` array one step at a time, moving the involved player
// toward the ball_end coordinates and animating the ball itself. After all
// sequences finish, players drift back to their formation positions.
//
// The existing Pitch2D CSS transitions handle smooth visual interpolation —
// this hook just updates the target coordinates at the right times.
// ---------------------------------------------------------------------------

/** Internal queue entry: a single animation step with metadata. */
interface QueuedStep {
  step: SequenceStep;
  eventType: string;
  eventTeam: 'home' | 'away';
}

/** Return value of the hook. */
export interface SequencePlayerResult {
  /** Current animated player positions (or base positions if idle). */
  players: Pitch2DPlayer[];
  /** Current animated ball position. */
  ball: { x: number; y: number } | null;
  /** Current CSS transition duration in ms (matches the playing step). */
  transitionDurationMs: number;
  /** Whether the animation is currently playing. */
  isAnimating: boolean;
  /** ID of the player currently acting (for highlight ring). */
  activePlayerId: number | null;
}

/** Minimum transition duration to avoid instant jumps. */
const MIN_TRANSITION_MS = 150;

/** Duration for the "drift back to formation" phase after sequences end. */
const DRIFT_BACK_MS = 600;

/** How far (in 0-100 units) to pull a player toward the ball_end position. */
const PLAYER_PULL_STRENGTH = 0.6;

/** How far (in 0-100 units) nearby teammates shift toward the action. */
const TEAMMATE_SHIFT = 3;

/**
 * Interpolate a player position toward a target point.
 * strength: 0 = no movement, 1 = move all the way to target.
 */
function lerpPosition(
  current: { x: number; y: number },
  target: { x: number; y: number },
  strength: number,
): { x: number; y: number } {
  return {
    x: clamp(current.x + (target.x - current.x) * strength, 1, 99),
    y: clamp(current.y + (target.y - current.y) * strength, 1, 99),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Given a step, compute animated player positions.
 * - The actor moves toward ball_end.
 * - Nearby teammates shift slightly toward the action.
 * - Opponents near the ball react defensively.
 */
function computeStepPositions(
  basePlayers: Pitch2DPlayer[],
  currentPositions: Pitch2DPlayer[],
  step: SequenceStep,
  eventTeam: 'home' | 'away',
): Pitch2DPlayer[] {
  const ballEnd = step.ball_end;

  return currentPositions.map((p) => {
    // Actor: move toward ball_end
    if (p.id === step.actor_id) {
      const targetPos = getActorTarget(step, p);
      const newPos = lerpPosition(
        { x: p.x, y: p.y },
        targetPos,
        PLAYER_PULL_STRENGTH,
      );
      return { ...p, x: newPos.x, y: newPos.y };
    }

    // Teammates: slight shift toward ball_end for support runs
    if (p.team === eventTeam && p.position !== 'GK') {
      const dist = distance(p, ballEnd);
      if (dist < 30) {
        const shift = lerpPosition(
          { x: p.x, y: p.y },
          ballEnd,
          TEAMMATE_SHIFT / Math.max(dist, 5),
        );
        return { ...p, x: shift.x, y: shift.y };
      }
    }

    // Opponents near the ball: shift slightly toward ball to defend
    if (p.team !== eventTeam && p.position !== 'GK') {
      const dist = distance(p, ballEnd);
      if (dist < 20) {
        const shift = lerpPosition(
          { x: p.x, y: p.y },
          ballEnd,
          (TEAMMATE_SHIFT * 0.5) / Math.max(dist, 5),
        );
        return { ...p, x: shift.x, y: shift.y };
      }
    }

    return p;
  });
}

/**
 * Determine where the actor should move based on the action type.
 */
function getActorTarget(
  step: SequenceStep,
  player: Pitch2DPlayer,
): { x: number; y: number } {
  switch (step.action) {
    case 'shoot':
    case 'header':
      // Shooter stays roughly in place, ball goes to goal
      return step.ball_start;
    case 'save':
      // Keeper moves toward ball_end (where the shot is going)
      return step.ball_end;
    case 'tackle':
    case 'foul':
      // Tackler moves to where ball is
      return step.ball_start;
    case 'run':
      // Runner moves to ball_end
      return step.ball_end;
    case 'clearance':
      // Clearing player stays near ball_start
      return step.ball_start;
    default:
      // pass, cross, dribble, interception — move toward ball_end
      return step.ball_end;
  }
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSequencePlayer(
  basePlayers: Pitch2DPlayer[],
  currentEvents: SimulationTickEvent[],
  tickMinute: number,
  enabled: boolean = true,
): SequencePlayerResult {
  const [animatedPlayers, setAnimatedPlayers] = useState<Pitch2DPlayer[]>(basePlayers);
  const [animatedBall, setAnimatedBall] = useState<{ x: number; y: number } | null>(null);
  const [transitionDurationMs, setTransitionDurationMs] = useState(400);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);

  // Refs for tracking animation state across timeouts
  const queueRef = useRef<QueuedStep[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPositionsRef = useRef<Pitch2DPlayer[]>(basePlayers);
  const lastTickMinuteRef = useRef<number>(-1);

  // Update base positions ref when basePlayers change
  useEffect(() => {
    currentPositionsRef.current = basePlayers;
    if (!isAnimating) {
      setAnimatedPlayers(basePlayers);
    }
  }, [basePlayers, isAnimating]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Play the next step in the queue.
   */
  const playNextStep = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) {
      // All done — drift back to formation positions
      setTransitionDurationMs(DRIFT_BACK_MS);
      setAnimatedPlayers(basePlayers);
      currentPositionsRef.current = basePlayers;
      setActivePlayerId(null);

      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, DRIFT_BACK_MS);
      return;
    }

    const { step, eventTeam } = queue.shift()!;
    const duration = Math.max(step.duration_ms, MIN_TRANSITION_MS);

    // Set transition duration for Pitch2D
    setTransitionDurationMs(duration);

    // Set active player highlight
    setActivePlayerId(step.actor_id);

    // Compute new player positions
    const newPositions = computeStepPositions(
      basePlayers,
      currentPositionsRef.current,
      step,
      eventTeam,
    );
    currentPositionsRef.current = newPositions;
    setAnimatedPlayers(newPositions);

    // Animate ball
    setAnimatedBall(step.ball_end);

    // Schedule next step after this one's duration
    timeoutRef.current = setTimeout(playNextStep, duration);
  }, [basePlayers]);

  // Store currentEvents in a ref so we don't depend on it in the effect
  const eventsRef = useRef<SimulationTickEvent[]>(currentEvents);
  eventsRef.current = currentEvents;

  // When new tick arrives (identified by minute number), build queue and play
  useEffect(() => {
    if (!enabled) return;
    if (tickMinute < 0) return;
    if (tickMinute === lastTickMinuteRef.current) return;
    lastTickMinuteRef.current = tickMinute;

    // Clear any in-flight animation
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Build queue from all events' sequences
    const events = eventsRef.current;
    const queue: QueuedStep[] = [];
    for (const event of events) {
      if (!event.sequence || event.sequence.length === 0) continue;

      for (const step of event.sequence) {
        // Validate the step has the required fields
        if (step.ball_start && step.ball_end && step.duration_ms) {
          queue.push({
            step,
            eventType: event.type,
            eventTeam: event.team,
          });
        }
      }
    }

    if (queue.length === 0) {
      // No sequences — just use base positions with possession shift applied externally
      setIsAnimating(false);
      setActivePlayerId(null);
      return;
    }

    // Store queue and start playing
    queueRef.current = queue;
    setIsAnimating(true);

    // Start first step immediately
    playNextStep();
  }, [tickMinute, enabled, playNextStep]);

  return {
    players: animatedPlayers,
    ball: animatedBall,
    transitionDurationMs,
    isAnimating,
    activePlayerId,
  };
}
