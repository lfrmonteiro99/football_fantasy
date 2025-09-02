import { GameState, MATCH_SECONDS, Player, Team, Ball, DynamicState, add, clamp, mul, norm, TICK_INTERVAL, FRICTION_COEFF as FRICTION, PERSONAL_SPACE, RunOptions } from './types';
import { buildSpatialIndex, updateSpatialIndex } from './spatial';
import { compute_player_intent } from './intent';
import { build_perception } from './perception';
import { decide_on_ball, initiate_action } from './decisions';
import { process_scheduled_ball_events, schedule_pass } from './passes';
import { resolve_dribble, resolve_tackle, resolve_shot } from './outcomes';
import { assign_base_positions_by_formation } from './formations';
import { process_referee_and_injury_checks } from './referee';
import { update_stamina_morale_and_fatigue } from './stamina';
import { handle_substitutions_and_tactical_changes } from './substitutions';

export function initialize_match(home: Team, away: Team): GameState {
  const ball: Ball = { pos: { x: 50, y: 50 }, vel: { x: 0, y: 0 }, holder_id: null, scheduled_events: [] };
  assign_base_positions_by_formation(home, 'home');
  assign_base_positions_by_formation(away, 'away');
  const all_players = [...home.players, ...away.players];
  for (const p of all_players) {
    p.dynamic = p.dynamic || ({ stamina: p.attributes.staminaMax || 90, morale: 50, confidence: 50, fatigue: 0, action_timer: 0, cooldowns: {}, memory: {}, distance_covered: 0 } as DynamicState);
    p.pos = p.base_position || { x: 50, y: 50 };
    p.vel = { x: 0, y: 0 };
  }
  const G: GameState = { tick: 0, minute: 0, second: 0, teams: { home, away }, all_players, ball, referee_strictness: 50, weather: 'normal', commentary_log: [], spatial_index: null, scores: { home: 0, away: 0 }, last_offball_event_tick: -999, recent_contests: [], tick_events: [] };
  G.spatial_index = buildSpatialIndex(all_players, 10);
  console.log('[UnifiedSim][Init] Teams formed', { home: home.name, away: away.name, players: all_players.length });
  // Kickoff to home team CF if present
  const kickoff = home.players[0];
  if (kickoff) {
    G.ball.holder_id = kickoff.id;
    G.ball.pos = { ...kickoff.pos };
    console.log('[UnifiedSim][Init] Kickoff holder', { id: kickoff.id });
  }
  return G;
}

export function decrement_all_cooldowns_and_timers(G: GameState) {
  for (const p of G.all_players) {
    if (p.dynamic.action_timer > 0) p.dynamic.action_timer -= 1;
    for (const k of Object.keys(p.dynamic.cooldowns)) p.dynamic.cooldowns[k] = Math.max(0, (p.dynamic.cooldowns[k] || 0) - 1);
  }
}

export function on_ball_logic(G: GameState) {
  // If someone holds the ball, make a decision when no action in progress
  const holder = G.ball.holder_id ? G.all_players.find((p) => p.id === G.ball.holder_id) : undefined;
  if (!holder) return;
  if (holder.dynamic.action_timer > 0 || holder.dynamic.current_action) return;
  const per = build_perception(holder, G);
  const decision = decide_on_ball(holder, per, G);
  initiate_action(holder, decision);
  // Store intent snapshot; effect will occur when action_timer hits 0
  if (decision === 'pass' && per.passing_options.length) {
    const best = [...per.passing_options].sort((a, b) => {
      const da = Math.hypot(a.pos.x - holder.pos.x, a.pos.y - holder.pos.y);
      const db = Math.hypot(b.pos.x - holder.pos.x, b.pos.y - holder.pos.y);
      return da - db;
    })[0];
    holder.dynamic.action_intent = {
      type: 'pass',
      receiver_id: best.id,
      receiver_pos: { x: best.pos.x, y: best.pos.y }, // snapshot
      passer_pos: { x: holder.pos.x, y: holder.pos.y }
    };
    console.log('[UnifiedSim][Action-Init] PASS', { tick: G.tick, passer: holder.id, receiver: best.id });
  } else if (decision === 'dribble') {
    const opponent = G.all_players
      .filter((p) => p.team_id !== holder.team_id)
      .sort((a, b) => Math.hypot(a.pos.x - holder.pos.x, a.pos.y - holder.pos.y) - Math.hypot(b.pos.x - holder.pos.x, b.pos.y - holder.pos.y))[0];
    if (opponent) {
      holder.dynamic.action_intent = { type: 'dribble', opponent_id: opponent.id };
      console.log('[UnifiedSim][Action-Init] DRIBBLE', { tick: G.tick, holder: holder.id, vs: opponent.id });
    }
  } else if (decision === 'shoot') {
    holder.dynamic.action_intent = { type: 'shoot' };
    console.log('[UnifiedSim][Action-Init] SHOOT', { tick: G.tick, shooter: holder.id });
  }
}

export function resolve_all_movements(G: GameState) {
  for (const p of G.all_players) {
    const target = p.dynamic.action_intent?.move_target || p.base_position;
    const desired = { x: target.x - p.pos.x, y: target.y - p.pos.y };
    const speed = clamp((p.attributes.speed || 5) * (p.dynamic.stamina / (p.attributes.staminaMax || 90)), 0.5, 8);
    const dmag = Math.hypot(desired.x, desired.y);
    const step = mul(norm(desired), Math.min(speed, dmag));
    // avoidance
    let avoid = { x: 0, y: 0 };
    for (const n of G.all_players) {
      if (n.id === p.id) continue;
      const d = { x: p.pos.x - n.pos.x, y: p.pos.y - n.pos.y };
      const dist = Math.hypot(d.x, d.y);
      if (dist < PERSONAL_SPACE && dist > 0) {
        const nd = norm(d);
        const push = mul(nd, (PERSONAL_SPACE - dist) * 0.5);
        avoid = add(avoid, push);
      }
    }
    p.vel = add(step, avoid);
  }
  for (const p of G.all_players) {
    const old = { ...p.pos };
    p.pos = add(p.pos, mul(p.vel, TICK_INTERVAL));
    p.pos.x = clamp(p.pos.x, 0, 100);
    p.pos.y = clamp(p.pos.y, 0, 100);
    p.dynamic.distance_covered += Math.hypot(p.pos.x - old.x, p.pos.y - old.y);
    updateSpatialIndex(G.spatial_index, p, old.x, old.y);
  }
}

export function update_ball_physics_and_resolve_contests(G: GameState) {
  if (G.ball.holder_id) {
    const holder = G.all_players.find((p) => p.id === G.ball.holder_id);
    if (holder) {
      G.ball.pos = holder.pos;
      G.ball.vel = holder.vel;
    }
  } else {
    G.ball.pos = add(G.ball.pos, G.ball.vel);
    G.ball.vel = mul(G.ball.vel, FRICTION);

    // Detect out of bounds for set-pieces
    const out = G.ball.pos.x < 0 || G.ball.pos.x > 100 || G.ball.pos.y < 0 || G.ball.pos.y > 100;
    if (out) {
      const isCorner = (G.ball.pos.x > 100 && (G.ball.pos.y < 20 || G.ball.pos.y > 80)) || (G.ball.pos.x < 0 && (G.ball.pos.y < 20 || G.ball.pos.y > 80));
      const subtype = isCorner ? 'corner' : (G.ball.pos.x < 0 || G.ball.pos.x > 100) ? 'goal_kick' : 'throw_in';
      const location = { x: clamp(G.ball.pos.x, 0, 100), y: clamp(G.ball.pos.y, 0, 100) };
      const attacking_team_id = G.teams.home.ball_owned ? G.teams.home.id : G.teams.away.id;
      G.ball.scheduled_events.push({ tick: G.tick + 3, type: 'set_piece', subtype, location, attacking_team_id });
      G.ball.holder_id = null; G.ball.vel = { x: 0, y: 0 }; G.ball.pos = location;
      console.log('[UnifiedSim][SetPiece] DETECTED', { tick: G.tick, subtype, location });
    }

    // Free ball contest: players near ball try to secure
    const RADIUS = 3.0;
    const candidates = G.all_players.filter((p) => Math.hypot(p.pos.x - G.ball.pos.x, p.pos.y - G.ball.pos.y) <= RADIUS);
    if (candidates.length > 0) {
      // Time-to-ball based winner selection
      const scored = candidates.map((p) => {
        const dist = Math.hypot(p.pos.x - G.ball.pos.x, p.pos.y - G.ball.pos.y);
        const reaction = 0.2 + (1 - (p.attributes.composure || 50) / 100) * 0.5;
        const effSpeed = Math.max(0.1, (p.attributes.speed || 5) * (p.dynamic.stamina / (p.attributes.staminaMax || 90)));
        const ttb = reaction + dist / effSpeed + (Math.random() - 0.5) * 0.2;
        return { p, ttb };
      }).sort((a, b) => a.ttb - b.ttb);
      const winner = scored[0].p;
      G.ball.holder_id = winner.id;
      console.log('[UnifiedSim][Contest] FREE_BALL', { tick: G.tick, winner: winner.id, ttb: scored[0].ttb.toFixed(2) });
      G.recent_contests!.push({ type: 'free_ball', winner_id: winner.id, location: { ...G.ball.pos } });
    }
  }
}

export function run_match(home: Team, away: Team, opts: RunOptions = {}) {
  const G = initialize_match(home, away);
  if (opts.onEvent) G.onEvent = opts.onEvent;
  for (let tick = 0; tick < MATCH_SECONDS; tick++) {
    G.tick = tick; G.minute = Math.floor(tick / 60); G.second = tick % 60;
    update_team_phases_and_dynamic_tactics(G);
    decrement_all_cooldowns_and_timers(G);
    for (const p of G.all_players) compute_player_intent(p, G);
    on_ball_logic(G);
    resolve_action_completions(G);
    resolve_all_movements(G);
    process_scheduled_ball_events(G);
    update_ball_physics_and_resolve_contests(G);
    process_referee_and_injury_checks(G);
    update_stamina_morale_and_fatigue(G);
    handle_substitutions_and_tactical_changes(G);
    // Momentum tweaks on significant events (goal processed in resolve_action_completions)
    // Placeholder: decay toward neutral
    G.teams.home.momentum = Math.max(0, Math.min(1, (G.teams.home.momentum || 0.5) * 0.999));
    G.teams.away.momentum = Math.max(0, Math.min(1, (G.teams.away.momentum || 0.5) * 0.999));
    // Commentary throttling (placeholder off-ball flavor)
    if (Math.random() < 0.05 && G.tick - (G.last_offball_event_tick || -999) > 5) {
      const runner = G.all_players[Math.floor(Math.random() * G.all_players.length)];
      G.commentary_log.push(`${runner.name} makes a run off the ball.`);
      G.last_offball_event_tick = G.tick;
      console.log('[UnifiedSim][Commentary] OFFBALL', { tick: G.tick, player: runner.id });
    }
    // Optional tick snapshot publisher
    if (opts.onTick && (tick % (opts.tickPublishInterval ?? 5) === 0)) {
      try {
        const snapshot = {
          tick: G.tick,
          minute: G.minute,
          second: G.second,
          scores: G.scores,
          homeTeamId: G.teams.home.id,
          awayTeamId: G.teams.away.id,
          ball: G.ball,
          players: G.all_players.map(p => ({ id: p.id, tid: p.team_id, x: p.pos.x, y: p.pos.y, sx: p.vel.x, sy: p.vel.y, st: p.dynamic.stamina }))
        };
        opts.onTick(snapshot);
      } catch {}
    }
    // Clear per-tick events buffer
    G.tick_events = [];
  }
  return G;
}

export function resolve_action_completions(G: GameState) {
  // Process players whose action just completed
  for (const p of G.all_players) {
    if (!p.dynamic.current_action) continue;
    if (p.dynamic.action_timer > 0) continue;
    const intent = p.dynamic.action_intent || {};
    switch (p.dynamic.current_action) {
      case 'pass': {
        const receiver = G.all_players.find((pl) => pl.id === intent.receiver_id);
        if (receiver) {
          // Use stored snapshot positions for origin/target
          const savedReceiver = { ...receiver, pos: intent.receiver_pos || receiver.pos };
          const savedPasserPos = intent.passer_pos || p.pos;
          // Temporarily place passer snapshot for scheduling
          const orig = { x: p.pos.x, y: p.pos.y };
          const origPos = { x: p.pos.x, y: p.pos.y };
          p.pos = savedPasserPos; // ensure scheduler uses initiation point
          schedule_pass(p, savedReceiver, G);
          p.pos = orig; // restore
          console.log('[UnifiedSim][Action-Complete] PASS', { tick: G.tick, passer: p.id, receiver: receiver.id });
        }
        // ball leaves passer now
        p.dynamic.current_action = null;
        p.dynamic.action_intent = null;
        break;
      }
      case 'dribble': {
        // pick closest opponent at completion if stored one is gone
        let opponent = G.all_players.find((pl) => pl.id === intent.opponent_id);
        if (!opponent) {
          opponent = G.all_players
            .filter((pl) => pl.team_id !== p.team_id)
            .sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y) - Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y))[0];
        }
        if (opponent) {
          const result = resolve_dribble(p, opponent, G);
          if (result === 'fail') {
            // Defender attempt -> tackle resolution can yield foul
            const tRes = resolve_tackle(opponent, p, G);
            if (tRes === 'foul') {
              G.recent_contests!.push({ type: 'tackle', attacker_id: p.id, defender_id: opponent.id, outcome: 'foul', winner_id: opponent.id, location: { ...p.pos } });
              G.ball.holder_id = null;
              console.log('[UnifiedSim][Foul] TACKLE_FOUL', { tick: G.tick, attacker: p.id, defender: opponent.id });
            } else if (tRes === 'success') {
              G.ball.holder_id = opponent.id;
            } else {
              // fail -> attacker keeps
              G.ball.holder_id = p.id;
            }
          }
          console.log('[UnifiedSim][Action-Complete] DRIBBLE', { tick: G.tick, holder: p.id, vs: opponent.id, result });
        }
        p.dynamic.current_action = null;
        p.dynamic.action_intent = null;
        break;
      }
      case 'shoot': {
        const oppKeepers = G.all_players.filter((pl) => pl.team_id !== p.team_id && pl.is_keeper);
        const keeper = oppKeepers[0] || G.all_players.find((pl) => pl.team_id !== p.team_id)!;
        const dist_to_goal = p.team_id === G.teams.home.id ? 100 - p.pos.x : p.pos.x;
        const angle_score = 0;
        const outcome = resolve_shot(p, keeper, { dist_to_goal, angle_score }, G);
        if (outcome === 'goal') {
          if (p.team_id === G.teams.home.id) G.scores!.home++; else G.scores!.away++;
          G.commentary_log.push(`GOAL by ${p.name}! (${G.scores!.home}-${G.scores!.away})`);
          console.log('[UnifiedSim][Score] Goal', { tick: G.tick, scorer: p.id, scores: G.scores });
          // Reset for kickoff: ball to conceding team at center
          const conceding = p.team_id === G.teams.home.id ? G.teams.away : G.teams.home;
          const cf = conceding.players[0];
          G.ball.holder_id = cf?.id || null;
          G.ball.pos = { x: 50, y: 50 };
          const scoringTeam = p.team_id === G.teams.home.id ? G.teams.home : G.teams.away;
          const concedingTeam = p.team_id === G.teams.home.id ? G.teams.away : G.teams.home;
          scoringTeam.momentum = Math.min(1, (scoringTeam.momentum || 0.5) + 0.05);
          concedingTeam.momentum = Math.max(0, (concedingTeam.momentum || 0.5) - 0.05);
        } else if (outcome === 'saved') {
          G.ball.holder_id = keeper.id;
        } else {
          G.ball.holder_id = null;
        }
        console.log('[UnifiedSim][Action-Complete] SHOOT', { tick: G.tick, shooter: p.id, outcome });
        p.dynamic.current_action = null;
        p.dynamic.action_intent = null;
        break;
      }
      case 'clear': {
        const ownGoalX = p.team_id === G.teams.home.id ? 0 : 100;
        const dir = norm({ x: p.pos.x - ownGoalX, y: p.pos.y - 50 });
        G.ball.holder_id = null;
        G.ball.pos = { ...p.pos };
        G.ball.vel = mul(dir, 30);
        console.log('[UnifiedSim][Action-Complete] CLEAR', { tick: G.tick, by: p.id });
        p.dynamic.current_action = null;
        p.dynamic.action_intent = null;
        break;
      }
      case 'cross': {
        const attackingRight = p.team_id === G.teams.home.id;
        const inBox = G.all_players.filter(pl => pl.team_id === p.team_id && (attackingRight ? pl.pos.x > 80 : pl.pos.x < 20));
        const target = inBox.sort((a,b)=>Math.hypot(a.pos.x- (attackingRight?94:6), a.pos.y-50)-Math.hypot(b.pos.x- (attackingRight?94:6), b.pos.y-50))[0];
        if (target) {
          schedule_pass(p, target, G);
        } else {
          G.ball.holder_id = null;
          const tgt = { x: attackingRight ? 92 : 8, y: 50 };
          const dx = tgt.x - p.pos.x, dy = tgt.y - p.pos.y; const d = Math.hypot(dx, dy) || 1;
          G.ball.pos = { ...p.pos };
          G.ball.vel = { x: (dx / d) * 18, y: (dy / d) * 18 };
        }
        console.log('[UnifiedSim][Action-Complete] CROSS', { tick: G.tick, by: p.id, to: target?.id });
        p.dynamic.current_action = null;
        p.dynamic.action_intent = null;
        break;
      }
      default:
        p.dynamic.current_action = null;
        p.dynamic.action_intent = null;
    }
  }
}

export function update_team_phases_and_dynamic_tactics(G: GameState) {
  // Determine ball ownership and team phases
  const holder = G.ball.holder_id ? G.all_players.find(p => p.id === G.ball.holder_id) : undefined;
  G.teams.home.ball_owned = !!(holder && holder.team_id === G.teams.home.id);
  G.teams.away.ball_owned = !!(holder && holder.team_id === G.teams.away.id);
  const recentlyContested = !holder && (Math.hypot(G.ball.vel.x, G.ball.vel.y) > 0.2);
  for (const team of [G.teams.home, G.teams.away]) {
    if (team.ball_owned) team.phase = 'attack';
    else if (recentlyContested) team.phase = 'transition';
    else team.phase = 'defence';
  }
  // Dynamic adjustments based on time/score
  const minute = G.minute;
  for (const team of [G.teams.home, G.teams.away]) {
    const isWinning = (team === G.teams.home ? (G.scores!.home > G.scores!.away) : (G.scores!.away > G.scores!.home));
    const isLosing = (team === G.teams.home ? (G.scores!.home < G.scores!.away) : (G.scores!.away < G.scores!.home));
    if (minute >= 75 && isLosing) {
      team.tactic.mentality = 'very_attacking';
      team.tactic.pressing_level = Math.min(100, (team.tactic.pressing_level || 60) + 10);
    }
    if (minute >= 80 && isWinning) {
      team.tactic.mentality = 'defensive';
      team.tactic.defensive_line_depth = Math.max(0, (team.tactic.defensive_line_depth || 50) - 10);
    }
  }
  console.log('[UnifiedSim][Phase]', { tick: G.tick, home: { phase: G.teams.home.phase, ball: G.teams.home.ball_owned }, away: { phase: G.teams.away.phase, ball: G.teams.away.ball_owned } });
}


