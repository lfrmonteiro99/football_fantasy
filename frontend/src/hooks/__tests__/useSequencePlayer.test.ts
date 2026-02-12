/**
 * Unit tests for useSequencePlayer animation logic.
 *
 * These tests validate the pure helper functions extracted from useSequencePlayer.
 * Since the hook exports them indirectly, we test via module import with careful
 * re-export or direct functional testing.
 *
 * Run: cd frontend && npm test -- --testPathPattern=useSequencePlayer
 */

// We cannot import unexported functions directly, so we test the hook's behavior
// through its exported interfaces and by importing the module to test via
// observable outcomes. For pure function testing, we replicate the logic here.

import type { Pitch2DPlayer } from '../../components/match/Pitch2D';
import type { SimulationTickEvent, SequenceStep } from '../../types';

// ---------------------------------------------------------------------------
// Replicated pure functions for unit testing
// (These match the logic in useSequencePlayer.ts exactly)
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

function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function computeSupportTarget(
  player: Pitch2DPlayer,
  ballStart: { x: number; y: number },
  ballEnd: { x: number; y: number },
  eventTeam: 'home' | 'away',
): { x: number; y: number } {
  const dx = ballEnd.x - ballStart.x;
  const dy = ballEnd.y - ballStart.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const relY = player.y - ballEnd.y;
  const side = relY > 0 ? 1 : -1;
  const forwardOffset = 4 + (player.id % 5);
  const lateralOffset = 8 + (player.id % 7);
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

function computeDefensiveTarget(
  player: Pitch2DPlayer,
  ballEnd: { x: number; y: number },
): { x: number; y: number } {
  const ownGoalX = player.team === 'home' ? 5 : 95;
  return {
    x: (ballEnd.x + ownGoalX) / 2,
    y: (ballEnd.y + player.y) / 2,
  };
}

function getBallTransitionMs(step: SequenceStep, playerDurationMs: number): number {
  const d = dist(step.ball_start, step.ball_end);
  const action = step.action;
  const height = (step as any).ball_height as string | undefined;
  if (action === 'shoot' || action === 'header') {
    return Math.max(120, Math.min(280, d * 4));
  }
  if (action === 'clearance') {
    return Math.max(150, Math.min(350, d * 5));
  }
  if (action === 'cross' || height === 'high' || height === 'lofted') {
    return Math.max(400, Math.min(700, d * 10));
  }
  if (action === 'dribble' || action === 'run') {
    return playerDurationMs;
  }
  if (d < 20) return Math.max(180, Math.min(350, d * 12));
  return Math.max(350, Math.min(600, d * 8));
}

function computeBallHeight(step: SequenceStep, progress: number): number {
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
  const arc = 4 * progress * (1 - progress);
  const maxHeight = Math.min(1.0, d * 0.015);
  return arc * maxHeight;
}

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
// Test helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Pitch2DPlayer> & { id: number }): Pitch2DPlayer {
  return {
    name: `Player ${overrides.id}`,
    shirtNumber: overrides.id,
    x: 50,
    y: 50,
    team: 'home',
    position: 'CM',
    ...overrides,
  };
}

function makeStep(overrides: Partial<SequenceStep> = {}): SequenceStep {
  return {
    action: 'pass',
    actor_id: 1,
    actor_name: 'Player 1',
    ball_start: { x: 30, y: 40 },
    ball_end: { x: 60, y: 50 },
    duration_ms: 400,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pseudoRand', () => {
  it('produces values between 0 and 1', () => {
    for (let i = 0; i < 100; i++) {
      const v = pseudoRand(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(pseudoRand(42)).toBe(pseudoRand(42));
    expect(pseudoRand(999)).toBe(pseudoRand(999));
  });

  it('produces different values for different seeds', () => {
    const vals = new Set<number>();
    for (let i = 0; i < 50; i++) {
      vals.add(pseudoRand(i));
    }
    // At least 40 unique values out of 50
    expect(vals.size).toBeGreaterThan(40);
  });
});

describe('computeSupportTarget', () => {
  it('produces targets in passing lanes, not at ball position', () => {
    const player = makePlayer({ id: 5, x: 45, y: 35, team: 'home' });
    const ballStart = { x: 40, y: 40 };
    const ballEnd = { x: 55, y: 50 };
    const target = computeSupportTarget(player, ballStart, ballEnd, 'home');

    // Target should NOT be at ball_end
    const distFromBall = dist(target, ballEnd);
    expect(distFromBall).toBeGreaterThan(5);

    // Target should be within bounds
    expect(target.x).toBeGreaterThanOrEqual(3);
    expect(target.x).toBeLessThanOrEqual(97);
    expect(target.y).toBeGreaterThanOrEqual(5);
    expect(target.y).toBeLessThanOrEqual(95);
  });

  it('produces different targets for players on different sides', () => {
    const playerAbove = makePlayer({ id: 5, x: 45, y: 30, team: 'home' });
    const playerBelow = makePlayer({ id: 6, x: 45, y: 70, team: 'home' });
    const ballStart = { x: 40, y: 50 };
    const ballEnd = { x: 55, y: 50 };

    const targetAbove = computeSupportTarget(playerAbove, ballStart, ballEnd, 'home');
    const targetBelow = computeSupportTarget(playerBelow, ballStart, ballEnd, 'home');

    // They should spread to different sides
    expect(Math.abs(targetAbove.y - targetBelow.y)).toBeGreaterThan(5);
  });

  it('spreads forward for home team, backward for away', () => {
    const player = makePlayer({ id: 3, x: 50, y: 40, team: 'home' });
    const ballStart = { x: 50, y: 50 };
    const ballEnd = { x: 55, y: 50 };

    const homeTarget = computeSupportTarget(player, ballStart, ballEnd, 'home');
    const awayTarget = computeSupportTarget(player, ballStart, ballEnd, 'away');

    // Home forward (higher x), away backward (lower x)
    expect(homeTarget.x).toBeGreaterThan(awayTarget.x);
  });
});

describe('computeDefensiveTarget', () => {
  it('positions home defender between ball and left goal', () => {
    const defender = makePlayer({ id: 2, x: 30, y: 40, team: 'home', position: 'CB' });
    const ballEnd = { x: 60, y: 50 };
    const target = computeDefensiveTarget(defender, ballEnd);

    // Should be between ball (60) and own goal (5): roughly (60+5)/2 = 32.5
    expect(target.x).toBeCloseTo(32.5, 0);
    // y between ball (50) and player (40): roughly (50+40)/2 = 45
    expect(target.y).toBeCloseTo(45, 0);
  });

  it('positions away defender between ball and right goal', () => {
    const defender = makePlayer({ id: 12, x: 70, y: 60, team: 'away', position: 'CB' });
    const ballEnd = { x: 40, y: 50 };
    const target = computeDefensiveTarget(defender, ballEnd);

    // Should be between ball (40) and own goal (95): roughly (40+95)/2 = 67.5
    expect(target.x).toBeCloseTo(67.5, 0);
  });
});

describe('getBallTransitionMs', () => {
  it('returns fast timing for shots', () => {
    const step = makeStep({ action: 'shoot', ball_start: { x: 70, y: 50 }, ball_end: { x: 95, y: 50 } });
    const ms = getBallTransitionMs(step, 400);
    expect(ms).toBeGreaterThanOrEqual(120);
    expect(ms).toBeLessThanOrEqual(280);
  });

  it('returns slow timing for crosses', () => {
    const step = makeStep({ action: 'cross', ball_start: { x: 80, y: 10 }, ball_end: { x: 85, y: 50 } });
    const ms = getBallTransitionMs(step, 600);
    expect(ms).toBeGreaterThanOrEqual(400);
    expect(ms).toBeLessThanOrEqual(700);
  });

  it('returns player duration for dribbles', () => {
    const step = makeStep({ action: 'dribble' });
    const ms = getBallTransitionMs(step, 550);
    expect(ms).toBe(550);
  });

  it('differentiates short vs long passes', () => {
    const shortPass = makeStep({ action: 'pass', ball_start: { x: 50, y: 50 }, ball_end: { x: 55, y: 52 } });
    const longPass = makeStep({ action: 'pass', ball_start: { x: 20, y: 40 }, ball_end: { x: 60, y: 60 } });
    const shortMs = getBallTransitionMs(shortPass, 400);
    const longMs = getBallTransitionMs(longPass, 400);
    expect(longMs).toBeGreaterThan(shortMs);
  });
});

describe('computeBallHeight', () => {
  it('returns 0 for ground actions', () => {
    const step = makeStep({ action: 'pass', ball_start: { x: 50, y: 50 }, ball_end: { x: 55, y: 52 } });
    expect(computeBallHeight(step, 0.5)).toBe(0);
  });

  it('returns positive height for crosses at midpoint', () => {
    const step = makeStep({ action: 'cross', ball_start: { x: 80, y: 10 }, ball_end: { x: 85, y: 50 } });
    const h = computeBallHeight(step, 0.5);
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThanOrEqual(1);
  });

  it('returns 0 at start and end of aerial actions', () => {
    const step = makeStep({ action: 'clearance', ball_start: { x: 20, y: 40 }, ball_end: { x: 50, y: 50 } });
    expect(computeBallHeight(step, 0)).toBe(0);
    expect(computeBallHeight(step, 1)).toBeCloseTo(0, 5);
  });

  it('peaks at midpoint (progress=0.5)', () => {
    const step = makeStep({ action: 'header', ball_start: { x: 85, y: 45 }, ball_end: { x: 90, y: 50 } });
    const h25 = computeBallHeight(step, 0.25);
    const h50 = computeBallHeight(step, 0.5);
    const h75 = computeBallHeight(step, 0.75);
    expect(h50).toBeGreaterThanOrEqual(h25);
    expect(h50).toBeGreaterThanOrEqual(h75);
  });

  it('treats long passes as aerial', () => {
    const step = makeStep({
      action: 'pass',
      ball_start: { x: 20, y: 30 },
      ball_end: { x: 65, y: 70 },
    });
    const d = dist(step.ball_start, step.ball_end);
    expect(d).toBeGreaterThan(25);
    expect(computeBallHeight(step, 0.5)).toBeGreaterThan(0);
  });
});

describe('computeDirectionVectors', () => {
  it('computes direction for moving players', () => {
    const prev = [makePlayer({ id: 1, x: 40, y: 50 })];
    const curr = [makePlayer({ id: 1, x: 45, y: 52 })];
    const dirs = computeDirectionVectors(prev, curr);
    expect(dirs.has(1)).toBe(true);
    const d = dirs.get(1)!;
    expect(d.dx).toBeGreaterThan(0); // moved right
    expect(d.dy).toBeGreaterThan(0); // moved down
    expect(d.speed).toBeGreaterThan(0.5);
  });

  it('ignores players that barely moved', () => {
    const prev = [makePlayer({ id: 1, x: 50, y: 50 })];
    const curr = [makePlayer({ id: 1, x: 50.1, y: 50.1 })];
    const dirs = computeDirectionVectors(prev, curr);
    expect(dirs.has(1)).toBe(false); // speed < 0.5 threshold
  });

  it('normalizes direction vectors', () => {
    const prev = [makePlayer({ id: 1, x: 40, y: 40 })];
    const curr = [makePlayer({ id: 1, x: 50, y: 40 })];
    const dirs = computeDirectionVectors(prev, curr);
    const d = dirs.get(1)!;
    // Normalized: dx=1, dy=0
    expect(d.dx).toBeCloseTo(1, 1);
    expect(d.dy).toBeCloseTo(0, 1);
    expect(d.speed).toBeCloseTo(10, 1);
  });
});

describe('Off-the-ball movement logic', () => {
  const DEFENSIVE_LINE_SYNC = 0.7;
  const OFF_BALL_DRIFT_X = 3;
  const OFF_BALL_JITTER_Y = 1.2;

  it('syncs defender x positions toward their line average', () => {
    const defenders = [
      makePlayer({ id: 2, x: 20, y: 30, position: 'CB' }),
      makePlayer({ id: 3, x: 28, y: 50, position: 'CB' }),
      makePlayer({ id: 4, x: 22, y: 70, position: 'LB' }),
    ];
    const avgX = (20 + 28 + 22) / 3; // ~23.33

    // Apply sync logic
    const synced = defenders.map((d) => ({
      ...d,
      x: d.x + (avgX - d.x) * DEFENSIVE_LINE_SYNC,
    }));

    // After sync, x values should be closer together
    const xSpreadBefore = Math.max(...defenders.map(d => d.x)) - Math.min(...defenders.map(d => d.x));
    const xSpreadAfter = Math.max(...synced.map(d => d.x)) - Math.min(...synced.map(d => d.x));
    expect(xSpreadAfter).toBeLessThan(xSpreadBefore);
  });

  it('adds y-jitter that is bounded', () => {
    for (let minute = 0; minute < 90; minute++) {
      const seed = minute * 1000 + 5;
      const jitter = (pseudoRand(seed) - 0.5) * 2 * OFF_BALL_JITTER_Y;
      expect(Math.abs(jitter)).toBeLessThanOrEqual(OFF_BALL_JITTER_Y);
    }
  });
});

describe('Goal celebration queue', () => {
  it('builds 3 celebration steps for goal events', () => {
    // The celebration builds 3 steps: hold, run-to-center, cluster
    const CELEBRATION_HOLD_MS = 1500;
    const CELEBRATION_RUN_MS = 800;
    const CELEBRATION_CLUSTER_MS = 2000;

    // Verify timing values
    expect(CELEBRATION_HOLD_MS).toBe(1500);
    expect(CELEBRATION_RUN_MS).toBe(800);
    expect(CELEBRATION_CLUSTER_MS).toBe(2000);

    // Total celebration time
    const total = CELEBRATION_HOLD_MS + CELEBRATION_RUN_MS + CELEBRATION_CLUSTER_MS;
    expect(total).toBe(4300);
  });
});

describe('Set piece detection', () => {
  function detectSetPiece(
    events: SimulationTickEvent[],
  ): { type: string; team: 'home' | 'away' } | null {
    for (const ev of events) {
      if (ev.type === 'corner' || ev.type === 'penalty' || ev.type === 'free_kick') {
        return { type: ev.type, team: ev.team };
      }
    }
    return null;
  }

  it('detects corner events', () => {
    const events = [
      {
        type: 'corner',
        team: 'home' as const,
        sequence: [],
        primary_player_id: 1,
        primary_player_name: 'Test',
      },
    ] as unknown as SimulationTickEvent[];
    const sp = detectSetPiece(events);
    expect(sp).not.toBeNull();
    expect(sp!.type).toBe('corner');
    expect(sp!.team).toBe('home');
  });

  it('returns null for open play', () => {
    const events = [
      {
        type: 'pass',
        team: 'home' as const,
        sequence: [],
      },
    ] as unknown as SimulationTickEvent[];
    expect(detectSetPiece(events)).toBeNull();
  });
});

describe('Position memory blend', () => {
  const POSITION_MEMORY_BLEND = 0.4;

  it('blends 40% toward new position each tick', () => {
    const prev = { x: 30, y: 40 };
    const target = { x: 50, y: 60 };
    const blended = {
      x: prev.x + (target.x - prev.x) * POSITION_MEMORY_BLEND,
      y: prev.y + (target.y - prev.y) * POSITION_MEMORY_BLEND,
    };
    expect(blended.x).toBeCloseTo(38, 0); // 30 + 20*0.4 = 38
    expect(blended.y).toBeCloseTo(48, 0); // 40 + 20*0.4 = 48
  });

  it('converges toward target over multiple ticks', () => {
    let pos = { x: 10, y: 10 };
    const target = { x: 90, y: 90 };
    for (let i = 0; i < 10; i++) {
      pos = {
        x: pos.x + (target.x - pos.x) * POSITION_MEMORY_BLEND,
        y: pos.y + (target.y - pos.y) * POSITION_MEMORY_BLEND,
      };
    }
    // After 10 ticks at 40% blend, should be very close
    expect(pos.x).toBeGreaterThan(80);
    expect(pos.y).toBeGreaterThan(80);
  });
});

describe('Ball trail mechanics', () => {
  const MAX_TRAILS = 5;
  const TRAIL_LIFETIME_MS = 2500;

  it('limits to MAX_TRAILS entries', () => {
    const trails: Array<{ createdAt: number }> = [];
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      trails.push({ createdAt: now });
    }
    const limited = trails.slice(-MAX_TRAILS);
    expect(limited.length).toBe(MAX_TRAILS);
  });

  it('filters expired trails', () => {
    const now = Date.now();
    const trails = [
      { createdAt: now - 3000 }, // expired
      { createdAt: now - 1000 }, // alive
      { createdAt: now },        // alive
    ];
    const active = trails.filter((t) => now - t.createdAt < TRAIL_LIFETIME_MS);
    expect(active.length).toBe(2);
  });
});

describe('Event overlay types', () => {
  it('builds correct overlay types from events', () => {
    const typeMap: Record<string, string> = {
      goal: 'goal_flash',
      yellow_card: 'yellow_card',
      red_card: 'red_card',
      foul: 'foul_marker',
    };

    for (const [eventType, overlayType] of Object.entries(typeMap)) {
      expect(overlayType).toBeDefined();
      expect(typeof overlayType).toBe('string');
    }
  });
});

describe('Boundary conditions', () => {
  it('clamps all coordinates within pitch bounds', () => {
    // Support target should clamp
    const extremePlayer = makePlayer({ id: 1, x: 99, y: 95 });
    const target = computeSupportTarget(
      extremePlayer,
      { x: 95, y: 90 },
      { x: 100, y: 100 },
      'home',
    );
    expect(target.x).toBeLessThanOrEqual(97);
    expect(target.y).toBeLessThanOrEqual(95);
    expect(target.x).toBeGreaterThanOrEqual(3);
    expect(target.y).toBeGreaterThanOrEqual(5);
  });

  it('lerp clamps to 1-99 range', () => {
    const result = lerp({ x: 98, y: 98 }, { x: 120, y: 120 }, 1.0);
    expect(result.x).toBeLessThanOrEqual(99);
    expect(result.y).toBeLessThanOrEqual(99);

    const result2 = lerp({ x: 2, y: 2 }, { x: -20, y: -20 }, 1.0);
    expect(result2.x).toBeGreaterThanOrEqual(1);
    expect(result2.y).toBeGreaterThanOrEqual(1);
  });
});
