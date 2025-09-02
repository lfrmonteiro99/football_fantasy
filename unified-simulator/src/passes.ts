import { GameState, Player, PASS_FLIGHT_MAX, PASS_FLIGHT_MIN, PASS_SPEED_MPS, ScheduledEvent, clamp } from './types';

export function schedule_pass(passer: Player, receiver: Player, G: GameState) {
  const origin = { ...passer.pos };
  const target = { ...receiver.pos };
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const pass_speed = PASS_SPEED_MPS * (1 + (passer.attributes.passing - 50) / 200);
  const flight_time = clamp(Math.round(distance / pass_speed), PASS_FLIGHT_MIN, PASS_FLIGHT_MAX);
  const arrival_tick = G.tick + flight_time;

  const ev: ScheduledEvent = {
    tick: arrival_tick,
    type: 'pass_arrival',
    passer_id: passer.id,
    intended_receiver_id: receiver.id,
    origin,
    target,
    flight_time,
  };
  G.ball.scheduled_events.push(ev);
  G.ball.holder_id = null;
  const dir = { x: dx / (distance || 1), y: dy / (distance || 1) };
  G.ball.pos = origin;
  G.ball.vel = { x: dir.x * pass_speed, y: dir.y * pass_speed };
}

export function process_scheduled_ball_events(G: GameState) {
  const due = G.ball.scheduled_events.filter((e) => e.tick === G.tick);
  if (due.length === 0) return;
  for (const ev of due) {
    if (ev.type === 'pass_arrival') resolve_pass_arrival(ev, G);
    if (ev.type === 'set_piece') {
      // Simple execution: place ball and give to nearest attacker, then schedule a short pass forward
      const atk = G.all_players
        .filter(p => p.team_id === ev.attacking_team_id)
        .sort((a, b) => Math.hypot(a.pos.x - ev.location.x, a.pos.y - ev.location.y) - Math.hypot(b.pos.x - ev.location.x, b.pos.y - ev.location.y))[0];
      if (atk) {
        G.ball.pos = { ...ev.location };
        G.ball.holder_id = atk.id;
        console.log('[UnifiedSim][SetPiece] EXECUTE', { tick: G.tick, subtype: ev.subtype, taker: atk.id });
      }
    }
  }
  G.ball.scheduled_events = G.ball.scheduled_events.filter((e) => e.tick !== G.tick);
}

function resolve_pass_arrival(ev: ScheduledEvent & { type: 'pass_arrival' }, G: GameState) {
  // Central contest resolver using time-to-ball plus bonuses
  type Candidate = Player & { ttb: number; bonus: number; score: number };
  const candidates: Candidate[] = G.all_players.map((p) => {
    // Estimate time-to-ball: reaction + distance / effective_speed
    const dist = Math.hypot(p.pos.x - ev.target.x, p.pos.y - ev.target.y);
    const reaction = 0.3 + (1 - (p.attributes.composure || 50) / 100) * 0.5;
    const effSpeed = Math.max(0.1, (p.attributes.speed || 5) * (p.dynamic.stamina / (p.attributes.staminaMax || 90)));
    const ttb = reaction + dist / effSpeed;
    // Distance to pass line and angle factor
    const ax = ev.origin.x, ay = ev.origin.y, bx = ev.target.x, by = ev.target.y;
    const px = p.pos.x, py = p.pos.y;
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const ab_len = Math.hypot(abx, aby) || 1;
    const proj = (apx * abx + apy * aby) / ab_len;
    const closestX = ax + (proj / ab_len) * abx;
    const closestY = ay + (proj / ab_len) * aby;
    const distLine = Math.hypot(px - closestX, py - closestY);
    let angleBonus = 0;
    if (p.id === ev.intended_receiver_id) {
      const rx = p.pos.x - ev.origin.x, ry = p.pos.y - ev.origin.y;
      const dot = (rx * abx + ry * aby) / ((Math.hypot(rx, ry) || 1) * ab_len);
      angleBonus -= (1 - dot) * 0.2; // better alignment gives small bonus
    }
    let bonus = angleBonus + Math.min(0.3, Math.max(0, 0.15 - distLine * 0.01));
    if (p.id === ev.intended_receiver_id) {
      bonus -= 0.3; // first touch bonus for intended target
      bonus -= (p.attributes.first_touch || 50) * 0.002;
    }
    // Defenders closer get small intercept bonus
    if (!p.is_keeper && p.team_id !== G.teams.home.id && p.team_id !== G.teams.away.id) {
      bonus -= 0; // placeholder for team-based logic
    }
    const score = ttb + bonus + (Math.random() - 0.5) * 0.2; // jitter
    return Object.assign(p, { ttb, bonus, score });
  });
  candidates.sort((a, b) => a.score - b.score);
  const winner = candidates[0];
  G.ball.holder_id = winner?.id ?? null;
  G.ball.pos = { x: ev.target.x, y: ev.target.y };
  G.ball.vel = { x: 0, y: 0 };
  G.recent_contests!.push({ type: 'pass_arrival', winner_id: winner?.id!, intended_receiver_id: ev.intended_receiver_id, location: { ...G.ball.pos }, outcome: winner?.id === ev.intended_receiver_id ? 'complete' : 'intercepted' });
  const evObj = {
    type: winner?.id === ev.intended_receiver_id ? 'pass_complete' : 'pass_intercepted',
    tick: G.tick,
    passer_id: ev.passer_id,
    receiver_id: ev.intended_receiver_id,
    winner_id: winner?.id
  };
  G.tick_events!.push(evObj);
  if (G.onEvent) { try { G.onEvent(evObj); } catch {} }
  // First-touch error chance for intended receiver
  if (winner && winner.id === ev.intended_receiver_id) {
    const firstTouch = winner.attributes.first_touch || 50;
    const errorProb = Math.max(0, 0.12 - firstTouch * 0.0015);
    if (Math.random() < errorProb) {
      // Miscontrol -> free ball nearby
      G.ball.holder_id = null;
      G.ball.vel = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
      console.log('[UnifiedSim][FirstTouch] ERROR', { tick: G.tick, player: winner.id });
    }
  }
  // Memory updates for passer
  const passer = G.all_players.find(p => p.id === ev.passer_id);
  if (passer) {
    passer.dynamic.memory.fail_counts = passer.dynamic.memory.fail_counts || {};
    if (winner?.id !== ev.intended_receiver_id) {
      passer.dynamic.memory.last_failed_action = 'pass';
      passer.dynamic.memory.fail_counts['pass'] = (passer.dynamic.memory.fail_counts['pass'] || 0) + 1;
      passer.dynamic.memory.last_interceptor = winner?.id;
    }
  }
  console.log('[UnifiedSim][Contest] PASS_ARRIVAL', {
    tick: G.tick,
    passer: ev.passer_id,
    target: ev.intended_receiver_id,
    winner: winner?.id,
    ttb: winner?.ttb,
    candidates: candidates.slice(0, 5).map(c => ({ id: c.id, ttb: +c.ttb.toFixed(2), bonus: +c.bonus.toFixed(3), score: +c.score.toFixed(2) }))
  });
}


